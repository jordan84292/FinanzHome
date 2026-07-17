DROP PROCEDURE IF EXISTS sp_expense_installment_generate_for_month;

-- Idempotent: generates this month's installment rows from
-- expense_installment_shares the first time it's called for a given
-- (recurring_expense_id, month_start); a second call for the same month is a
-- no-op and just returns the already-generated rows. Same reconciliation-cent
-- pattern as sp_shopping_list_split_init/sp_expense_occurrence_shares_snapshot:
-- rounding each period's amount independently can leave a few cents of drift
-- against the full monthly amount, swept onto the lowest period_index row.
CREATE PROCEDURE sp_expense_installment_generate_for_month(
  IN p_recurring_expense_id INT UNSIGNED,
  IN p_household_id INT UNSIGNED,
  IN p_month_start DATE
)
BEGIN
  DECLARE v_exists INT;
  DECLARE v_funding_mode ENUM('full_payment', 'installments');
  DECLARE v_monthly_due_day TINYINT UNSIGNED;
  DECLARE v_installment_frequency ENUM('weekly', 'biweekly');
  DECLARE v_amount DECIMAL(12,2);
  DECLARE v_already_generated INT;
  DECLARE v_due_date DATE;
  DECLARE v_spacing_days INT;
  DECLARE v_max_period INT;
  DECLARE v_amount_sum DECIMAL(12,2);
  DECLARE v_amount_diff DECIMAL(12,2);

  SELECT COUNT(*) INTO v_exists
  FROM recurring_expenses
  WHERE id = p_recurring_expense_id AND household_id = p_household_id;

  IF v_exists = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Recurring expense not found in this household';
  END IF;

  SELECT funding_mode, monthly_due_day, installment_frequency, amount
  INTO v_funding_mode, v_monthly_due_day, v_installment_frequency, v_amount
  FROM recurring_expenses
  WHERE id = p_recurring_expense_id;

  IF v_funding_mode IS NULL OR v_funding_mode <> 'installments' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Expense is not configured for installment funding';
  END IF;

  SELECT COUNT(*) INTO v_already_generated
  FROM expense_installments
  WHERE recurring_expense_id = p_recurring_expense_id AND month_start = p_month_start;

  IF v_already_generated = 0 THEN
    SET v_due_date = DATE_ADD(p_month_start, INTERVAL LEAST(v_monthly_due_day, DAY(LAST_DAY(p_month_start))) - 1 DAY);
    SET v_spacing_days = IF(v_installment_frequency = 'weekly', 7, 14);

    SELECT MAX(period_index) INTO v_max_period
    FROM expense_installment_shares
    WHERE recurring_expense_id = p_recurring_expense_id;

    INSERT INTO expense_installments (recurring_expense_id, month_start, period_index, due_date, percentage, amount)
    SELECT p_recurring_expense_id, p_month_start, eis.period_index,
      DATE_SUB(v_due_date, INTERVAL (v_max_period - eis.period_index) * v_spacing_days DAY),
      eis.percentage,
      ROUND(v_amount * eis.percentage / 100, 2)
    FROM expense_installment_shares eis
    WHERE eis.recurring_expense_id = p_recurring_expense_id;

    SELECT SUM(amount) INTO v_amount_sum
    FROM expense_installments
    WHERE recurring_expense_id = p_recurring_expense_id AND month_start = p_month_start;

    SET v_amount_diff = v_amount - v_amount_sum;

    IF v_amount_diff <> 0 THEN
      UPDATE expense_installments
      SET amount = amount + v_amount_diff
      WHERE recurring_expense_id = p_recurring_expense_id AND month_start = p_month_start
      ORDER BY period_index ASC
      LIMIT 1;
    END IF;
  END IF;

  SELECT id, recurring_expense_id, month_start, period_index, due_date, percentage, amount, is_paid, paid_by_member_id, paid_at
  FROM expense_installments
  WHERE recurring_expense_id = p_recurring_expense_id AND month_start = p_month_start
  ORDER BY period_index ASC;
END;
