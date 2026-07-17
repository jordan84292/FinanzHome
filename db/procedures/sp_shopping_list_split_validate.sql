DROP PROCEDURE IF EXISTS sp_shopping_list_split_validate;

CREATE PROCEDURE sp_shopping_list_split_validate(
  IN p_shopping_list_id INT UNSIGNED,
  IN p_household_id INT UNSIGNED
)
BEGIN
  DECLARE v_exists INT;
  DECLARE v_sum DECIMAL(6,2);
  DECLARE v_total DECIMAL(12,2);
  DECLARE v_amount_sum DECIMAL(12,2);
  DECLARE v_amount_diff DECIMAL(12,2);

  SELECT COUNT(*) INTO v_exists
  FROM shopping_lists
  WHERE id = p_shopping_list_id AND household_id = p_household_id AND status = 'confirmed';

  IF v_exists = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Shopping list not found or not confirmed';
  END IF;

  SELECT SUM(percentage) INTO v_sum
  FROM shopping_list_splits
  WHERE shopping_list_id = p_shopping_list_id;

  IF v_sum IS NULL OR v_sum <> 100.00 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Split percentages must sum to 100';
  END IF;

  SELECT total_estimated INTO v_total
  FROM shopping_lists
  WHERE id = p_shopping_list_id;

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

  SELECT sls.id, sls.shopping_list_id, sls.member_id, hm.display_name, sls.percentage, sls.amount_owed, sls.is_paid, sls.paid_at
  FROM shopping_list_splits sls
  INNER JOIN household_members hm ON hm.id = sls.member_id
  WHERE sls.shopping_list_id = p_shopping_list_id
  ORDER BY hm.id ASC;
END;
