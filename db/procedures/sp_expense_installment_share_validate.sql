DROP PROCEDURE IF EXISTS sp_expense_installment_share_validate;

CREATE PROCEDURE sp_expense_installment_share_validate(
  IN p_recurring_expense_id INT UNSIGNED,
  IN p_household_id INT UNSIGNED
)
BEGIN
  DECLARE v_exists INT;
  DECLARE v_share_count INT;
  DECLARE v_percentage_sum DECIMAL(6,2);

  SELECT COUNT(*) INTO v_exists
  FROM recurring_expenses
  WHERE id = p_recurring_expense_id AND household_id = p_household_id;

  IF v_exists = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Recurring expense not found in this household';
  END IF;

  SELECT COUNT(*), SUM(percentage) INTO v_share_count, v_percentage_sum
  FROM expense_installment_shares
  WHERE recurring_expense_id = p_recurring_expense_id;

  -- An empty schedule (v_share_count = 0) is a valid "not configured yet"
  -- transient state right after creating the expense — only validate the sum
  -- once at least one period is configured.
  IF v_share_count > 0 AND v_percentage_sum <> 100 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Percentages must sum to 100';
  END IF;

  SELECT id, recurring_expense_id, period_index, percentage
  FROM expense_installment_shares
  WHERE recurring_expense_id = p_recurring_expense_id
  ORDER BY period_index ASC;
END;
