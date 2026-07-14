DROP PROCEDURE IF EXISTS sp_household_invitation_create;

CREATE PROCEDURE sp_household_invitation_create(
  IN p_household_id INT UNSIGNED,
  IN p_email VARCHAR(255),
  IN p_token VARCHAR(64),
  IN p_invited_by_member_id INT UNSIGNED,
  IN p_expires_at DATETIME
)
BEGIN
  INSERT INTO household_invitations (household_id, email, token, invited_by_member_id, expires_at)
  VALUES (p_household_id, p_email, p_token, p_invited_by_member_id, p_expires_at);

  SELECT id, household_id, email, token, status, expires_at, created_at
  FROM household_invitations
  WHERE id = LAST_INSERT_ID();
END;
