DROP PROCEDURE IF EXISTS sp_expense_installment_list;

CREATE PROCEDURE sp_expense_installment_list(
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

  SELECT id, recurring_expense_id, month_start, period_index, due_date, percentage, amount, is_paid, paid_by_member_id, paid_at
  FROM expense_installments
  WHERE recurring_expense_id = p_recurring_expense_id
  ORDER BY month_start DESC, period_index ASC;
END;
