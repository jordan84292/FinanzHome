DROP PROCEDURE IF EXISTS sp_recurring_expense_update;

CREATE PROCEDURE sp_recurring_expense_update(
  IN p_recurring_expense_id INT UNSIGNED,
  IN p_household_id INT UNSIGNED,
  IN p_name VARCHAR(150),
  IN p_category_id SMALLINT UNSIGNED,
  IN p_amount DECIMAL(12,2),
  IN p_currency_id TINYINT UNSIGNED,
  IN p_responsible_member_id INT UNSIGNED
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
  WHERE id = p_responsible_member_id AND household_id = p_household_id;

  IF v_member_exists = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Responsible member not found in this household';
  END IF;

  -- periodicity/due_day_config/withdrawal_day/first_due_date are intentionally
  -- immutable after creation: changing them would desync already-generated
  -- expense_occurrences rows from the new schedule. If the schedule is wrong,
  -- deactivate this recurring expense and create a new one instead.
  UPDATE recurring_expenses
  SET name = p_name,
      category_id = p_category_id,
      amount = p_amount,
      currency_id = p_currency_id,
      responsible_member_id = p_responsible_member_id
  WHERE id = p_recurring_expense_id;

  SELECT
    re.id, re.household_id, re.name, re.category_id, ec.name AS category_name,
    re.amount, re.currency_id, c.code AS currency_code, c.symbol AS currency_symbol,
    re.periodicity, re.due_day_config, re.withdrawal_day, re.first_due_date,
    re.monthly_due_day, re.funding_mode, re.installment_frequency,
    re.responsible_member_id, hm.display_name AS responsible_display_name,
    re.is_active, re.created_at
  FROM recurring_expenses re
  INNER JOIN expense_categories ec ON ec.id = re.category_id
  INNER JOIN currencies c ON c.id = re.currency_id
  INNER JOIN household_members hm ON hm.id = re.responsible_member_id
  WHERE re.id = p_recurring_expense_id;
END;
