DROP PROCEDURE IF EXISTS sp_user_set_telegram_link_token;

CREATE PROCEDURE sp_user_set_telegram_link_token(
  IN p_user_id INT UNSIGNED,
  IN p_token VARCHAR(64)
)
BEGIN
  UPDATE users SET telegram_link_token = p_token WHERE id = p_user_id;
END;
