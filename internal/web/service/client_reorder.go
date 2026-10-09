package service

import (
	"errors"
	"sort"

	"github.com/WeIbSchatten/FullBoard/v3/internal/database"
	"github.com/WeIbSchatten/FullBoard/v3/internal/database/model"

	"gorm.io/gorm"
)

// Reorder assigns sort_order values to the given client ids in the listed
// sequence. Existing sort_order values of that set are reused (sorted), so a
// page-local drag does not collide with clients outside the set.
func (s *ClientService) Reorder(orderedIDs []int) error {
	if len(orderedIDs) == 0 {
		return nil
	}
	seen := make(map[int]struct{}, len(orderedIDs))
	for _, id := range orderedIDs {
		if id <= 0 {
			return errors.New("client id must be positive")
		}
		if _, dup := seen[id]; dup {
			return errors.New("duplicate client id in reorder list")
		}
		seen[id] = struct{}{}
	}
	return database.GetDB().Transaction(func(tx *gorm.DB) error {
		var rows []model.ClientRecord
		if err := tx.Select("id", "sort_order").Where("id IN ?", orderedIDs).Find(&rows).Error; err != nil {
			return err
		}
		if len(rows) != len(orderedIDs) {
			return errors.New("one or more client ids were not found")
		}
		orders := make([]int, 0, len(rows))
		for _, r := range rows {
			orders = append(orders, r.SortOrder)
		}
		sort.Ints(orders)
		for i, id := range orderedIDs {
			if err := tx.Model(&model.ClientRecord{}).Where("id = ?", id).
				Update("sort_order", orders[i]).Error; err != nil {
				return err
			}
		}
		return nil
	})
}
