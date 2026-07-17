DROP PROCEDURE IF EXISTS sp_expense_category_create;

CREATE PROCEDURE sp_expense_category_create(
  IN p_name VARCHAR(100)
)
BEGIN
  INSERT INTO expense_categories (name) VALUES (p_name);
  SELECT id, name FROM expense_categories WHERE id = LAST_INSERT_ID();
END;
