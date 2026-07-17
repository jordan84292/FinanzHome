CREATE TABLE recurring_expense_shares (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  recurring_expense_id INT UNSIGNED NOT NULL,
  member_id INT UNSIGNED NOT NULL,
  percentage DECIMAL(5,2) NOT NULL,
  CONSTRAINT fk_recurring_expense_shares_expense FOREIGN KEY (recurring_expense_id) REFERENCES recurring_expenses(id),
  CONSTRAINT fk_recurring_expense_shares_member FOREIGN KEY (member_id) REFERENCES household_members(id),
  CONSTRAINT uq_recurring_expense_shares_expense_member UNIQUE (recurring_expense_id, member_id),
  CONSTRAINT chk_recurring_expense_shares_percentage CHECK (percentage >= 0 AND percentage <= 100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE expense_occurrence_shares (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  occurrence_id INT UNSIGNED NOT NULL,
  member_id INT UNSIGNED NOT NULL,
  percentage DECIMAL(5,2) NOT NULL,
  amount_owed DECIMAL(12,2) NOT NULL,
  CONSTRAINT fk_expense_occurrence_shares_occurrence FOREIGN KEY (occurrence_id) REFERENCES expense_occurrences(id),
  CONSTRAINT fk_expense_occurrence_shares_member FOREIGN KEY (member_id) REFERENCES household_members(id),
  CONSTRAINT uq_expense_occurrence_shares_occurrence_member UNIQUE (occurrence_id, member_id),
  CONSTRAINT chk_expense_occurrence_shares_percentage CHECK (percentage >= 0 AND percentage <= 100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
