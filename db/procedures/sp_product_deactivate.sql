DROP PROCEDURE IF EXISTS sp_product_deactivate;

CREATE PROCEDURE sp_product_deactivate(
  IN p_product_id INT UNSIGNED
)
BEGIN
  UPDATE products SET is_active = 0 WHERE id = p_product_id;
END;
