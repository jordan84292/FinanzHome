DROP PROCEDURE IF EXISTS sp_product_update_current_quantity;

CREATE PROCEDURE sp_product_update_current_quantity(
  IN p_product_id INT UNSIGNED,
  IN p_current_quantity DECIMAL(10,2)
)
BEGIN
  IF p_current_quantity < 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Current quantity cannot be negative';
  END IF;

  UPDATE products SET current_quantity = p_current_quantity WHERE id = p_product_id;

  SELECT
    p.id, p.household_id, p.name, p.category_id, c.name AS category_name,
    p.unit_id, u.code AS unit_code, u.name AS unit_name,
    p.optimal_quantity, p.current_quantity, p.default_price, p.default_price_currency_id,
    p.is_active, p.created_by_member_id, p.created_at
  FROM products p
  INNER JOIN product_categories c ON c.id = p.category_id
  INNER JOIN units_of_measure u ON u.id = p.unit_id
  WHERE p.id = p_product_id;
END;
