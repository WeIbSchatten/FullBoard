package database

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"slices"
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
	// Warnings name clients whose 3x-ui inbounds disagree on a value one record must hold.
	Warnings []string
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

	// Read the expected state from the snapshot, not the live file: a running
	// 3x-ui keeps writing (client IPs, traffic) between any two reads.
	before, srcClients, err := readImportSource(tmpPath)
	if err != nil {
		return nil, err
	}
	expect := importExpectations{}
	if !importSeederRan(before, "ResetIpLimitNoFail2ban") {
		state, _ := fail2banEnforcementState()
		expect.ipLimitsReset = state == fail2banAbsent
	}

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

func readImportSource(path string) (importSnapshot, map[string]*import3xUIClient, error) {
	conn, err := openSQLiteReadOnly(path)
	if err != nil {
		return nil, nil, err
	}
	defer conn.Close()
	snap, err := readImportSnapshot(conn)
	if err != nil {
		return nil, nil, err
	}
	clients, err := read3xUIClients(conn)
	return snap, clients, err
}

// import3xUIClient is every per-inbound entry 3x-ui keeps for one email.
type import3xUIClient struct {
	Entries    []model.Client
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
			entry, ok := clients[email]
			if !ok {
				entry = &import3xUIClient{}
				clients[email] = entry
			}
			entry.Entries = append(entry.Entries, c)
			entry.InboundIDs = append(entry.InboundIDs, id)
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
	clientProblems, warnings := verifyImportedClients(srcClients, expect)
	problems = append(problems, clientProblems...)
	if len(problems) > 0 {
		sort.Strings(problems)
		return nil, fmt.Errorf("imported data does not match the 3x-ui database:\n  %s", strings.Join(problems, "\n  "))
	}
	result := &Import3xUIResult{
		Inbounds:  len(before["inbounds"].rows),
		Clients:   len(srcClients),
		Settings:  len(before["settings"].rows),
		CertFiles: importedFileRefs(after),
		Warnings:  warnings,
	}
	if expect.ipLimitsReset {
		for _, c := range srcClients {
			if slices.ContainsFunc(c.Entries, func(e model.Client) bool { return e.LimitIP != 0 }) {
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

// importClientFields are the per-client values a subscriber depends on.
var importClientFields = []struct {
	name string
	get  func(*model.Client) string
}{
	{"id", func(c *model.Client) string { return c.ID }},
	{"password", func(c *model.Client) string { return c.Password }},
	{"auth", func(c *model.Client) string { return c.Auth }},
	{"subId", func(c *model.Client) string { return c.SubID }},
	{"totalGB", func(c *model.Client) string { return fmt.Sprint(c.TotalGB) }},
	{"expiryTime", func(c *model.Client) string { return fmt.Sprint(c.ExpiryTime) }},
	{"enable", func(c *model.Client) string { return fmt.Sprint(c.Enable) }},
	{"limitIp", func(c *model.Client) string { return fmt.Sprint(c.LimitIP) }},
	{"tgId", func(c *model.Client) string { return fmt.Sprint(c.TgID) }},
	{"comment", func(c *model.Client) string { return c.Comment }},
	{"reset", func(c *model.Client) string { return fmt.Sprint(c.Reset) }},
}

// Empty and zero entries are "not set" on that inbound; the merged record may take the value another inbound sets.
func importUnset(v string) bool { return v == "" || v == "0" }

// verifyImportedClients requires every merged field to come from one of the
// email's 3x-ui entries, and warns where those entries disagree.
func verifyImportedClients(srcClients map[string]*import3xUIClient, expect importExpectations) (problems, warnings []string) {
	for email, want := range srcClients {
		var rec model.ClientRecord
		if err := db.Where("email = ?", email).First(&rec).Error; err != nil {
			problems = append(problems, fmt.Sprintf("client %s is missing: %v", email, err))
			continue
		}
		got := rec.ToClient()
		for _, f := range importClientFields {
			gotV := f.get(got)
			if f.name == "limitIp" && expect.ipLimitsReset && gotV == "0" {
				continue
			}
			allowed := map[string]bool{}
			set := map[string]bool{}
			for i := range want.Entries {
				v := f.get(&want.Entries[i])
				allowed[v] = true
				if !importUnset(v) {
					set[v] = true
				}
			}
			kept := allowed[gotV]
			if len(set) > 0 {
				kept = set[gotV]
			}
			if !kept {
				problems = append(problems, fmt.Sprintf("client %s: %s is not any value 3x-ui had", email, f.name))
			}
			if len(set) > 1 {
				warnings = append(warnings, fmt.Sprintf("client %s: inbounds %s carry different %s; FullBoard keeps one for all of them",
					email, joinInts(want.InboundIDs), f.name))
			}
		}
		for _, inboundID := range want.InboundIDs {
			var n int64
			if err := db.Model(&model.ClientInbound{}).Where("client_id = ? AND inbound_id = ?", rec.Id, inboundID).Count(&n).Error; err != nil || n == 0 {
				problems = append(problems, fmt.Sprintf("client %s is no longer attached to inbound id=%d", email, inboundID))
			}
		}
	}
	sort.Strings(warnings)
	return problems, warnings
}

func joinInts(ids []int) string {
	parts := make([]string, len(ids))
	for i, id := range ids {
		parts[i] = fmt.Sprint(id)
	}
	return strings.Join(parts, ", ")
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
