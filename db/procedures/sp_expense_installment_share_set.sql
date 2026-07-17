DROP PROCEDURE IF EXISTS sp_expense_installment_share_set;

CREATE PROCEDURE sp_expense_installment_share_set(
  IN p_recurring_expense_id INT UNSIGNED,
  IN p_household_id INT UNSIGNED,
  IN p_period_index TINYINT UNSIGNED,
  IN p_percentage DECIMAL(5,2)
)
BEGIN
  DECLARE v_exists INT;

  SELECT COUNT(*) INTO v_exists
  FROM recurring_expenses
  WHERE id = p_recurring_expense_id AND household_id = p_household_id;

  IF v_exists = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Recurring expense not found in this household';
  END IF;

  INSERT INTO expense_installment_shares (recurring_expense_id, period_index, percentage)
  VALUES (p_recurring_expense_id, p_period_index, p_percentage);
END;
