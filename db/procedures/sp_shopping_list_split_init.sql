DROP PROCEDURE IF EXISTS sp_shopping_list_split_init;

CREATE PROCEDURE sp_shopping_list_split_init(
  IN p_shopping_list_id INT UNSIGNED,
  IN p_household_id INT UNSIGNED
)
BEGIN
  DECLARE v_exists INT;
  DECLARE v_already_split INT;
  DECLARE v_member_count INT;
  DECLARE v_total DECIMAL(12,2);
  DECLARE v_base_percentage DECIMAL(5,2);
  DECLARE v_remainder DECIMAL(5,2);
  DECLARE v_percentage DECIMAL(5,2);
  DECLARE v_member_id INT UNSIGNED;
  DECLARE v_is_first TINYINT DEFAULT 1;
  DECLARE v_done INT DEFAULT 0;
  DECLARE v_amount_sum DECIMAL(12,2);
  DECLARE v_amount_diff DECIMAL(12,2);
  DECLARE v_member_cursor CURSOR FOR
    SELECT id FROM household_members WHERE household_id = p_household_id ORDER BY id ASC;
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_done = 1;

  SELECT COUNT(*) INTO v_exists
  FROM shopping_lists
  WHERE id = p_shopping_list_id AND household_id = p_household_id AND status = 'confirmed';

  IF v_exists = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Shopping list not found or not confirmed';
  END IF;

  SELECT COUNT(*) INTO v_already_split
  FROM shopping_list_splits
  WHERE shopping_list_id = p_shopping_list_id;

  IF v_already_split = 0 THEN
    SELECT COUNT(*) INTO v_member_count
    FROM household_members
    WHERE household_id = p_household_id;

    SELECT total_estimated INTO v_total
    FROM shopping_lists
    WHERE id = p_shopping_list_id;

    SET v_base_percentage = FLOOR(10000 / v_member_count) / 100;
    SET v_remainder = 100.00 - (v_base_percentage * v_member_count);

    SET v_done = 0;
    OPEN v_member_cursor;
    read_loop: LOOP
      FETCH v_member_cursor INTO v_member_id;
      IF v_done THEN
        LEAVE read_loop;
      END IF;

      IF v_is_first THEN
        SET v_percentage = v_base_percentage + v_remainder;
        SET v_is_first = 0;
      ELSE
        SET v_percentage = v_base_percentage;
      END IF;

      -- IGNORE only exists to absorb a racing duplicate-key insert on
      -- (shopping_list_id, member_id); currently safe because member_id comes
      -- from the household cursor, the list was already validated above, and
      -- v_percentage/v_total are both non-NULL and bounded here — but it will
      -- also silently suppress any future FK/CHECK/NOT NULL violation on this
      -- INSERT, so revisit if this procedure's inputs ever become less constrained.
      INSERT IGNORE INTO shopping_list_splits (shopping_list_id, member_id, percentage, amount_owed)
      VALUES (p_shopping_list_id, v_member_id, v_percentage, ROUND(v_total * v_percentage / 100, 2));
    END LOOP;
    CLOSE v_member_cursor;

    SELECT SUM(amount_owed) INTO v_amount_sum
    FROM shopping_list_splits
    WHERE shopping_list_id = p_shopping_list_id;

    SET v_amount_diff = v_total - v_amount_sum;

    IF v_amount_diff <> 0 THEN
      UPDATE shopping_list_splits
      SET amount_owed = amount_owed + v_amount_diff
      WHERE shopping_list_id = p_shopping_list_id
      ORDER BY member_id ASC
      LIMIT 1;
    END IF;
  END IF;

  SELECT sls.id, sls.shopping_list_id, sls.member_id, hm.display_name, sls.percentage, sls.amount_owed
  FROM shopping_list_splits sls
  INNER JOIN household_members hm ON hm.id = sls.member_id
  WHERE sls.shopping_list_id = p_shopping_list_id
  ORDER BY hm.id ASC;
END;
