package service

import (
	"path/filepath"
	"testing"

	"github.com/WeIbSchatten/FullBoard/v3/internal/database"
	"github.com/WeIbSchatten/FullBoard/v3/internal/database/dbtest"
	"github.com/WeIbSchatten/FullBoard/v3/internal/database/model"
)

func TestClientReorderPreservesOutsideSortSlots(t *testing.T) {
	dbtest.InitDB(t, filepath.Join(t.TempDir(), "fullboard.db"))
	db := database.GetDB()
	seed := []model.ClientRecord{
		{Email: "a@x", Enable: true, SortOrder: 10},
		{Email: "b@x", Enable: true, SortOrder: 20},
		{Email: "c@x", Enable: true, SortOrder: 30},
		{Email: "d@x", Enable: true, SortOrder: 40},
	}
	for i := range seed {
		if err := db.Create(&seed[i]).Error; err != nil {
			t.Fatalf("seed %s: %v", seed[i].Email, err)
		}
	}
	// Reverse b,c within their slots [20,30]; a and d stay put.
	if err := (&ClientService{}).Reorder([]int{seed[2].Id, seed[1].Id}); err != nil {
		t.Fatalf("Reorder: %v", err)
	}
	var got []model.ClientRecord
	if err := db.Order("sort_order asc, id asc").Find(&got).Error; err != nil {
		t.Fatal(err)
	}
	want := []string{"a@x", "c@x", "b@x", "d@x"}
	if len(got) != len(want) {
		t.Fatalf("len=%d, want %d", len(got), len(want))
	}
	for i := range want {
		if got[i].Email != want[i] {
			t.Fatalf("pos %d = %s, want %s", i, got[i].Email, want[i])
		}
	}
	if got[1].SortOrder != 20 || got[2].SortOrder != 30 {
		t.Fatalf("slots = %d,%d want 20,30", got[1].SortOrder, got[2].SortOrder)
	}
}

func TestClientReorderRejectsUnknownID(t *testing.T) {
	dbtest.InitDB(t, filepath.Join(t.TempDir(), "fullboard.db"))
	rec := model.ClientRecord{Email: "only@x", Enable: true, SortOrder: 1}
	if err := database.GetDB().Create(&rec).Error; err != nil {
		t.Fatal(err)
	}
	err := (&ClientService{}).Reorder([]int{rec.Id, 999999})
	if err == nil {
		t.Fatal("expected missing-id error")
	}
}
