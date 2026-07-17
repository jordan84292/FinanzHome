DROP PROCEDURE IF EXISTS sp_expense_occurrence_mark_paid;

CREATE PROCEDURE sp_expense_occurrence_mark_paid(
  IN p_occurrence_id INT UNSIGNED,
  IN p_household_id INT UNSIGNED,
  IN p_paid_by_member_id INT UNSIGNED
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

  -- The `AND is_paid = 0` guard makes this idempotent: a repeated call (e.g. a
  -- double-tap on the button) does not overwrite paid_by_member_id/paid_at.
  UPDATE expense_occurrences
  SET is_paid = 1, paid_by_member_id = p_paid_by_member_id, paid_at = NOW()
  WHERE id = p_occurrence_id AND is_paid = 0;

  SELECT id, recurring_expense_id, period_start, period_end, due_date, is_paid, paid_by_member_id, paid_at, created_at
  FROM expense_occurrences
  WHERE id = p_occurrence_id;
END;
