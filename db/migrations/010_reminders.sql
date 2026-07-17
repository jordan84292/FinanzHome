ALTER TABLE users
  ADD COLUMN telegram_chat_id BIGINT NULL AFTER payment_day,
  ADD COLUMN telegram_link_token VARCHAR(64) NULL UNIQUE AFTER telegram_chat_id;

CREATE TABLE reminder_log (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  occurrence_id INT UNSIGNED NOT NULL,
  member_id INT UNSIGNED NOT NULL,
  reminder_type ENUM('due_soon', 'overdue_daily', 'withdrawal') NOT NULL,
  sent_date DATE NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_reminder_log_occurrence FOREIGN KEY (occurrence_id) REFERENCES expense_occurrences(id),
  CONSTRAINT fk_reminder_log_member FOREIGN KEY (member_id) REFERENCES household_members(id),
  CONSTRAINT uq_reminder_log_send UNIQUE (occurrence_id, member_id, reminder_type, sent_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
