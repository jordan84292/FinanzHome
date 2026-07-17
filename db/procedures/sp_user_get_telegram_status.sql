DROP PROCEDURE IF EXISTS sp_user_get_telegram_status;

CREATE PROCEDURE sp_user_get_telegram_status(
  IN p_user_id INT UNSIGNED
)
BEGIN
  SELECT
    (telegram_chat_id IS NOT NULL) AS is_linked,
    telegram_chat_id
  FROM users
  WHERE id = p_user_id;
END;
