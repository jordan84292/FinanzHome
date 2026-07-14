DROP PROCEDURE IF EXISTS sp_exchange_rate_history;

CREATE PROCEDURE sp_exchange_rate_history(
  IN p_limit INT UNSIGNED
)
BEGIN
  DECLARE v_limit INT UNSIGNED;
  SET v_limit = COALESCE(p_limit, 20);

  SELECT id, rate_crc_per_usd, effective_date, created_by_member_id, created_at
  FROM exchange_rates
  ORDER BY effective_date DESC, id DESC
  LIMIT v_limit;
END;
