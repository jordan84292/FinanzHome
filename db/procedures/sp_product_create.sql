DROP PROCEDURE IF EXISTS sp_product_create;

CREATE PROCEDURE sp_product_create(
  IN p_household_id INT UNSIGNED,
  IN p_name VARCHAR(150),
  IN p_category_id SMALLINT UNSIGNED,
  IN p_unit_id SMALLINT UNSIGNED,
  IN p_optimal_quantity DECIMAL(10,2),
  IN p_current_quantity DECIMAL(10,2),
  IN p_default_price DECIMAL(12,2),
  IN p_default_price_currency_id TINYINT UNSIGNED,
  IN p_created_by_member_id INT UNSIGNED
)
BEGIN
  INSERT INTO products (
    household_id, name, category_id, unit_id, optimal_quantity, current_quantity,
    default_price, default_price_currency_id, created_by_member_id
  ) VALUES (
    p_household_id, p_name, p_category_id, p_unit_id, p_optimal_quantity, p_current_quantity,
    p_default_price, p_default_price_currency_id, p_created_by_member_id
  );

  SELECT
    p.id, p.household_id, p.name, p.category_id, c.name AS category_name,
    p.unit_id, u.code AS unit_code, u.name AS unit_name,
    p.optimal_quantity, p.current_quantity, p.default_price, p.default_price_currency_id,
    p.is_active, p.created_by_member_id, p.created_at
  FROM products p
  INNER JOIN product_categories c ON c.id = p.category_id
  INNER JOIN units_of_measure u ON u.id = p.unit_id
  WHERE p.id = LAST_INSERT_ID();
END;
