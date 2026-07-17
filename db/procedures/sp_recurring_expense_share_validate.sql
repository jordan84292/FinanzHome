DROP PROCEDURE IF EXISTS sp_recurring_expense_share_validate;

CREATE PROCEDURE sp_recurring_expense_share_validate(
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
  FROM recurring_expense_shares
  WHERE recurring_expense_id = p_recurring_expense_id;

  -- An empty share list (v_share_count = 0) is a valid "not shared" state and
  -- skips the sum check entirely — only validate once at least one member is selected.
  IF v_share_count > 0 AND v_percentage_sum <> 100 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Percentages must sum to 100';
  END IF;

  SELECT res.id, res.recurring_expense_id, res.member_id, hm.display_name, res.percentage
  FROM recurring_expense_shares res
  INNER JOIN household_members hm ON hm.id = res.member_id
  WHERE res.recurring_expense_id = p_recurring_expense_id
  ORDER BY hm.id ASC;
END;
