DROP PROCEDURE IF EXISTS sp_shopping_list_generate;

CREATE PROCEDURE sp_shopping_list_generate(
  IN p_household_id INT UNSIGNED,
  IN p_created_by_member_id INT UNSIGNED
)
BEGIN
  DECLARE v_list_id INT UNSIGNED;
  DECLARE v_open_count INT;

  SELECT COUNT(*), MIN(id) INTO v_open_count, v_list_id
  FROM shopping_lists
  WHERE household_id = p_household_id AND status = 'open';

  IF v_open_count = 0 THEN
    INSERT INTO shopping_lists (household_id, status, created_by_member_id)
    VALUES (p_household_id, 'open', p_created_by_member_id);
    SET v_list_id = LAST_INSERT_ID();
  END IF;

  -- Re-scan on every call (not just list creation) so products that become
  -- deficient after the list already exists still show up as faltantes,
  -- without touching items already on the list (manual edits, purchases).
  INSERT INTO shopping_list_items (shopping_list_id, product_id, quantity_needed, unit_price, unit_price_currency_id, is_extra)
  SELECT v_list_id, p.id, (p.optimal_quantity - p.current_quantity), p.default_price, p.default_price_currency_id, 0
  FROM products p
  WHERE p.household_id = p_household_id AND p.is_active = 1 AND p.optimal_quantity > p.current_quantity
    AND NOT EXISTS (
      SELECT 1 FROM shopping_list_items sli
      WHERE sli.shopping_list_id = v_list_id AND sli.product_id = p.id
    );

  SELECT id, household_id, status, is_shared, created_by_member_id, total_estimated, total_actual, total_estimated_currency_id, created_at, confirmed_at
  FROM shopping_lists
  WHERE id = v_list_id;
END;
