DROP PROCEDURE IF EXISTS sp_recurring_expense_create;

CREATE PROCEDURE sp_recurring_expense_create(
  IN p_household_id INT UNSIGNED,
  IN p_name VARCHAR(150),
  IN p_category_id SMALLINT UNSIGNED,
  IN p_amount DECIMAL(12,2),
  IN p_currency_id TINYINT UNSIGNED,
  IN p_periodicity ENUM('weekly', 'biweekly', 'one_time'),
  IN p_due_day_config TINYINT UNSIGNED,
  IN p_withdrawal_day TINYINT UNSIGNED,
  IN p_first_due_date DATE,
  IN p_responsible_member_id INT UNSIGNED,
  IN p_created_by_member_id INT UNSIGNED
)
BEGIN
  DECLARE v_member_exists INT;
  DECLARE v_creator_exists INT;

  SELECT COUNT(*) INTO v_member_exists
  FROM household_members
  WHERE id = p_responsible_member_id AND household_id = p_household_id;

  IF v_member_exists = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Responsible member not found in this household';
  END IF;

  SELECT COUNT(*) INTO v_creator_exists
  FROM household_members
  WHERE id = p_created_by_member_id AND household_id = p_household_id;

  IF v_creator_exists = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Creator member not found in this household';
  END IF;

  INSERT INTO recurring_expenses (
    household_id, name, category_id, amount, currency_id, periodicity,
    due_day_config, withdrawal_day, first_due_date, responsible_member_id, created_by_member_id
  ) VALUES (
    p_household_id, p_name, p_category_id, p_amount, p_currency_id, p_periodicity,
    p_due_day_config, p_withdrawal_day, p_first_due_date, p_responsible_member_id, p_created_by_member_id
  );

  SELECT
    re.id, re.household_id, re.name, re.category_id, ec.name AS category_name,
    re.amount, re.currency_id, c.code AS currency_code, c.symbol AS currency_symbol,
    re.periodicity, re.due_day_config, re.withdrawal_day, re.first_due_date,
    re.responsible_member_id, hm.display_name AS responsible_display_name,
    re.is_active, re.created_at
  FROM recurring_expenses re
  INNER JOIN expense_categories ec ON ec.id = re.category_id
  INNER JOIN currencies c ON c.id = re.currency_id
  INNER JOIN household_members hm ON hm.id = re.responsible_member_id
  WHERE re.id = LAST_INSERT_ID();
END;
