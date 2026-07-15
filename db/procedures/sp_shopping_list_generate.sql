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

    INSERT INTO shopping_list_items (shopping_list_id, product_id, quantity_needed, unit_price, unit_price_currency_id, is_extra)
    SELECT v_list_id, id, (optimal_quantity - current_quantity), default_price, default_price_currency_id, 0
    FROM products
    WHERE household_id = p_household_id AND is_active = 1 AND optimal_quantity > current_quantity;
  END IF;

  SELECT id, household_id, status, created_by_member_id, total_estimated, total_estimated_currency_id, created_at, confirmed_at
  FROM shopping_lists
  WHERE id = v_list_id;
END;
