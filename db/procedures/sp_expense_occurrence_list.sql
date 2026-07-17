DROP PROCEDURE IF EXISTS sp_expense_occurrence_list;

CREATE PROCEDURE sp_expense_occurrence_list(
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

  SELECT id, recurring_expense_id, period_start, period_end, due_date, is_paid, paid_by_member_id, paid_at, created_at
  FROM expense_occurrences
  WHERE recurring_expense_id = p_recurring_expense_id
  ORDER BY due_date DESC, id DESC;
END;
