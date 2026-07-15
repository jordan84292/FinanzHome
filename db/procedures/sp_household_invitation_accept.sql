DROP PROCEDURE IF EXISTS sp_household_invitation_accept;

CREATE PROCEDURE sp_household_invitation_accept(
  IN p_token VARCHAR(64),
  IN p_user_id INT UNSIGNED,
  IN p_display_name VARCHAR(150)
)
BEGIN
  DECLARE v_household_id INT UNSIGNED;
  DECLARE v_status VARCHAR(20);
  DECLARE v_expires_at DATETIME;

  SELECT household_id, status, expires_at
  INTO v_household_id, v_status, v_expires_at
  FROM household_invitations
  WHERE token = p_token
  LIMIT 1;

  IF v_household_id IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Invitation not found';
  ELSEIF v_status <> 'pending' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Invitation is not pending';
  ELSEIF v_expires_at < NOW() THEN
    UPDATE household_invitations SET status = 'expired' WHERE token = p_token;
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Invitation has expired';
  END IF;

  INSERT INTO household_members (household_id, user_id, display_name, role)
  VALUES (v_household_id, p_user_id, p_display_name, 'member');

  UPDATE household_invitations SET status = 'accepted' WHERE token = p_token;

  SELECT id, household_id, user_id, display_name, role, joined_at
  FROM household_members
  WHERE household_id = v_household_id AND user_id = p_user_id;
END;
