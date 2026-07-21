ALTER TABLE shopping_lists
  ADD COLUMN paid_by_member_id INT UNSIGNED NULL AFTER total_actual,
  ADD CONSTRAINT fk_shopping_lists_paid_by FOREIGN KEY (paid_by_member_id) REFERENCES household_members(id);
