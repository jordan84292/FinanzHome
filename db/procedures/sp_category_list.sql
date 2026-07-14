DROP PROCEDURE IF EXISTS sp_category_list;

CREATE PROCEDURE sp_category_list()
BEGIN
  SELECT id, name FROM product_categories ORDER BY name;
END;
