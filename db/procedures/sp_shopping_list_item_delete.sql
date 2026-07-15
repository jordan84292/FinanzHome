DROP PROCEDURE IF EXISTS sp_shopping_list_item_delete;

CREATE PROCEDURE sp_shopping_list_item_delete(
  IN p_item_id INT UNSIGNED,
  IN p_household_id INT UNSIGNED
)
BEGIN
  DECLARE v_exists INT;

  SELECT COUNT(*) INTO v_exists
  FROM shopping_list_items sli
  INNER JOIN shopping_lists sl ON sl.id = sli.shopping_list_id
  WHERE sli.id = p_item_id AND sl.household_id = p_household_id AND sl.status = 'open';

  IF v_exists = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Item not found in this household or list is not open';
  END IF;

  DELETE FROM shopping_list_items WHERE id = p_item_id;
END;
