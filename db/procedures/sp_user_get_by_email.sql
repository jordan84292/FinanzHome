DROP PROCEDURE IF EXISTS sp_user_get_by_email;

CREATE PROCEDURE sp_user_get_by_email(
  IN p_email VARCHAR(255)
)
BEGIN
  SELECT id, email, password_hash, name, created_at
  FROM users
  WHERE email = p_email;
END;
