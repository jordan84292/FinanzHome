DROP PROCEDURE IF EXISTS sp_expense_category_list;

CREATE PROCEDURE sp_expense_category_list()
BEGIN
  SELECT id, name FROM expense_categories ORDER BY name;
END;
