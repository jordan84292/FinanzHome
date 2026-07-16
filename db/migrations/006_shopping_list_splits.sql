CREATE TABLE shopping_list_splits (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  shopping_list_id INT UNSIGNED NOT NULL,
  member_id INT UNSIGNED NOT NULL,
  percentage DECIMAL(5,2) NOT NULL,
  amount_owed DECIMAL(12,2) NOT NULL,
  CONSTRAINT fk_shopping_list_splits_list FOREIGN KEY (shopping_list_id) REFERENCES shopping_lists(id),
  CONSTRAINT fk_shopping_list_splits_member FOREIGN KEY (member_id) REFERENCES household_members(id),
  CONSTRAINT uq_shopping_list_splits_list_member UNIQUE (shopping_list_id, member_id),
  CONSTRAINT chk_shopping_list_splits_percentage CHECK (percentage >= 0 AND percentage <= 100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
