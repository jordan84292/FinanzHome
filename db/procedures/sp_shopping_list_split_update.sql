DROP PROCEDURE IF EXISTS sp_shopping_list_split_update;

CREATE PROCEDURE sp_shopping_list_split_update(
  IN p_shopping_list_id INT UNSIGNED,
  IN p_household_id INT UNSIGNED,
  IN p_member_id INT UNSIGNED,
  IN p_percentage DECIMAL(5,2)
)
BEGIN
  DECLARE v_exists INT;
  DECLARE v_total DECIMAL(12,2);

  SELECT COUNT(*) INTO v_exists
  FROM shopping_lists
  WHERE id = p_shopping_list_id AND household_id = p_household_id AND status = 'confirmed';

  IF v_exists = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Shopping list not found or not confirmed';
  END IF;

  SELECT COUNT(*) INTO v_exists
  FROM household_members
  WHERE id = p_member_id AND household_id = p_household_id;

  IF v_exists = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Member not found in this household';
  END IF;

  SELECT COUNT(*) INTO v_exists
  FROM shopping_list_splits
  WHERE shopping_list_id = p_shopping_list_id AND member_id = p_member_id;

  IF v_exists = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Split not found for this member';
  END IF;

  SELECT total_estimated INTO v_total
  FROM shopping_lists
  WHERE id = p_shopping_list_id;

  UPDATE shopping_list_splits
  SET percentage = p_percentage,
      amount_owed = ROUND(v_total * p_percentage / 100, 2)
  WHERE shopping_list_id = p_shopping_list_id AND member_id = p_member_id;

  SELECT sls.id, sls.shopping_list_id, sls.member_id, hm.display_name, sls.percentage, sls.amount_owed, sls.is_paid, sls.paid_at
  FROM shopping_list_splits sls
  INNER JOIN household_members hm ON hm.id = sls.member_id
  WHERE sls.shopping_list_id = p_shopping_list_id AND sls.member_id = p_member_id;
END;
