DROP PROCEDURE IF EXISTS sp_reminder_get_pending;

CREATE PROCEDURE sp_reminder_get_pending(
  IN p_today DATE
)
BEGIN
  DROP TEMPORARY TABLE IF EXISTS tmp_pending_reminders;
  -- id/PRIMARY KEY exists only to satisfy hosts that enforce
  -- sql_require_primary_key (e.g. Aiven) on every table including TEMPORARY
  -- ones; nothing in this procedure reads it.
  CREATE TEMPORARY TABLE tmp_pending_reminders (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    occurrence_id INT UNSIGNED NOT NULL,
    recurring_expense_id INT UNSIGNED NOT NULL,
    member_id INT UNSIGNED NOT NULL,
    reminder_type ENUM('due_week', 'due_soon', 'due_today', 'overdue_daily', 'withdrawal') NOT NULL
  );

  -- due_week: unpaid occurrence due in exactly 7 days, not already logged today
  INSERT INTO tmp_pending_reminders (occurrence_id, recurring_expense_id, member_id, reminder_type)
  SELECT eo.id, eo.recurring_expense_id, re.responsible_member_id, 'due_week'
  FROM expense_occurrences eo
  INNER JOIN recurring_expenses re ON re.id = eo.recurring_expense_id
  WHERE eo.due_date = DATE_ADD(p_today, INTERVAL 7 DAY)
    AND eo.is_paid = 0
    AND re.is_active = 1
    AND NOT EXISTS (
      SELECT 1 FROM reminder_log rl
      WHERE rl.occurrence_id = eo.id AND rl.member_id = re.responsible_member_id
        AND rl.reminder_type = 'due_week' AND rl.sent_date = p_today
    )
    -- shared one_time expenses use per-member payment tracking instead of a
    -- single mark-paid action, and are deliberately excluded from every
    -- automatic reminder (see sp_expense_occurrence_share_mark_paid).
    AND NOT (re.periodicity = 'one_time' AND EXISTS (
      SELECT 1 FROM recurring_expense_shares res WHERE res.recurring_expense_id = re.id
    ));

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
    )
    AND NOT (re.periodicity = 'one_time' AND EXISTS (
      SELECT 1 FROM recurring_expense_shares res WHERE res.recurring_expense_id = re.id
    ));

  -- due_today: unpaid occurrence due today, not already logged today
  INSERT INTO tmp_pending_reminders (occurrence_id, recurring_expense_id, member_id, reminder_type)
  SELECT eo.id, eo.recurring_expense_id, re.responsible_member_id, 'due_today'
  FROM expense_occurrences eo
  INNER JOIN recurring_expenses re ON re.id = eo.recurring_expense_id
  WHERE eo.due_date = p_today
    AND eo.is_paid = 0
    AND re.is_active = 1
    AND NOT EXISTS (
      SELECT 1 FROM reminder_log rl
      WHERE rl.occurrence_id = eo.id AND rl.member_id = re.responsible_member_id
        AND rl.reminder_type = 'due_today' AND rl.sent_date = p_today
    )
    AND NOT (re.periodicity = 'one_time' AND EXISTS (
      SELECT 1 FROM recurring_expense_shares res WHERE res.recurring_expense_id = re.id
    ));

  -- overdue_daily: any unpaid occurrence past its due date, every day, until
  -- it's marked paid. Previously waited for the responsible member's next
  -- configured payday before nagging — dropped per explicit request: simpler
  -- and more predictable to just nag daily from the day after due_date.
  INSERT INTO tmp_pending_reminders (occurrence_id, recurring_expense_id, member_id, reminder_type)
  SELECT eo.id, eo.recurring_expense_id, re.responsible_member_id, 'overdue_daily'
  FROM expense_occurrences eo
  INNER JOIN recurring_expenses re ON re.id = eo.recurring_expense_id
  WHERE eo.due_date < p_today
    AND eo.is_paid = 0
    AND re.is_active = 1
    AND NOT EXISTS (
      SELECT 1 FROM reminder_log rl
      WHERE rl.occurrence_id = eo.id AND rl.member_id = re.responsible_member_id
        AND rl.reminder_type = 'overdue_daily' AND rl.sent_date = p_today
    )
    AND NOT (re.periodicity = 'one_time' AND EXISTS (
      SELECT 1 FROM recurring_expense_shares res WHERE res.recurring_expense_id = re.id
    ));

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
