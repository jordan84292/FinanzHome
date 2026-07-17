ALTER TABLE recurring_expenses
  DROP CONSTRAINT chk_recurring_expenses_schedule;

ALTER TABLE recurring_expenses
  MODIFY COLUMN periodicity ENUM('weekly', 'biweekly', 'monthly', 'one_time') NOT NULL,
  ADD COLUMN monthly_due_day TINYINT UNSIGNED NULL AFTER first_due_date,
  ADD COLUMN funding_mode ENUM('full_payment', 'installments') NULL AFTER monthly_due_day,
  ADD COLUMN installment_frequency ENUM('weekly', 'biweekly') NULL AFTER funding_mode;

ALTER TABLE recurring_expenses
  ADD CONSTRAINT chk_recurring_expenses_schedule CHECK (
    (periodicity = 'weekly' AND due_day_config BETWEEN 1 AND 7 AND withdrawal_day BETWEEN 1 AND 31
      AND first_due_date IS NULL AND monthly_due_day IS NULL AND funding_mode IS NULL AND installment_frequency IS NULL)
    OR (periodicity = 'biweekly' AND due_day_config IS NULL AND withdrawal_day BETWEEN 1 AND 31
      AND first_due_date IS NULL AND monthly_due_day IS NULL AND funding_mode IS NULL AND installment_frequency IS NULL)
    OR (periodicity = 'one_time' AND due_day_config IS NULL AND withdrawal_day IS NULL AND first_due_date IS NOT NULL
      AND monthly_due_day IS NULL AND funding_mode IS NULL AND installment_frequency IS NULL)
    OR (periodicity = 'monthly' AND due_day_config IS NULL AND withdrawal_day IS NULL AND first_due_date IS NULL
      AND monthly_due_day BETWEEN 1 AND 31
      AND (
        (funding_mode = 'full_payment' AND installment_frequency IS NULL)
        OR (funding_mode = 'installments' AND installment_frequency IS NOT NULL)
      ))
  );

-- User-configured % of the monthly amount to set aside each period (week or
-- biweek) leading up to monthly_due_day, for periodicity='monthly' expenses
-- with funding_mode='installments'. Same clear-then-reinsert + sum-to-100
-- pattern as recurring_expense_shares, keyed by period_index instead of member.
CREATE TABLE expense_installment_shares (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  recurring_expense_id INT UNSIGNED NOT NULL,
  period_index TINYINT UNSIGNED NOT NULL,
  percentage DECIMAL(5,2) NOT NULL,
  CONSTRAINT fk_expense_installment_shares_expense FOREIGN KEY (recurring_expense_id) REFERENCES recurring_expenses(id),
  CONSTRAINT uq_expense_installment_shares_expense_period UNIQUE (recurring_expense_id, period_index),
  CONSTRAINT chk_expense_installment_shares_percentage CHECK (percentage >= 0 AND percentage <= 100),
  CONSTRAINT chk_expense_installment_shares_period CHECK (period_index BETWEEN 1 AND 5)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- One row per configured period per calendar month, generated from
-- expense_installment_shares when that month's occurrence is first generated.
-- due_date counts backward from that month's due date in steps of
-- installment_frequency (7 or 14 days), so the last period lines up with the
-- actual bill's due day.
CREATE TABLE expense_installments (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  recurring_expense_id INT UNSIGNED NOT NULL,
  month_start DATE NOT NULL,
  period_index TINYINT UNSIGNED NOT NULL,
  due_date DATE NOT NULL,
  percentage DECIMAL(5,2) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  is_paid TINYINT(1) NOT NULL DEFAULT 0,
  paid_by_member_id INT UNSIGNED NULL,
  paid_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_expense_installments_expense FOREIGN KEY (recurring_expense_id) REFERENCES recurring_expenses(id),
  CONSTRAINT fk_expense_installments_paid_by FOREIGN KEY (paid_by_member_id) REFERENCES household_members(id),
  CONSTRAINT uq_expense_installments_expense_month_period UNIQUE (recurring_expense_id, month_start, period_index)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
