DROP PROCEDURE IF EXISTS sp_shopping_list_item_update;

CREATE PROCEDURE sp_shopping_list_item_update(
  IN p_item_id INT UNSIGNED,
  IN p_household_id INT UNSIGNED,
  IN p_quantity_needed DECIMAL(10,2),
  IN p_unit_price DECIMAL(12,2),
  IN p_unit_price_currency_id TINYINT UNSIGNED
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

  UPDATE shopping_list_items
  SET quantity_needed = p_quantity_needed,
      unit_price = p_unit_price,
      unit_price_currency_id = p_unit_price_currency_id
  WHERE id = p_item_id;

  SELECT
    sli.id, sli.shopping_list_id, sli.product_id, p.name AS product_name, u.code AS unit_code,
    sli.quantity_needed, sli.unit_price, sli.unit_price_currency_id, sli.is_extra, sli.is_purchased
  FROM shopping_list_items sli
  INNER JOIN products p ON p.id = sli.product_id
  INNER JOIN units_of_measure u ON u.id = p.unit_id
  WHERE sli.id = p_item_id;
END;
