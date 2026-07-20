ALTER TABLE reminder_log
  MODIFY COLUMN reminder_type ENUM('due_soon', 'due_today', 'overdue_daily', 'withdrawal') NOT NULL;
