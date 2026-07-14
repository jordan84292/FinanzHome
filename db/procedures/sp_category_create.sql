DROP PROCEDURE IF EXISTS sp_category_create;

CREATE PROCEDURE sp_category_create(
  IN p_name VARCHAR(100)
)
BEGIN
  INSERT INTO product_categories (name) VALUES (p_name);
  SELECT id, name FROM product_categories WHERE id = LAST_INSERT_ID();
END;
