DROP PROCEDURE IF EXISTS sp_currency_list;

CREATE PROCEDURE sp_currency_list()
BEGIN
  SELECT id, code, name, symbol FROM currencies ORDER BY code;
END;
