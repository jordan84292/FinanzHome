DROP PROCEDURE IF EXISTS sp_household_member_list;

CREATE PROCEDURE sp_household_member_list(
  IN p_household_id INT UNSIGNED
)
BEGIN
  SELECT id, household_id, user_id, display_name, role, joined_at
  FROM household_members
  WHERE household_id = p_household_id
  ORDER BY joined_at ASC;
END;
