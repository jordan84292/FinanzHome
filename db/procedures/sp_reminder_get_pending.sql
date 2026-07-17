DROP PROCEDURE IF EXISTS sp_reminder_get_pending;

CREATE PROCEDURE sp_reminder_get_pending(
  IN p_today DATE
)
BEGIN
  DECLARE v_done INT DEFAULT 0;
  DECLARE v_occurrence_id INT UNSIGNED;
  DECLARE v_recurring_expense_id INT UNSIGNED;
  DECLARE v_member_id INT UNSIGNED;
  DECLARE v_due_date DATE;
  DECLARE v_payment_frequency ENUM('weekly', 'semimonthly', 'monthly');
  DECLARE v_payment_weekday TINYINT UNSIGNED;
  DECLARE v_payment_day TINYINT UNSIGNED;
  DECLARE v_next_payment_date DATE;
  DECLARE v_candidate DATE;
  DECLARE v_candidate_month_first DATE;

  DECLARE cur_overdue CURSOR FOR
    SELECT eo.id, eo.recurring_expense_id, re.responsible_member_id, eo.due_date,
           u.payment_frequency, u.payment_weekday, u.payment_day
    FROM expense_occurrences eo
    INNER JOIN recurring_expenses re ON re.id = eo.recurring_expense_id
    INNER JOIN household_members hm ON hm.id = re.responsible_member_id
    INNER JOIN users u ON u.id = hm.user_id
    WHERE eo.due_date < p_today
      AND eo.is_paid = 0
      AND re.is_active = 1
      AND u.payment_frequency IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM reminder_log rl
        WHERE rl.occurrence_id = eo.id AND rl.member_id = re.responsible_member_id
          AND rl.reminder_type = 'overdue_daily' AND rl.sent_date = p_today
      );

  DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_done = 1;

  DROP TEMPORARY TABLE IF EXISTS tmp_pending_reminders;
  CREATE TEMPORARY TABLE tmp_pending_reminders (
    occurrence_id INT UNSIGNED NOT NULL,
    recurring_expense_id INT UNSIGNED NOT NULL,
    member_id INT UNSIGNED NOT NULL,
    reminder_type ENUM('due_soon', 'overdue_daily', 'withdrawal') NOT NULL
  );

  -- due_soon: unpaid occurrence due tomorrow, not already logged today
  INSERT INTO tmp_pending_reminders (occurrence_id, recurring_expense_id, member_id, reminder_type)
  SELECT eo.id, eo.recurring_expense_id, re.responsible_member_id, 'due_soon'
  FROM expense_occurrences eo
  INNER JOIN recurring_expenses re ON re.id = eo.recurring_expense_id
  WHERE eo.due_date = DATE_ADD(p_today, INTERVAL 1 DAY)
    AND eo.is_paid = 0
    AND re.is_active = 1
    AND NOT EXISTS (
      SELECT 1 FROM reminder_log rl
      WHERE rl.occurrence_id = eo.id AND rl.member_id = re.responsible_member_id
        AND rl.reminder_type = 'due_soon' AND rl.sent_date = p_today
    );

  -- overdue_daily: for each overdue+unpaid occurrence whose responsible member has a
  -- payment schedule configured, compute that member's next payday on/after due_date;
  -- once today reaches that payday, the member has had a chance to pay so we nag daily.
  OPEN cur_overdue;
  read_loop: LOOP
    FETCH cur_overdue INTO v_occurrence_id, v_recurring_expense_id, v_member_id, v_due_date,
      v_payment_frequency, v_payment_weekday, v_payment_day;
    IF v_done = 1 THEN
      LEAVE read_loop;
    END IF;

    IF v_payment_frequency = 'weekly' THEN
      -- WEEKDAY() returns 0=Monday..6=Sunday, matching payment_weekday's 1=Monday..7=Sunday
      -- once shifted by -1; MOD(...,7) after adding 7 keeps the result in 0..6 even when
      -- the raw difference is negative (same formula as occurrence generation).
      SET v_next_payment_date = DATE_ADD(
        v_due_date,
        INTERVAL MOD((v_payment_weekday - 1) - WEEKDAY(v_due_date) + 7, 7) DAY
      );
    ELSEIF v_payment_frequency = 'monthly' THEN
      SET v_candidate = DATE_ADD(
        DATE_SUB(v_due_date, INTERVAL DAY(v_due_date) - 1 DAY),
        INTERVAL LEAST(v_payment_day, DAY(LAST_DAY(v_due_date))) - 1 DAY
      );
      IF v_candidate < v_due_date THEN
        SET v_candidate_month_first = DATE_ADD(LAST_DAY(v_candidate), INTERVAL 1 DAY);
        SET v_candidate = DATE_ADD(
          v_candidate_month_first,
          INTERVAL LEAST(v_payment_day, DAY(LAST_DAY(v_candidate_month_first))) - 1 DAY
        );
      END IF;
      SET v_next_payment_date = v_candidate;
    ELSEIF v_payment_frequency = 'semimonthly' THEN
      -- Fixed paydays on the 15th and the last day of the month. Whichever of
      -- those two falls on/after due_date within the same month always exists
      -- (a due_date on day D<=15 is covered by that month's 15th; D>15 is
      -- covered by that month's last day) so no month-rollover case exists.
      IF DAY(v_due_date) <= 15 THEN
        SET v_next_payment_date = DATE_ADD(
          DATE_SUB(v_due_date, INTERVAL DAY(v_due_date) - 1 DAY),
          INTERVAL 14 DAY
        );
      ELSE
        SET v_next_payment_date = LAST_DAY(v_due_date);
      END IF;
    END IF;

    IF p_today >= v_next_payment_date THEN
      INSERT INTO tmp_pending_reminders (occurrence_id, recurring_expense_id, member_id, reminder_type)
      VALUES (v_occurrence_id, v_recurring_expense_id, v_member_id, 'overdue_daily');
    END IF;
  END LOOP;
  CLOSE cur_overdue;

  -- withdrawal: active weekly/biweekly expense whose withdrawal_day matches today's
  -- day-of-month, joined to its current open (earliest unpaid) occurrence.
  INSERT INTO tmp_pending_reminders (occurrence_id, recurring_expense_id, member_id, reminder_type)
  SELECT eo.id, re.id, re.responsible_member_id, 'withdrawal'
  FROM recurring_expenses re
  INNER JOIN expense_occurrences eo ON eo.id = (
    SELECT eo2.id FROM expense_occurrences eo2
    WHERE eo2.recurring_expense_id = re.id AND eo2.is_paid = 0
    ORDER BY eo2.due_date ASC
    LIMIT 1
  )
  WHERE re.is_active = 1
    AND re.periodicity IN ('weekly', 'biweekly')
    AND re.withdrawal_day = DAY(p_today)
    AND NOT EXISTS (
      SELECT 1 FROM reminder_log rl
      WHERE rl.occurrence_id = eo.id AND rl.member_id = re.responsible_member_id
        AND rl.reminder_type = 'withdrawal' AND rl.sent_date = p_today
    );

  SELECT
    t.reminder_type, t.occurrence_id, t.recurring_expense_id, t.member_id,
    re.name AS expense_name, re.amount, c.symbol AS currency_symbol,
    eo.due_date, hm.display_name AS member_display_name, u.telegram_chat_id
  FROM tmp_pending_reminders t
  INNER JOIN recurring_expenses re ON re.id = t.recurring_expense_id
  INNER JOIN currencies c ON c.id = re.currency_id
  INNER JOIN expense_occurrences eo ON eo.id = t.occurrence_id
  INNER JOIN household_members hm ON hm.id = t.member_id
  INNER JOIN users u ON u.id = hm.user_id;

  DROP TEMPORARY TABLE IF EXISTS tmp_pending_reminders;
END;
