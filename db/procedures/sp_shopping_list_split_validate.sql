DROP PROCEDURE IF EXISTS sp_shopping_list_split_validate;

CREATE PROCEDURE sp_shopping_list_split_validate(
  IN p_shopping_list_id INT UNSIGNED,
  IN p_household_id INT UNSIGNED
)
BEGIN
  DECLARE v_exists INT;
  DECLARE v_sum DECIMAL(6,2);

  SELECT COUNT(*) INTO v_exists
  FROM shopping_lists
  WHERE id = p_shopping_list_id AND household_id = p_household_id AND status = 'confirmed';

  IF v_exists = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Shopping list not found or not confirmed';
  END IF;

  SELECT SUM(percentage) INTO v_sum
  FROM shopping_list_splits
  WHERE shopping_list_id = p_shopping_list_id;

  IF v_sum IS NULL OR v_sum <> 100.00 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Split percentages must sum to 100';
  END IF;

  SELECT sls.id, sls.shopping_list_id, sls.member_id, hm.display_name, sls.percentage, sls.amount_owed
  FROM shopping_list_splits sls
  INNER JOIN household_members hm ON hm.id = sls.member_id
  WHERE sls.shopping_list_id = p_shopping_list_id
  ORDER BY hm.id ASC;
END;
