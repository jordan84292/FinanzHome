CREATE TABLE expense_categories (
  id SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO expense_categories (name) VALUES
  ('Vivienda'), ('Servicios'), ('Transporte'), ('Salud'), ('Entretenimiento'), ('Otros');

CREATE TABLE recurring_expenses (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  household_id INT UNSIGNED NOT NULL,
  name VARCHAR(150) NOT NULL,
  category_id SMALLINT UNSIGNED NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  currency_id TINYINT UNSIGNED NOT NULL,
  periodicity ENUM('weekly', 'biweekly', 'one_time') NOT NULL,
  due_day_config TINYINT UNSIGNED NULL,
  withdrawal_day TINYINT UNSIGNED NULL,
  first_due_date DATE NULL,
  responsible_member_id INT UNSIGNED NOT NULL,
  created_by_member_id INT UNSIGNED NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_recurring_expenses_household FOREIGN KEY (household_id) REFERENCES households(id),
  CONSTRAINT fk_recurring_expenses_category FOREIGN KEY (category_id) REFERENCES expense_categories(id),
  CONSTRAINT fk_recurring_expenses_currency FOREIGN KEY (currency_id) REFERENCES currencies(id),
  CONSTRAINT fk_recurring_expenses_responsible FOREIGN KEY (responsible_member_id) REFERENCES household_members(id),
  CONSTRAINT fk_recurring_expenses_created_by FOREIGN KEY (created_by_member_id) REFERENCES household_members(id),
  CONSTRAINT chk_recurring_expenses_amount CHECK (amount > 0),
  CONSTRAINT chk_recurring_expenses_schedule CHECK (
    (periodicity = 'weekly' AND due_day_config BETWEEN 1 AND 7 AND withdrawal_day BETWEEN 1 AND 31 AND first_due_date IS NULL)
    OR (periodicity = 'biweekly' AND due_day_config IS NULL AND withdrawal_day BETWEEN 1 AND 31 AND first_due_date IS NULL)
    OR (periodicity = 'one_time' AND due_day_config IS NULL AND withdrawal_day IS NULL AND first_due_date IS NOT NULL)
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE expense_occurrences (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  recurring_expense_id INT UNSIGNED NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  due_date DATE NOT NULL,
  is_paid TINYINT(1) NOT NULL DEFAULT 0,
  paid_by_member_id INT UNSIGNED NULL,
  paid_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_expense_occurrences_recurring FOREIGN KEY (recurring_expense_id) REFERENCES recurring_expenses(id),
  CONSTRAINT fk_expense_occurrences_paid_by FOREIGN KEY (paid_by_member_id) REFERENCES household_members(id),
  CONSTRAINT uq_expense_occurrences_recurring_period UNIQUE (recurring_expense_id, period_start)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
