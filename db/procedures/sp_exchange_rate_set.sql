DROP PROCEDURE IF EXISTS sp_exchange_rate_set;

CREATE PROCEDURE sp_exchange_rate_set(
  IN p_rate_crc_per_usd DECIMAL(12,4),
  IN p_effective_date DATE,
  IN p_created_by_member_id INT UNSIGNED
)
BEGIN
  IF p_rate_crc_per_usd <= 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Exchange rate must be positive';
  END IF;

  INSERT INTO exchange_rates (rate_crc_per_usd, effective_date, created_by_member_id)
  VALUES (p_rate_crc_per_usd, p_effective_date, p_created_by_member_id);

  SELECT id, rate_crc_per_usd, effective_date, created_by_member_id, created_at
  FROM exchange_rates
  WHERE id = LAST_INSERT_ID();
END;
