ALTER TABLE shopping_lists
  ADD COLUMN is_shared TINYINT(1) NOT NULL DEFAULT 1 AFTER status;
