DROP PROCEDURE IF EXISTS sp_password_reset_token_check;

CREATE PROCEDURE sp_password_reset_token_check(
  IN p_token VARCHAR(64)
)
BEGIN
  DECLARE v_user_id INT UNSIGNED;
  DECLARE v_status VARCHAR(20);
  DECLARE v_expires_at DATETIME;

  SELECT user_id, status, expires_at INTO v_user_id, v_status, v_expires_at
  FROM password_reset_tokens
  WHERE token = p_token
  LIMIT 1;

  IF v_user_id IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Reset token not found';
  ELSEIF v_status <> 'pending' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Reset token is not pending';
  ELSEIF v_expires_at < NOW() THEN
    UPDATE password_reset_tokens SET status = 'expired' WHERE token = p_token;
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Reset token has expired';
  END IF;

  SELECT id, user_id, token, status, expires_at, created_at
  FROM password_reset_tokens
  WHERE token = p_token;
END;
