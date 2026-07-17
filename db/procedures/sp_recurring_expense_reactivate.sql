DROP PROCEDURE IF EXISTS sp_recurring_expense_reactivate;

CREATE PROCEDURE sp_recurring_expense_reactivate(
  IN p_recurring_expense_id INT UNSIGNED,
  IN p_household_id INT UNSIGNED
)
BEGIN
  DECLARE v_exists INT;

  SELECT COUNT(*) INTO v_exists
  FROM recurring_expenses
  WHERE id = p_recurring_expense_id AND household_id = p_household_id;

  IF v_exists = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Recurring expense not found in this household';
  END IF;

  UPDATE recurring_expenses SET is_active = 1 WHERE id = p_recurring_expense_id;
END;
