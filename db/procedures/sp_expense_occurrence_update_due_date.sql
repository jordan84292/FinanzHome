DROP PROCEDURE IF EXISTS sp_expense_occurrence_update_due_date;

-- Corrige la fecha de una ocurrencia puntual (ej. el gasto en realidad vence
-- el 20, no el 15) sin tocar la regla de periodicidad del gasto recurrente —
-- esos campos siguen siendo inmutables (ver sp_recurring_expense_update).
-- Solo aplica a ocurrencias todavía no pagadas: una ya pagada es historial.
CREATE PROCEDURE sp_expense_occurrence_update_due_date(
  IN p_occurrence_id INT UNSIGNED,
  IN p_household_id INT UNSIGNED,
  IN p_due_date DATE
)
BEGIN
  DECLARE v_exists INT;
  DECLARE v_is_paid TINYINT(1);

  SELECT COUNT(*), MAX(eo.is_paid) INTO v_exists, v_is_paid
  FROM expense_occurrences eo
  INNER JOIN recurring_expenses re ON re.id = eo.recurring_expense_id
  WHERE eo.id = p_occurrence_id AND re.household_id = p_household_id;

  IF v_exists = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Expense occurrence not found in this household';
  END IF;

  IF v_is_paid = 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Cannot change the date of an occurrence that is already paid';
  END IF;

  UPDATE expense_occurrences
  SET due_date = p_due_date, period_end = p_due_date
  WHERE id = p_occurrence_id;

  SELECT id, recurring_expense_id, period_start, period_end, due_date, is_paid, paid_by_member_id, paid_at, created_at
  FROM expense_occurrences
  WHERE id = p_occurrence_id;
END;
