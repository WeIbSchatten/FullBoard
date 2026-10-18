package database

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/WeIbSchatten/FullBoard/v3/internal/database/model"
)

// copyImportFixture copies an x-ui.db written by unmodified 3x-ui (InboundService.AddInbound),
// so it carries that release's real schema, seeder history and clients-in-JSON layout.
func copyImportFixture(t *testing.T, name string) string {
	t.Helper()
	data, err := os.ReadFile(filepath.Join("testdata", name))
	if err != nil {
		t.Fatal(err)
	}
	src := filepath.Join(t.TempDir(), "x-ui.db")
	if err := os.WriteFile(src, data, 0o600); err != nil {
		t.Fatal(err)
	}
	return src
}

// A 3x-ui v2 client disabled in the inbound JSON must not come back enabled
// when ClientsTable seeds it: gorm default:true drops an explicit false on Create.
func TestClientsTableSeedKeepsDisabledClientsDisabled(t *testing.T) {
	path := copyImportFixture(t, "x-ui-v2.8.11.db")
	if err := InitDB(path); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = CloseDB() })

	got := map[string]bool{}
	var recs []model.ClientRecord
	if err := db.Order("email").Find(&recs).Error; err != nil {
		t.Fatal(err)
	}
	for _, r := range recs {
		got[r.Email] = r.Enable
	}
	want := map[string]bool{"alice": true, "bob": false, "carol": true, "dave": true, "erin": true}
	for email, enable := range want {
		if e, ok := got[email]; !ok || e != enable {
			t.Errorf("client %s enable = %v (present %v), want %v", email, e, ok, enable)
		}
	}
}
