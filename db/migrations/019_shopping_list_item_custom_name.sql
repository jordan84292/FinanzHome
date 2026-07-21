ALTER TABLE shopping_list_items
  MODIFY COLUMN product_id INT UNSIGNED NULL,
  ADD COLUMN custom_name VARCHAR(150) NULL AFTER product_id,
  ADD CONSTRAINT chk_shopping_list_items_product_or_custom CHECK (product_id IS NOT NULL OR custom_name IS NOT NULL);
