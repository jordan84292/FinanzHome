DROP PROCEDURE IF EXISTS sp_expense_installment_mark_paid;

CREATE PROCEDURE sp_expense_installment_mark_paid(
  IN p_installment_id INT UNSIGNED,
  IN p_household_id INT UNSIGNED,
  IN p_paid_by_member_id INT UNSIGNED
)
BEGIN
  DECLARE v_exists INT;

  SELECT COUNT(*) INTO v_exists
  FROM expense_installments ei
  INNER JOIN recurring_expenses re ON re.id = ei.recurring_expense_id
  WHERE ei.id = p_installment_id AND re.household_id = p_household_id;

  IF v_exists = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Installment not found in this household';
  END IF;

  SELECT COUNT(*) INTO v_exists
  FROM household_members
  WHERE id = p_paid_by_member_id AND household_id = p_household_id;

  IF v_exists = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Member not found in this household';
  END IF;

  UPDATE expense_installments
  SET is_paid = 1, paid_by_member_id = p_paid_by_member_id, paid_at = NOW()
  WHERE id = p_installment_id;

  SELECT id, recurring_expense_id, month_start, period_index, due_date, percentage, amount, is_paid, paid_by_member_id, paid_at
  FROM expense_installments
  WHERE id = p_installment_id;
END;
