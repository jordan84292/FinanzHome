DROP PROCEDURE IF EXISTS sp_reminder_log_sent;

CREATE PROCEDURE sp_reminder_log_sent(
  IN p_occurrence_id INT UNSIGNED,
  IN p_member_id INT UNSIGNED,
  IN p_reminder_type ENUM('due_soon', 'overdue_daily', 'withdrawal'),
  IN p_sent_date DATE
)
BEGIN
  INSERT IGNORE INTO reminder_log (occurrence_id, member_id, reminder_type, sent_date)
  VALUES (p_occurrence_id, p_member_id, p_reminder_type, p_sent_date);
END;
