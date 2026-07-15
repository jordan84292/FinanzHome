DROP PROCEDURE IF EXISTS sp_user_get_profile;

CREATE PROCEDURE sp_user_get_profile(
  IN p_user_id INT UNSIGNED
)
BEGIN
  SELECT id, email, name, payment_frequency, payment_weekday, payment_day
  FROM users
  WHERE id = p_user_id;
END;
