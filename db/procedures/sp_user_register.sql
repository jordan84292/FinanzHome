DROP PROCEDURE IF EXISTS sp_user_register;

CREATE PROCEDURE sp_user_register(
  IN p_email VARCHAR(255),
  IN p_password_hash VARCHAR(255),
  IN p_name VARCHAR(150)
)
BEGIN
  INSERT INTO users (email, password_hash, name)
  VALUES (p_email, p_password_hash, p_name);

  SELECT id, email, name, created_at
  FROM users
  WHERE id = LAST_INSERT_ID();
END;
