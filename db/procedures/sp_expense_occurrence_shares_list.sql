DROP PROCEDURE IF EXISTS sp_expense_occurrence_shares_list;

CREATE PROCEDURE sp_expense_occurrence_shares_list(
  IN p_occurrence_id INT UNSIGNED,
  IN p_household_id INT UNSIGNED
)
BEGIN
  DECLARE v_exists INT;

  SELECT COUNT(*) INTO v_exists
  FROM expense_occurrences eo
  INNER JOIN recurring_expenses re ON re.id = eo.recurring_expense_id
  WHERE eo.id = p_occurrence_id AND re.household_id = p_household_id;

  IF v_exists = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Expense occurrence not found in this household';
  END IF;

  SELECT eos.id, eos.occurrence_id, eos.member_id, hm.display_name, eos.percentage, eos.amount_owed,
         eos.is_paid, eos.paid_at
  FROM expense_occurrence_shares eos
  INNER JOIN household_members hm ON hm.id = eos.member_id
  WHERE eos.occurrence_id = p_occurrence_id
  ORDER BY hm.id ASC;
END;
