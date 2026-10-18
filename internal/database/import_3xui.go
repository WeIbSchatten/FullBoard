package database

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/WeIbSchatten/FullBoard/v3/internal/config"
	"github.com/WeIbSchatten/FullBoard/v3/internal/database/model"
	"github.com/WeIbSchatten/FullBoard/v3/internal/util/crypto"
)

// Import3xUIResult is what Import3xUI carried over and verified.
type Import3xUIResult struct {
	Inbounds  int
	Clients   int
	Settings  int
	CertFiles []ImportedFileRef
	// IPLimitsReset counts clients whose limitIp the ResetIpLimitNoFail2ban
	// migration zeroed because fail2ban is not enforcing on this host.
	IPLimitsReset int
}

// ImportedFileRef is a certificate or key path the imported data points at.
type ImportedFileRef struct {
	Path   string
	Exists bool
}

// 3x-ui tables whose rows must survive the import unchanged.
var import3xUITables = []string{"users", "inbounds", "client_traffics", "settings", "inbound_client_ips", "outbound_traffics", "clients", "client_inbounds", "history_of_seeders"}

// Settings FullBoard migrations delete (LegacyProxySettingsCleanup) or rewrite
// in place (outbound/DNS/freedom fixes on the Xray template).
var (
	import3xUIDroppedSettings   = map[string]bool{"panelProxy": true, "tgBotProxy": true}
	import3xUIRewrittenSettings = map[string]bool{"xrayTemplateConfig": true}
)

type importExpectations struct {
	ipLimitsReset bool
}

// Columns FullBoard's own migrations legitimately rewrite on first open; the
// clients they hold are verified separately through the clients table.
var import3xUIRewrittenColumns = map[string]map[string]bool{
	"inbounds": {"settings": true, "stream_settings": true, "sniffing": true},
}

// Import3xUI builds a FullBoard SQLite database at dstPath from a 3x-ui x-ui.db
// without touching srcPath, and fails unless every source row survives the migration.
func Import3xUI(srcPath, dstPath string) (*Import3xUIResult, error) {
	if config.GetDBKind() == "postgres" {
		return nil, errors.New("3x-ui import writes a SQLite database; unset XUI_DB_TYPE=postgres first")
	}
	if _, err := os.Lstat(dstPath); err == nil {
		return nil, fmt.Errorf("destination already exists: %s (move it into a backup first)", dstPath)
	} else if !errors.Is(err, os.ErrNotExist) {
		return nil, err
	}
	src, err := openSQLiteReadOnly(srcPath)
	if err != nil {
		return nil, err
	}
	defer src.Close()
	for _, table := range []string{"users", "inbounds", "settings", "client_traffics"} {
		if !sqliteTableExists(src, table) {
			return nil, fmt.Errorf("%s is not a 3x-ui database: table %q is missing", srcPath, table)
		}
	}
	before, err := readImportSnapshot(src)
	if err != nil {
		return nil, err
	}
	srcClients, err := read3xUIClients(src)
	if err != nil {
		return nil, err
	}
	expect := importExpectations{}
	if !importSeederRan(before, "ResetIpLimitNoFail2ban") {
		state, _ := fail2banEnforcementState()
		expect.ipLimitsReset = state == fail2banAbsent
	}

	if err := os.MkdirAll(filepath.Dir(dstPath), 0o700); err != nil {
		return nil, err
	}
	tmpPath := dstPath + ".importing"
	removeSQLiteFiles(tmpPath)
	if _, err := src.ExecContext(context.Background(), "VACUUM INTO ?", tmpPath); err != nil {
		return nil, fmt.Errorf("snapshot %s: %w", srcPath, err)
	}
	ok := false
	defer func() {
		if !ok {
			removeSQLiteFiles(tmpPath)
		}
	}()

	if err := InitDB(tmpPath); err != nil {
		return nil, fmt.Errorf("migrate imported database: %w", err)
	}
	result, verifyErr := verifyImport(before, srcClients, expect)
	if err := CloseDB(); err != nil && verifyErr == nil {
		verifyErr = err
	}
	db = nil
	if verifyErr != nil {
		return nil, verifyErr
	}
	if err := ValidateSQLiteDB(tmpPath); err != nil {
		return nil, err
	}
	if err := os.Rename(tmpPath, dstPath); err != nil {
		return nil, err
	}
	ok = true
	return result, nil
}

func openSQLiteReadOnly(path string) (*sql.DB, error) {
	if _, err := os.Stat(path); err != nil {
		return nil, err
	}
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	isSQLite, err := IsSQLiteDB(f)
	f.Close()
	if err != nil || !isSQLite {
		return nil, fmt.Errorf("%s is not a SQLite database", path)
	}
	conn, err := sql.Open("sqlite3", "file:"+filepath.ToSlash(path)+"?mode=ro&_busy_timeout=10000")
	if err != nil {
		return nil, err
	}
	conn.SetMaxOpenConns(1)
	return conn, conn.PingContext(context.Background())
}

func removeSQLiteFiles(path string) {
	for _, suffix := range []string{"", "-wal", "-shm", "-journal"} {
		_ = os.Remove(path + suffix)
	}
}

type importTable struct {
	cols []string
	rows map[string]map[string]string
}

type importSnapshot map[string]importTable

func readImportSnapshot(conn *sql.DB) (importSnapshot, error) {
	snap := importSnapshot{}
	for _, table := range import3xUITables {
		if !sqliteTableExists(conn, table) {
			continue
		}
		t, err := readImportTable(conn, table)
		if err != nil {
			return nil, fmt.Errorf("read %s: %w", table, err)
		}
		snap[table] = t
	}
	return snap, nil
}

func readImportTable(conn *sql.DB, table string) (importTable, error) {
	rows, err := conn.QueryContext(context.Background(), `SELECT * FROM "`+table+`"`)
	if err != nil {
		return importTable{}, err
	}
	defer rows.Close()
	cols, err := rows.Columns()
	if err != nil {
		return importTable{}, err
	}
	t := importTable{cols: cols, rows: map[string]map[string]string{}}
	for rows.Next() {
		vals := make([]any, len(cols))
		ptrs := make([]any, len(cols))
		for i := range vals {
			ptrs[i] = &vals[i]
		}
		if err := rows.Scan(ptrs...); err != nil {
			return importTable{}, err
		}
		row := make(map[string]string, len(cols))
		for i, c := range cols {
			row[c] = importValue(vals[i])
		}
		t.rows[importRowKey(table, row)] = row
	}
	return t, rows.Err()
}

// importRowKey keys settings by name: FullBoard may rewrite a row's id, never its key.
func importRowKey(table string, row map[string]string) string {
	if table == "settings" {
		return row["key"]
	}
	if id, ok := row["id"]; ok {
		return id
	}
	keys := make([]string, 0, len(row))
	for k := range row {
		keys = append(keys, k+"="+row[k])
	}
	sort.Strings(keys)
	return strings.Join(keys, "\x00")
}

func importValue(v any) string {
	switch x := v.(type) {
	case nil:
		return ""
	case []byte:
		return string(x)
	case bool:
		if x {
			return "1"
		}
		return "0"
	default:
		return fmt.Sprint(x)
	}
}

type import3xUIClient struct {
	model.Client
	InboundIDs []int
}

// read3xUIClients collects clients the way every 3x-ui version stores them:
// inside each inbound's settings JSON (v3 additionally mirrors them into a table).
func read3xUIClients(conn *sql.DB) (map[string]*import3xUIClient, error) {
	rows, err := conn.QueryContext(context.Background(), `SELECT id, settings FROM inbounds ORDER BY id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	clients := map[string]*import3xUIClient{}
	for rows.Next() {
		var id int
		var settings sql.NullString
		if err := rows.Scan(&id, &settings); err != nil {
			return nil, err
		}
		var parsed struct {
			Clients []map[string]any `json:"clients"`
		}
		if strings.TrimSpace(settings.String) == "" || json.Unmarshal([]byte(settings.String), &parsed) != nil {
			continue
		}
		for _, obj := range parsed.Clients {
			model.NormalizeLegacyClientFields(obj)
			blob, err := json.Marshal(obj)
			if err != nil {
				continue
			}
			var c model.Client
			if json.Unmarshal(blob, &c) != nil || strings.TrimSpace(c.Email) == "" {
				continue
			}
			email := strings.TrimSpace(c.Email)
			if existing, ok := clients[email]; ok {
				existing.InboundIDs = append(existing.InboundIDs, id)
				continue
			}
			clients[email] = &import3xUIClient{Client: c, InboundIDs: []int{id}}
		}
	}
	return clients, rows.Err()
}

func importSeederRan(snap importSnapshot, name string) bool {
	for _, row := range snap["history_of_seeders"].rows {
		if row["seeder_name"] == name {
			return true
		}
	}
	return false
}

func verifyImport(before importSnapshot, srcClients map[string]*import3xUIClient, expect importExpectations) (*Import3xUIResult, error) {
	sqlDB, err := db.DB()
	if err != nil {
		return nil, err
	}
	after, err := readImportSnapshot(sqlDB)
	if err != nil {
		return nil, err
	}
	var problems []string
	for table, src := range before {
		dst, ok := after[table]
		if !ok {
			problems = append(problems, fmt.Sprintf("table %s is missing after migration", table))
			continue
		}
		problems = append(problems, diffImportTable(table, src, dst, expect)...)
	}
	problems = append(problems, verifyImportedClients(srcClients, expect)...)
	if len(problems) > 0 {
		sort.Strings(problems)
		return nil, fmt.Errorf("imported data does not match the 3x-ui database:\n  %s", strings.Join(problems, "\n  "))
	}
	result := &Import3xUIResult{
		Inbounds:  len(before["inbounds"].rows),
		Clients:   len(srcClients),
		Settings:  len(before["settings"].rows),
		CertFiles: importedFileRefs(after),
	}
	if expect.ipLimitsReset {
		for _, c := range srcClients {
			if c.LimitIP != 0 {
				result.IPLimitsReset++
			}
		}
	}
	return result, nil
}

func diffImportTable(table string, src, dst importTable, expect importExpectations) []string {
	var problems []string
	dstCols := map[string]bool{}
	for _, c := range dst.cols {
		dstCols[c] = true
	}
	for _, c := range src.cols {
		if !dstCols[c] && !import3xUIRewrittenColumns[table][c] {
			problems = append(problems, fmt.Sprintf("%s.%s column was dropped", table, c))
		}
	}
	for key, srcRow := range src.rows {
		dstRow, ok := dst.rows[key]
		if !ok && table == "settings" && import3xUIDroppedSettings[key] {
			continue
		}
		if !ok {
			problems = append(problems, fmt.Sprintf("%s row %s is missing", table, describeImportRow(table, srcRow)))
			continue
		}
		for _, c := range src.cols {
			if import3xUIRewrittenColumns[table][c] || !dstCols[c] || c == "id" && table == "settings" {
				continue
			}
			if srcRow[c] != dstRow[c] && !importChangeExpected(table, c, srcRow, dstRow, expect) {
				problems = append(problems, fmt.Sprintf("%s row %s: %s changed from %q to %q", table, describeImportRow(table, srcRow), c, srcRow[c], dstRow[c]))
			}
		}
	}
	return problems
}

func importChangeExpected(table, col string, srcRow, dstRow map[string]string, expect importExpectations) bool {
	switch {
	case table == "settings" && col == "value":
		return import3xUIRewrittenSettings[srcRow["key"]]
	case table == "users" && col == "password":
		return !crypto.IsHashed(srcRow[col]) && crypto.CheckPasswordHash(dstRow[col], srcRow[col])
	case table == "clients" && col == "limit_ip":
		return expect.ipLimitsReset && dstRow[col] == "0"
	}
	return false
}

func describeImportRow(table string, row map[string]string) string {
	switch {
	case table == "settings":
		return row["key"]
	case row["email"] != "":
		return row["email"]
	case row["id"] != "":
		return "id=" + row["id"]
	}
	return "?"
}

func verifyImportedClients(srcClients map[string]*import3xUIClient, expect importExpectations) []string {
	var problems []string
	for email, want := range srcClients {
		var rec model.ClientRecord
		if err := db.Where("email = ?", email).First(&rec).Error; err != nil {
			problems = append(problems, fmt.Sprintf("client %s is missing: %v", email, err))
			continue
		}
		got := rec.ToClient()
		checks := []struct {
			field     string
			want, got any
		}{
			{"id", want.ID, got.ID},
			{"password", want.Password, got.Password},
			{"auth", want.Auth, got.Auth},
			{"subId", want.SubID, got.SubID},
			{"totalGB", want.TotalGB, got.TotalGB},
			{"expiryTime", want.ExpiryTime, got.ExpiryTime},
			{"enable", want.Enable, got.Enable},
			{"limitIp", want.LimitIP, got.LimitIP},
			{"tgId", want.TgID, got.TgID},
			{"comment", want.Comment, got.Comment},
			{"reset", want.Reset, got.Reset},
		}
		for _, c := range checks {
			if c.field == "limitIp" && expect.ipLimitsReset && got.LimitIP == 0 {
				continue
			}
			if fmt.Sprint(c.want) != fmt.Sprint(c.got) {
				problems = append(problems, fmt.Sprintf("client %s: %s changed from %v to %v", email, c.field, c.want, c.got))
			}
		}
		for _, inboundID := range want.InboundIDs {
			var n int64
			if err := db.Model(&model.ClientInbound{}).Where("client_id = ? AND inbound_id = ?", rec.Id, inboundID).Count(&n).Error; err != nil || n == 0 {
				problems = append(problems, fmt.Sprintf("client %s is no longer attached to inbound id=%d", email, inboundID))
			}
		}
	}
	return problems
}

func importedFileRefs(after importSnapshot) []ImportedFileRef {
	paths := map[string]bool{}
	for key, row := range after["settings"].rows {
		if strings.HasSuffix(key, "CertFile") || strings.HasSuffix(key, "KeyFile") {
			if v := strings.TrimSpace(row["value"]); v != "" {
				paths[v] = true
			}
		}
	}
	for _, row := range after["inbounds"].rows {
		var stream struct {
			TLSSettings struct {
				Certificates []struct {
					CertificateFile string `json:"certificateFile"`
					KeyFile         string `json:"keyFile"`
				} `json:"certificates"`
			} `json:"tlsSettings"`
		}
		if json.Unmarshal([]byte(row["stream_settings"]), &stream) != nil {
			continue
		}
		for _, c := range stream.TLSSettings.Certificates {
			for _, p := range []string{c.CertificateFile, c.KeyFile} {
				if p = strings.TrimSpace(p); p != "" {
					paths[p] = true
				}
			}
		}
	}
	refs := make([]ImportedFileRef, 0, len(paths))
	for p := range paths {
		_, err := os.Stat(p)
		refs = append(refs, ImportedFileRef{Path: p, Exists: err == nil})
	}
	sort.Slice(refs, func(i, j int) bool { return refs[i].Path < refs[j].Path })
	return refs
}
