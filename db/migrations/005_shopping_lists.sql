CREATE TABLE shopping_lists (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  household_id INT UNSIGNED NOT NULL,
  status ENUM('open', 'confirmed', 'cancelled') NOT NULL DEFAULT 'open',
  created_by_member_id INT UNSIGNED NOT NULL,
  total_estimated DECIMAL(12,2) NULL,
  total_estimated_currency_id TINYINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  confirmed_at DATETIME NULL,
  CONSTRAINT fk_shopping_lists_household FOREIGN KEY (household_id) REFERENCES households(id),
  CONSTRAINT fk_shopping_lists_created_by FOREIGN KEY (created_by_member_id) REFERENCES household_members(id),
  CONSTRAINT fk_shopping_lists_currency FOREIGN KEY (total_estimated_currency_id) REFERENCES currencies(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE shopping_list_items (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  shopping_list_id INT UNSIGNED NOT NULL,
  product_id INT UNSIGNED NOT NULL,
  quantity_needed DECIMAL(10,2) NOT NULL,
  unit_price DECIMAL(12,2) NULL,
  unit_price_currency_id TINYINT UNSIGNED NULL,
  is_extra TINYINT(1) NOT NULL DEFAULT 0,
  is_purchased TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_shopping_list_items_list FOREIGN KEY (shopping_list_id) REFERENCES shopping_lists(id),
  CONSTRAINT fk_shopping_list_items_product FOREIGN KEY (product_id) REFERENCES products(id),
  CONSTRAINT fk_shopping_list_items_currency FOREIGN KEY (unit_price_currency_id) REFERENCES currencies(id),
  CONSTRAINT chk_shopping_list_items_quantity CHECK (quantity_needed > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
