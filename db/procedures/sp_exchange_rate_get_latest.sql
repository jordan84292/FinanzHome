DROP PROCEDURE IF EXISTS sp_exchange_rate_get_latest;

CREATE PROCEDURE sp_exchange_rate_get_latest(
  IN p_as_of_date DATE
)
BEGIN
  DECLARE v_as_of_date DATE;
  SET v_as_of_date = COALESCE(p_as_of_date, CURDATE());

  SELECT id, rate_crc_per_usd, effective_date, created_by_member_id, created_at
  FROM exchange_rates
  WHERE effective_date <= v_as_of_date
  ORDER BY effective_date DESC, id DESC
  LIMIT 1;
END;
