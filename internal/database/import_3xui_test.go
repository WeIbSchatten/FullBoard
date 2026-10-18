package database

import (
	"bytes"
	"database/sql"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/WeIbSchatten/FullBoard/v3/internal/database/model"
	"github.com/WeIbSchatten/FullBoard/v3/internal/util/crypto"
	"github.com/WeIbSchatten/FullBoard/v3/internal/xray"
)

func TestImport3xUICarriesOverEveryRelease(t *testing.T) {
	// v2.8.11 predates ResetIpLimitNoFail2ban, so without fail2ban its limits are zeroed.
	cases := []struct {
		fixture       string
		ipLimitsReset int
		aliceLimitIP  int
	}{
		{"x-ui-v2.8.11.db", 2, 0},
		{"x-ui-v3.10.2.db", 0, 2},
	}
	for _, tc := range cases {
		t.Run(tc.fixture, func(t *testing.T) {
			t.Setenv("XUI_ENABLE_FAIL2BAN", "false")
			src := copyImportFixture(t, tc.fixture)
			srcBefore, err := os.ReadFile(src)
			if err != nil {
				t.Fatal(err)
			}
			dst := filepath.Join(t.TempDir(), "fullboard", "fullboard.db")

			res, err := Import3xUI(src, dst)
			if err != nil {
				t.Fatalf("Import3xUI: %v", err)
			}
			if res.Inbounds != 4 || res.Clients != 5 {
				t.Fatalf("result = %d inbounds, %d clients; want 4, 5", res.Inbounds, res.Clients)
			}
			if res.IPLimitsReset != tc.ipLimitsReset {
				t.Fatalf("IPLimitsReset = %d, want %d", res.IPLimitsReset, tc.ipLimitsReset)
			}
			if srcAfter, _ := os.ReadFile(src); !bytes.Equal(srcBefore, srcAfter) {
				t.Fatal("source x-ui.db was modified")
			}
			for _, leftover := range []string{dst + ".importing", dst + "-wal"} {
				if _, err := os.Stat(leftover); !os.IsNotExist(err) {
					t.Fatalf("%s left behind (stat err %v)", leftover, err)
				}
			}
			wantCert := ImportedFileRef{Path: "/root/cert/vpn.example.com/fullchain.pem", Exists: false}
			if res.CertFiles[0] != wantCert {
				t.Fatalf("CertFiles[0] = %+v, want %+v", res.CertFiles[0], wantCert)
			}

			if err := InitDB(dst); err != nil {
				t.Fatal(err)
			}
			t.Cleanup(func() { _ = CloseDB() })

			var alice model.ClientRecord
			if err := db.Where("email = ?", "alice").First(&alice).Error; err != nil {
				t.Fatal(err)
			}
			got := alice.ToClient()
			if got.ID != "11111111-1111-4111-8111-111111111111" || got.SubID != "subalice0000000" || got.TgID != 12345 ||
				got.TotalGB != 107374182400 || got.ExpiryTime != 1798761600000 || got.LimitIP != tc.aliceLimitIP || !got.Enable {
				t.Fatalf("alice = %+v", got)
			}
			var bob model.ClientRecord
			if err := db.Where("email = ?", "bob").First(&bob).Error; err != nil {
				t.Fatal(err)
			}
			if bob.ToClient().Enable || bob.ToClient().ExpiryTime != -604800000 {
				t.Fatalf("bob = %+v, want disabled with delayed-start expiry", bob.ToClient())
			}

			var traffic xray.ClientTraffic
			if err := db.Where("email = ?", "alice").First(&traffic).Error; err != nil {
				t.Fatal(err)
			}
			if traffic.Up != 1234567890 || traffic.Down != 9876543210 {
				t.Fatalf("alice traffic = %d/%d, want 1234567890/9876543210", traffic.Up, traffic.Down)
			}

			for key, want := range map[string]string{
				"webPort": "2053", "webBasePath": "/secretpath/", "subPath": "/mysub/", "subJsonEnable": "true",
				"subCertFile": "/root/cert/vpn.example.com/fullchain.pem", "tgBotToken": "123456:ABCDEF",
			} {
				var s model.Setting
				if err := db.Where("key = ?", key).First(&s).Error; err != nil || s.Value != want {
					t.Errorf("setting %s = %q (err %v), want %q", key, s.Value, err, want)
				}
			}
			var user model.User
			if err := db.First(&user).Error; err != nil || user.Username != "owner" {
				t.Fatalf("user = %q (err %v), want owner", user.Username, err)
			}
		})
	}
}

func TestImport3xUIRefusesExistingDestination(t *testing.T) {
	src := copyImportFixture(t, "x-ui-v2.8.11.db")
	dst := filepath.Join(t.TempDir(), "fullboard.db")
	if err := os.WriteFile(dst, []byte("live panel"), 0o600); err != nil {
		t.Fatal(err)
	}
	_, err := Import3xUI(src, dst)
	if err == nil || !strings.Contains(err.Error(), "destination already exists") {
		t.Fatalf("err = %v, want destination already exists", err)
	}
	if data, _ := os.ReadFile(dst); string(data) != "live panel" {
		t.Fatalf("destination overwritten: %q", data)
	}
}

func TestImport3xUIRejectsForeignDatabase(t *testing.T) {
	src := filepath.Join(t.TempDir(), "other.db")
	conn, err := sql.Open("sqlite3", src)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := conn.Exec("CREATE TABLE notes (id INTEGER PRIMARY KEY)"); err != nil {
		t.Fatal(err)
	}
	conn.Close()
	dst := filepath.Join(t.TempDir(), "fullboard.db")

	_, err = Import3xUI(src, dst)
	if err == nil || !strings.Contains(err.Error(), `not a 3x-ui database: table "users" is missing`) {
		t.Fatalf("err = %v, want not a 3x-ui database", err)
	}
	if _, statErr := os.Stat(dst); !os.IsNotExist(statErr) {
		t.Fatalf("destination created for a rejected source (stat err %v)", statErr)
	}
}

func TestDiffImportTableReportsLostAndChangedRows(t *testing.T) {
	src := importTable{
		cols: []string{"id", "email", "up", "down"},
		rows: map[string]map[string]string{
			"1": {"id": "1", "email": "alice", "up": "10", "down": "20"},
			"2": {"id": "2", "email": "bob", "up": "1", "down": "2"},
		},
	}
	dst := importTable{
		cols: []string{"id", "email", "up", "down"},
		rows: map[string]map[string]string{
			"1": {"id": "1", "email": "alice", "up": "0", "down": "20"},
		},
	}
	got := diffImportTable("client_traffics", src, dst, importExpectations{})
	want := map[string]bool{
		`client_traffics row alice: up changed from "10" to "0"`: true,
		"client_traffics row bob is missing":                     true,
	}
	if len(got) != len(want) {
		t.Fatalf("problems = %q", got)
	}
	for _, p := range got {
		if !want[p] {
			t.Fatalf("unexpected problem %q in %q", p, got)
		}
	}
}

func TestImportChangeExpectedAcceptsOnlyRealPasswordHashing(t *testing.T) {
	hash, err := crypto.HashPasswordAsBcrypt("admin")
	if err != nil {
		t.Fatal(err)
	}
	other, err := crypto.HashPasswordAsBcrypt("other")
	if err != nil {
		t.Fatal(err)
	}
	cases := []struct {
		name     string
		src, dst string
		want     bool
	}{
		{"plaintext hashed by UserPasswordHash", "admin", hash, true},
		{"plaintext replaced by another password", "admin", other, false},
		{"existing hash replaced", hash, other, false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := importChangeExpected("users", "password", map[string]string{"password": tc.src}, map[string]string{"password": tc.dst}, importExpectations{})
			if got != tc.want {
				t.Fatalf("importChangeExpected = %v, want %v", got, tc.want)
			}
		})
	}
}
