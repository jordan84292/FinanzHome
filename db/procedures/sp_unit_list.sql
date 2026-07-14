DROP PROCEDURE IF EXISTS sp_unit_list;

CREATE PROCEDURE sp_unit_list()
BEGIN
  SELECT id, code, name FROM units_of_measure ORDER BY name;
END;
