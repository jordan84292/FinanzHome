CREATE TABLE product_categories (
  id SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO product_categories (name) VALUES
  ('Despensa'), ('Limpieza'), ('Higiene personal'), ('Bebidas'), ('Congelados'), ('Otros');

CREATE TABLE units_of_measure (
  id SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(10) NOT NULL UNIQUE,
  name VARCHAR(50) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO units_of_measure (code, name) VALUES
  ('unidad', 'Unidad'), ('kg', 'Kilogramo'), ('g', 'Gramo'),
  ('l', 'Litro'), ('ml', 'Mililitro'), ('paquete', 'Paquete'), ('docena', 'Docena');

CREATE TABLE products (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  household_id INT UNSIGNED NOT NULL,
  name VARCHAR(150) NOT NULL,
  category_id SMALLINT UNSIGNED NOT NULL,
  unit_id SMALLINT UNSIGNED NOT NULL,
  optimal_quantity DECIMAL(10,2) NOT NULL DEFAULT 0,
  current_quantity DECIMAL(10,2) NOT NULL DEFAULT 0,
  default_price DECIMAL(12,2) NULL,
  default_price_currency_id TINYINT UNSIGNED NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_by_member_id INT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_products_household FOREIGN KEY (household_id) REFERENCES households(id),
  CONSTRAINT fk_products_category FOREIGN KEY (category_id) REFERENCES product_categories(id),
  CONSTRAINT fk_products_unit FOREIGN KEY (unit_id) REFERENCES units_of_measure(id),
  CONSTRAINT fk_products_currency FOREIGN KEY (default_price_currency_id) REFERENCES currencies(id),
  CONSTRAINT fk_products_created_by FOREIGN KEY (created_by_member_id) REFERENCES household_members(id),
  CONSTRAINT chk_products_quantities CHECK (optimal_quantity >= 0 AND current_quantity >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
