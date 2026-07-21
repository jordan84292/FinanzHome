DROP PROCEDURE IF EXISTS sp_shopping_list_items_get;

CREATE PROCEDURE sp_shopping_list_items_get(
  IN p_shopping_list_id INT UNSIGNED,
  IN p_household_id INT UNSIGNED,
  IN p_display_currency_id TINYINT UNSIGNED
)
BEGIN
  DECLARE v_exists INT;
  DECLARE v_rate DECIMAL(12,4);

  SELECT COUNT(*) INTO v_exists
  FROM shopping_lists
  WHERE id = p_shopping_list_id AND household_id = p_household_id;

  IF v_exists = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Shopping list not found in this household';
  END IF;

  SELECT rate_crc_per_usd INTO v_rate
  FROM exchange_rates
  WHERE effective_date <= CURDATE()
  ORDER BY effective_date DESC, id DESC
  LIMIT 1;

  SELECT
    sli.id, sli.shopping_list_id, sli.product_id, sli.custom_name,
    COALESCE(p.name, sli.custom_name) AS product_name, u.code AS unit_code,
    sli.quantity_needed, sli.unit_price, sli.unit_price_currency_id,
    c.code AS unit_price_currency_code, c.symbol AS unit_price_currency_symbol,
    sli.is_extra, sli.is_purchased,
    ROUND(
      sli.quantity_needed * IFNULL(sli.unit_price, 0) *
      CASE
        WHEN sli.unit_price_currency_id IS NULL OR sli.unit_price_currency_id = p_display_currency_id THEN 1
        WHEN sli.unit_price_currency_id = 2 THEN IFNULL(v_rate, 1)
        WHEN sli.unit_price_currency_id = 1 THEN 1 / IFNULL(v_rate, 1)
        ELSE 1
      END,
    2) AS subtotal_in_display_currency
  FROM shopping_list_items sli
  LEFT JOIN products p ON p.id = sli.product_id
  LEFT JOIN units_of_measure u ON u.id = p.unit_id
  LEFT JOIN currencies c ON c.id = sli.unit_price_currency_id
  WHERE sli.shopping_list_id = p_shopping_list_id
  ORDER BY sli.is_extra, COALESCE(p.name, sli.custom_name);
END;
