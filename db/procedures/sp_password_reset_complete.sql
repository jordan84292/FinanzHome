DROP PROCEDURE IF EXISTS sp_password_reset_complete;

CREATE PROCEDURE sp_password_reset_complete(
  IN p_token VARCHAR(64),
  IN p_new_password_hash VARCHAR(255)
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

  UPDATE users SET password_hash = p_new_password_hash WHERE id = v_user_id;
  UPDATE password_reset_tokens SET status = 'used' WHERE token = p_token;

  SELECT id, email, name FROM users WHERE id = v_user_id;
END;
