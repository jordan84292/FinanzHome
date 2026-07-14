DROP PROCEDURE IF EXISTS sp_household_create;

CREATE PROCEDURE sp_household_create(
  IN p_name VARCHAR(150),
  IN p_creator_user_id INT UNSIGNED,
  IN p_creator_display_name VARCHAR(150),
  IN p_creator_payment_day TINYINT UNSIGNED
)
BEGIN
  DECLARE v_household_id INT UNSIGNED;

  INSERT INTO households (name) VALUES (p_name);
  SET v_household_id = LAST_INSERT_ID();

  INSERT INTO household_members (household_id, user_id, display_name, payment_day, role)
  VALUES (v_household_id, p_creator_user_id, p_creator_display_name, p_creator_payment_day, 'owner');

  SELECT id, name, created_at FROM households WHERE id = v_household_id;
END;
