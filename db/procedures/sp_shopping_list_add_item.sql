DROP PROCEDURE IF EXISTS sp_shopping_list_add_item;

-- Manual additions from the "Producto" button are always one-off custom
-- items for this specific purchase (product_id stays NULL) — the list
-- itself is already auto-populated from inventory deficits by
-- sp_shopping_list_generate, which is the only path that sets product_id.
CREATE PROCEDURE sp_shopping_list_add_item(
  IN p_shopping_list_id INT UNSIGNED,
  IN p_household_id INT UNSIGNED,
  IN p_custom_name VARCHAR(150),
  IN p_quantity_needed DECIMAL(10,2),
  IN p_unit_price DECIMAL(12,2),
  IN p_unit_price_currency_id TINYINT UNSIGNED,
  IN p_is_extra TINYINT(1)
)
BEGIN
  DECLARE v_exists INT;

  SELECT COUNT(*) INTO v_exists
  FROM shopping_lists
  WHERE id = p_shopping_list_id AND household_id = p_household_id AND status = 'open';

  IF v_exists = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Shopping list not found or not open';
  END IF;

  IF p_custom_name IS NULL OR TRIM(p_custom_name) = '' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Custom product name is required';
  END IF;

  INSERT INTO shopping_list_items (shopping_list_id, custom_name, quantity_needed, unit_price, unit_price_currency_id, is_extra)
  VALUES (p_shopping_list_id, p_custom_name, p_quantity_needed, p_unit_price, p_unit_price_currency_id, p_is_extra);

  SELECT
    sli.id, sli.shopping_list_id, sli.product_id, sli.custom_name,
    COALESCE(p.name, sli.custom_name) AS product_name, u.code AS unit_code,
    sli.quantity_needed, sli.unit_price, sli.unit_price_currency_id, sli.is_extra, sli.is_purchased
  FROM shopping_list_items sli
  LEFT JOIN products p ON p.id = sli.product_id
  LEFT JOIN units_of_measure u ON u.id = p.unit_id
  WHERE sli.id = LAST_INSERT_ID();
END;
