DROP PROCEDURE IF EXISTS sp_recurring_expense_share_list;

CREATE PROCEDURE sp_recurring_expense_share_list(
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

  SELECT res.id, res.recurring_expense_id, res.member_id, hm.display_name, res.percentage
  FROM recurring_expense_shares res
  INNER JOIN household_members hm ON hm.id = res.member_id
  WHERE res.recurring_expense_id = p_recurring_expense_id
  ORDER BY hm.id ASC;
END;
