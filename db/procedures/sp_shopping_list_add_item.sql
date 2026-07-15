DROP PROCEDURE IF EXISTS sp_shopping_list_add_item;

CREATE PROCEDURE sp_shopping_list_add_item(
  IN p_shopping_list_id INT UNSIGNED,
  IN p_household_id INT UNSIGNED,
  IN p_product_id INT UNSIGNED,
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

  SELECT COUNT(*) INTO v_exists
  FROM products
  WHERE id = p_product_id AND household_id = p_household_id AND is_active = 1;

  IF v_exists = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Product not found in this household';
  END IF;

  INSERT INTO shopping_list_items (shopping_list_id, product_id, quantity_needed, unit_price, unit_price_currency_id, is_extra)
  VALUES (p_shopping_list_id, p_product_id, p_quantity_needed, p_unit_price, p_unit_price_currency_id, p_is_extra);

  SELECT
    sli.id, sli.shopping_list_id, sli.product_id, p.name AS product_name, u.code AS unit_code,
    sli.quantity_needed, sli.unit_price, sli.unit_price_currency_id, sli.is_extra, sli.is_purchased
  FROM shopping_list_items sli
  INNER JOIN products p ON p.id = sli.product_id
  INNER JOIN units_of_measure u ON u.id = p.unit_id
  WHERE sli.id = LAST_INSERT_ID();
END;
