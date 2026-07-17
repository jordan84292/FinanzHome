ALTER TABLE shopping_list_splits
  ADD COLUMN is_paid TINYINT(1) NOT NULL DEFAULT 0 AFTER amount_owed,
  ADD COLUMN paid_at DATETIME NULL AFTER is_paid;
