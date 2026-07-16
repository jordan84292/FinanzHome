DROP PROCEDURE IF EXISTS sp_shopping_list_split_get;

CREATE PROCEDURE sp_shopping_list_split_get(
  IN p_shopping_list_id INT UNSIGNED,
  IN p_household_id INT UNSIGNED
)
BEGIN
  DECLARE v_exists INT;

  SELECT COUNT(*) INTO v_exists
  FROM shopping_lists
  WHERE id = p_shopping_list_id AND household_id = p_household_id;

  IF v_exists = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Shopping list not found in this household';
  END IF;

  SELECT sls.id, sls.shopping_list_id, sls.member_id, hm.display_name, sls.percentage, sls.amount_owed
  FROM shopping_list_splits sls
  INNER JOIN household_members hm ON hm.id = sls.member_id
  WHERE sls.shopping_list_id = p_shopping_list_id
  ORDER BY hm.id ASC;
END;
