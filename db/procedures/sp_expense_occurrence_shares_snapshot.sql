DROP PROCEDURE IF EXISTS sp_expense_occurrence_shares_snapshot;

CREATE PROCEDURE sp_expense_occurrence_shares_snapshot(
  IN p_occurrence_id INT UNSIGNED,
  IN p_household_id INT UNSIGNED
)
BEGIN
  DECLARE v_exists INT;
  DECLARE v_already_snapshotted INT;
  DECLARE v_recurring_expense_id INT UNSIGNED;
  DECLARE v_amount DECIMAL(12,2);
  DECLARE v_share_count INT;
  DECLARE v_member_id INT UNSIGNED;
  DECLARE v_percentage DECIMAL(5,2);
  DECLARE v_done INT DEFAULT 0;
  DECLARE v_amount_sum DECIMAL(12,2);
  DECLARE v_amount_diff DECIMAL(12,2);
  DECLARE v_share_cursor CURSOR FOR
    SELECT member_id, percentage FROM recurring_expense_shares WHERE recurring_expense_id = v_recurring_expense_id;
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_done = 1;

  SELECT COUNT(*) INTO v_exists
  FROM expense_occurrences eo
  INNER JOIN recurring_expenses re ON re.id = eo.recurring_expense_id
  WHERE eo.id = p_occurrence_id AND re.household_id = p_household_id;

  IF v_exists = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Expense occurrence not found in this household';
  END IF;

  SELECT eo.recurring_expense_id INTO v_recurring_expense_id
  FROM expense_occurrences eo
  WHERE eo.id = p_occurrence_id;

  -- Idempotent: a second call for the same occurrence (e.g. generateNextOccurrence
  -- being called again while it's still unpaid) must not duplicate rows or
  -- re-snapshot against a since-changed default split.
  SELECT COUNT(*) INTO v_already_snapshotted
  FROM expense_occurrence_shares
  WHERE occurrence_id = p_occurrence_id;

  IF v_already_snapshotted = 0 THEN
    SELECT amount INTO v_amount FROM recurring_expenses WHERE id = v_recurring_expense_id;

    SELECT COUNT(*) INTO v_share_count
    FROM recurring_expense_shares
    WHERE recurring_expense_id = v_recurring_expense_id;

    -- A recurring expense with no configured shares is simply not shared —
    -- no rows are inserted, and that is the correct, valid final state.
    IF v_share_count > 0 THEN
      SET v_done = 0;
      OPEN v_share_cursor;
      read_loop: LOOP
        FETCH v_share_cursor INTO v_member_id, v_percentage;
        IF v_done THEN
          LEAVE read_loop;
        END IF;

        INSERT INTO expense_occurrence_shares (occurrence_id, member_id, percentage, amount_owed)
        VALUES (p_occurrence_id, v_member_id, v_percentage, ROUND(v_amount * v_percentage / 100, 2));
      END LOOP;
      CLOSE v_share_cursor;

      SELECT SUM(amount_owed) INTO v_amount_sum
      FROM expense_occurrence_shares
      WHERE occurrence_id = p_occurrence_id;

      SET v_amount_diff = v_amount - v_amount_sum;

      IF v_amount_diff <> 0 THEN
        UPDATE expense_occurrence_shares
        SET amount_owed = amount_owed + v_amount_diff
        WHERE occurrence_id = p_occurrence_id
        ORDER BY member_id ASC
        LIMIT 1;
      END IF;
    END IF;
  END IF;

  SELECT eos.id, eos.occurrence_id, eos.member_id, hm.display_name, eos.percentage, eos.amount_owed
  FROM expense_occurrence_shares eos
  INNER JOIN household_members hm ON hm.id = eos.member_id
  WHERE eos.occurrence_id = p_occurrence_id
  ORDER BY hm.id ASC;
END;
