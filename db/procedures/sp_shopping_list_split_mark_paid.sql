DROP PROCEDURE IF EXISTS sp_shopping_list_split_mark_paid;

CREATE PROCEDURE sp_shopping_list_split_mark_paid(
  IN p_split_id INT UNSIGNED,
  IN p_household_id INT UNSIGNED,
  IN p_is_paid TINYINT(1)
)
BEGIN
  DECLARE v_exists INT;

  SELECT COUNT(*) INTO v_exists
  FROM shopping_list_splits sls
  INNER JOIN shopping_lists sl ON sl.id = sls.shopping_list_id
  WHERE sls.id = p_split_id AND sl.household_id = p_household_id;

  IF v_exists = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Split not found in this household';
  END IF;

  UPDATE shopping_list_splits
  SET is_paid = p_is_paid, paid_at = IF(p_is_paid = 1, NOW(), NULL)
  WHERE id = p_split_id;

  SELECT sls.id, sls.shopping_list_id, sls.member_id, hm.display_name, sls.percentage,
         sls.amount_owed, sls.is_paid, sls.paid_at
  FROM shopping_list_splits sls
  INNER JOIN household_members hm ON hm.id = sls.member_id
  WHERE sls.id = p_split_id;
END;
