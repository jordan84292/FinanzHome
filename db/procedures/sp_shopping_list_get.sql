DROP PROCEDURE IF EXISTS sp_shopping_list_get;

CREATE PROCEDURE sp_shopping_list_get(
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
    sl.id, sl.household_id, sl.status, sl.is_shared, sl.created_by_member_id,
    sl.total_estimated, sl.total_estimated_currency_id, sl.created_at, sl.confirmed_at,
    (
      SELECT ROUND(SUM(
        sli.quantity_needed * IFNULL(sli.unit_price, 0) *
        CASE
          WHEN sli.unit_price_currency_id IS NULL OR sli.unit_price_currency_id = p_display_currency_id THEN 1
          WHEN sli.unit_price_currency_id = 2 THEN IFNULL(v_rate, 1)
          WHEN sli.unit_price_currency_id = 1 THEN 1 / IFNULL(v_rate, 1)
          ELSE 1
        END
      ), 2)
      FROM shopping_list_items sli
      WHERE sli.shopping_list_id = sl.id
    ) AS total_estimated_live
  FROM shopping_lists sl
  WHERE sl.id = p_shopping_list_id;
END;
