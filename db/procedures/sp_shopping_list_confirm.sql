DROP PROCEDURE IF EXISTS sp_shopping_list_confirm;

CREATE PROCEDURE sp_shopping_list_confirm(
  IN p_shopping_list_id INT UNSIGNED,
  IN p_household_id INT UNSIGNED,
  IN p_items_json JSON,
  IN p_display_currency_id TINYINT UNSIGNED
)
BEGIN
  DECLARE v_exists INT;
  DECLARE v_len INT;
  DECLARE v_i INT DEFAULT 0;
  DECLARE v_item_id INT UNSIGNED;
  DECLARE v_quantity DECIMAL(10,2);
  DECLARE v_unit_price DECIMAL(12,2);
  DECLARE v_unit_price_currency_id TINYINT UNSIGNED;
  DECLARE v_product_id INT UNSIGNED;
  DECLARE v_rate DECIMAL(12,4);
  DECLARE v_total DECIMAL(12,2) DEFAULT 0;

  SELECT COUNT(*) INTO v_exists
  FROM shopping_lists
  WHERE id = p_shopping_list_id AND household_id = p_household_id AND status = 'open';

  IF v_exists = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Shopping list not found or already confirmed';
  END IF;

  SELECT rate_crc_per_usd INTO v_rate
  FROM exchange_rates
  WHERE effective_date <= CURDATE()
  ORDER BY effective_date DESC, id DESC
  LIMIT 1;

  SET v_len = JSON_LENGTH(p_items_json);

  WHILE v_i < v_len DO
    -- NOTE: JSON_VALUE (not JSON_EXTRACT) for these scalar CASTs. Verified against
    -- MariaDB 10.4.32 that CAST(JSON_EXTRACT(<json null>) AS UNSIGNED/DECIMAL) yields
    -- 0 / 0.00, not SQL NULL (JSON_EXTRACT('null') -> the string 'null' -> non-numeric
    -- string conversion -> 0). That silently wrote unit_price_currency_id = 0 for items
    -- with no price/currency (e.g. a product with no default price), violating the
    -- currencies FK. JSON_VALUE correctly yields SQL NULL for a JSON null and is
    -- otherwise equivalent for scalar extraction.
    SET v_item_id = CAST(JSON_VALUE(p_items_json, CONCAT('$[', v_i, '].itemId')) AS UNSIGNED);
    SET v_quantity = CAST(JSON_VALUE(p_items_json, CONCAT('$[', v_i, '].quantity')) AS DECIMAL(10,2));
    SET v_unit_price = CAST(JSON_VALUE(p_items_json, CONCAT('$[', v_i, '].unitPrice')) AS DECIMAL(12,2));
    SET v_unit_price_currency_id = CAST(JSON_VALUE(p_items_json, CONCAT('$[', v_i, '].unitPriceCurrencyId')) AS UNSIGNED);

    SET v_product_id = NULL;
    SELECT product_id INTO v_product_id
    FROM shopping_list_items
    WHERE id = v_item_id AND shopping_list_id = p_shopping_list_id;

    IF v_product_id IS NULL THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Item does not belong to this shopping list';
    END IF;

    UPDATE shopping_list_items
    SET quantity_needed = v_quantity,
        unit_price = v_unit_price,
        unit_price_currency_id = v_unit_price_currency_id,
        is_purchased = 1
    WHERE id = v_item_id;

    UPDATE products
    SET current_quantity = current_quantity + v_quantity
    WHERE id = v_product_id;

    SET v_total = v_total + ROUND(
      v_quantity * IFNULL(v_unit_price, 0) *
      CASE
        WHEN v_unit_price_currency_id IS NULL OR v_unit_price_currency_id = p_display_currency_id THEN 1
        WHEN v_unit_price_currency_id = 2 THEN IFNULL(v_rate, 1)
        WHEN v_unit_price_currency_id = 1 THEN 1 / IFNULL(v_rate, 1)
        ELSE 1
      END,
    2);

    SET v_i = v_i + 1;
  END WHILE;

  UPDATE shopping_lists
  SET status = 'confirmed',
      total_estimated = v_total,
      total_estimated_currency_id = p_display_currency_id,
      confirmed_at = NOW()
  WHERE id = p_shopping_list_id;

  SELECT id, household_id, status, created_by_member_id, total_estimated, total_estimated_currency_id, created_at, confirmed_at
  FROM shopping_lists
  WHERE id = p_shopping_list_id;
END;
