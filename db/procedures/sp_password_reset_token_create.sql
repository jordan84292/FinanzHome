DROP PROCEDURE IF EXISTS sp_password_reset_token_create;

CREATE PROCEDURE sp_password_reset_token_create(
  IN p_user_id INT UNSIGNED,
  IN p_token VARCHAR(64),
  IN p_expires_at DATETIME
)
BEGIN
  UPDATE password_reset_tokens
  SET status = 'expired'
  WHERE user_id = p_user_id AND status = 'pending';

  INSERT INTO password_reset_tokens (user_id, token, expires_at)
  VALUES (p_user_id, p_token, p_expires_at);

  SELECT id, user_id, token, status, expires_at, created_at
  FROM password_reset_tokens
  WHERE id = LAST_INSERT_ID();
END;
