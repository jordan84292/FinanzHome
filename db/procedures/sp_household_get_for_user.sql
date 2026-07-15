DROP PROCEDURE IF EXISTS sp_household_get_for_user;

CREATE PROCEDURE sp_household_get_for_user(
  IN p_user_id INT UNSIGNED
)
BEGIN
  SELECT h.id, h.name, h.created_at, hm.id AS member_id, hm.display_name, hm.role
  FROM households h
  INNER JOIN household_members hm ON hm.household_id = h.id
  WHERE hm.user_id = p_user_id;
END;
