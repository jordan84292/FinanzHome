DROP PROCEDURE IF EXISTS sp_expense_occurrence_generate_next;

CREATE PROCEDURE sp_expense_occurrence_generate_next(
  IN p_recurring_expense_id INT UNSIGNED,
  IN p_household_id INT UNSIGNED
)
BEGIN
  DECLARE v_exists INT;
  DECLARE v_periodicity ENUM('weekly', 'biweekly', 'monthly', 'one_time');
  DECLARE v_due_day_config TINYINT UNSIGNED;
  DECLARE v_first_due_date DATE;
  DECLARE v_monthly_due_day TINYINT UNSIGNED;
  DECLARE v_open_count INT;
  DECLARE v_occurrence_count INT;
  DECLARE v_last_period_end DATE;
  DECLARE v_last_due_date DATE;
  DECLARE v_start_date DATE;
  DECLARE v_due_date DATE;
  DECLARE v_next_month_first DATE;

  SELECT COUNT(*) INTO v_exists
  FROM recurring_expenses
  WHERE id = p_recurring_expense_id AND household_id = p_household_id;

  IF v_exists = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Recurring expense not found in this household';
  END IF;

  SELECT periodicity, due_day_config, first_due_date, monthly_due_day
  INTO v_periodicity, v_due_day_config, v_first_due_date, v_monthly_due_day
  FROM recurring_expenses
  WHERE id = p_recurring_expense_id;

  SELECT COUNT(*) INTO v_open_count
  FROM expense_occurrences
  WHERE recurring_expense_id = p_recurring_expense_id AND is_paid = 0;

  IF v_open_count = 0 THEN
    IF v_periodicity = 'one_time' THEN
      SELECT COUNT(*) INTO v_occurrence_count
      FROM expense_occurrences
      WHERE recurring_expense_id = p_recurring_expense_id;

      IF v_occurrence_count = 0 THEN
        INSERT INTO expense_occurrences (recurring_expense_id, period_start, period_end, due_date)
        VALUES (p_recurring_expense_id, v_first_due_date, v_first_due_date, v_first_due_date);
      END IF;
    -- NOTE (weekly & biweekly): the next occurrence's due_date is anchored to the
    -- previous occurrence's schedule (last_period_end / last_due_date), never to
    -- CURDATE(). If a cycle is marked paid long after it was due, the freshly
    -- generated next occurrence can itself already be in the past (immediately
    -- "vencido"). This is intentional: every skipped cycle is still owed, so the
    -- debt must not be silently forgiven or reset to "today".
    ELSEIF v_periodicity = 'weekly' THEN
      SELECT MAX(period_end) INTO v_last_period_end
      FROM expense_occurrences
      WHERE recurring_expense_id = p_recurring_expense_id;

      SET v_start_date = IFNULL(DATE_ADD(v_last_period_end, INTERVAL 1 DAY), CURDATE());
      -- WEEKDAY() returns 0=Monday..6=Sunday, matching due_day_config's 1=Monday..7=Sunday
      -- once shifted by -1; MOD(...,7) after adding 7 keeps the result in 0..6 even when
      -- the raw difference is negative.
      SET v_due_date = DATE_ADD(
        v_start_date,
        INTERVAL MOD((v_due_day_config - 1) - WEEKDAY(v_start_date) + 7, 7) DAY
      );

      INSERT INTO expense_occurrences (recurring_expense_id, period_start, period_end, due_date)
      VALUES (p_recurring_expense_id, v_start_date, v_due_date, v_due_date);
    ELSEIF v_periodicity = 'biweekly' THEN
      SELECT MAX(due_date) INTO v_last_due_date
      FROM expense_occurrences
      WHERE recurring_expense_id = p_recurring_expense_id;

      IF v_last_due_date IS NULL THEN
        SET v_start_date = CURDATE();
        SET v_due_date = DATE_ADD(CURDATE(), INTERVAL 14 DAY);
      ELSE
        SET v_start_date = DATE_ADD(v_last_due_date, INTERVAL 1 DAY);
        SET v_due_date = DATE_ADD(v_last_due_date, INTERVAL 14 DAY);
      END IF;

      INSERT INTO expense_occurrences (recurring_expense_id, period_start, period_end, due_date)
      VALUES (p_recurring_expense_id, v_start_date, v_due_date, v_due_date);
    -- monthly: due date is monthly_due_day clamped to each month's actual length
    -- (LEAST/LAST_DAY, same clamping formula used in sp_reminder_get_pending's
    -- overdue_daily math). Anchored to the previous occurrence's month, never
    -- to CURDATE(), for the same reason as weekly/biweekly above.
    ELSEIF v_periodicity = 'monthly' THEN
      SELECT MAX(due_date) INTO v_last_due_date
      FROM expense_occurrences
      WHERE recurring_expense_id = p_recurring_expense_id;

      IF v_last_due_date IS NULL THEN
        SET v_start_date = DATE_SUB(CURDATE(), INTERVAL DAY(CURDATE()) - 1 DAY);
        SET v_due_date = DATE_ADD(v_start_date, INTERVAL LEAST(v_monthly_due_day, DAY(LAST_DAY(v_start_date))) - 1 DAY);
        IF v_due_date < CURDATE() THEN
          SET v_start_date = DATE_ADD(LAST_DAY(v_start_date), INTERVAL 1 DAY);
          SET v_due_date = DATE_ADD(v_start_date, INTERVAL LEAST(v_monthly_due_day, DAY(LAST_DAY(v_start_date))) - 1 DAY);
        END IF;
      ELSE
        SET v_start_date = DATE_ADD(LAST_DAY(v_last_due_date), INTERVAL 1 DAY);
        SET v_due_date = DATE_ADD(v_start_date, INTERVAL LEAST(v_monthly_due_day, DAY(LAST_DAY(v_start_date))) - 1 DAY);
      END IF;

      INSERT INTO expense_occurrences (recurring_expense_id, period_start, period_end, due_date)
      VALUES (p_recurring_expense_id, v_start_date, v_due_date, v_due_date);
    END IF;
  END IF;

  SELECT id, recurring_expense_id, period_start, period_end, due_date, is_paid, paid_by_member_id, paid_at, created_at
  FROM expense_occurrences
  WHERE recurring_expense_id = p_recurring_expense_id
  ORDER BY due_date DESC, id DESC
  LIMIT 1;
END;
