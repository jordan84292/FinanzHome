DROP PROCEDURE IF EXISTS sp_recurring_expense_share_set;

CREATE PROCEDURE sp_recurring_expense_share_set(
  IN p_recurring_expense_id INT UNSIGNED,
  IN p_household_id INT UNSIGNED,
  IN p_member_id INT UNSIGNED,
  IN p_percentage DECIMAL(5,2)
)
BEGIN
  DECLARE v_exists INT;
  DECLARE v_member_exists INT;

  SELECT COUNT(*) INTO v_exists
  FROM recurring_expenses
  WHERE id = p_recurring_expense_id AND household_id = p_household_id;

  IF v_exists = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Recurring expense not found in this household';
  END IF;

  SELECT COUNT(*) INTO v_member_exists
  FROM household_members
  WHERE id = p_member_id AND household_id = p_household_id;

  IF v_member_exists = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Member not found in this household';
  END IF;

  INSERT INTO recurring_expense_shares (recurring_expense_id, member_id, percentage)
  VALUES (p_recurring_expense_id, p_member_id, p_percentage);
END;
