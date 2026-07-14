DROP PROCEDURE IF EXISTS sp_product_list;

CREATE PROCEDURE sp_product_list(
  IN p_household_id INT UNSIGNED
)
BEGIN
  SELECT
    p.id, p.household_id, p.name, p.category_id, c.name AS category_name,
    p.unit_id, u.code AS unit_code, u.name AS unit_name,
    p.optimal_quantity, p.current_quantity, p.default_price, p.default_price_currency_id,
    p.is_active, p.created_by_member_id, p.created_at
  FROM products p
  INNER JOIN product_categories c ON c.id = p.category_id
  INNER JOIN units_of_measure u ON u.id = p.unit_id
  WHERE p.household_id = p_household_id AND p.is_active = 1
  ORDER BY c.name, p.name;
END;
