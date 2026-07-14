DROP PROCEDURE IF EXISTS sp_product_deactivate;

CREATE PROCEDURE sp_product_deactivate(
  IN p_product_id INT UNSIGNED,
  IN p_household_id INT UNSIGNED
)
BEGIN
  DECLARE v_exists INT;

  SELECT COUNT(*) INTO v_exists FROM products WHERE id = p_product_id AND household_id = p_household_id;
  IF v_exists = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Product not found in this household';
  END IF;

  UPDATE products SET is_active = 0 WHERE id = p_product_id;
END;
