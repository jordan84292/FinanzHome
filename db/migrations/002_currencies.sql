CREATE TABLE currencies (
  id TINYINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(3) NOT NULL UNIQUE,
  name VARCHAR(50) NOT NULL,
  symbol VARCHAR(5) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO currencies (code, name, symbol) VALUES
  ('CRC', 'Colón costarricense', '₡'),
  ('USD', 'Dólar estadounidense', '$');

ALTER TABLE households
  ADD COLUMN default_currency_id TINYINT UNSIGNED NULL AFTER name,
  ADD CONSTRAINT fk_households_default_currency FOREIGN KEY (default_currency_id) REFERENCES currencies(id);

CREATE TABLE exchange_rates (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  rate_crc_per_usd DECIMAL(12,4) NOT NULL,
  effective_date DATE NOT NULL,
  created_by_member_id INT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_exchange_rates_member FOREIGN KEY (created_by_member_id) REFERENCES household_members(id),
  INDEX idx_exchange_rates_effective_date (effective_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
