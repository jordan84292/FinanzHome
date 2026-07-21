DROP PROCEDURE IF EXISTS sp_expense_occurrence_share_mark_paid;

-- Marks one member's share of a shared one_time expense as paid/unpaid, then
-- recomputes the parent occurrence's overall is_paid from scratch (true only
-- once every share is paid) — kept in sync in both directions, so unmarking
-- a share correctly reopens the occurrence if it had just been completed.
CREATE PROCEDURE sp_expense_occurrence_share_mark_paid(
  IN p_share_id INT UNSIGNED,
  IN p_household_id INT UNSIGNED,
  IN p_is_paid TINYINT(1)
)
BEGIN
  DECLARE v_occurrence_id INT UNSIGNED;
  DECLARE v_all_paid TINYINT(1);

  SELECT eos.occurrence_id INTO v_occurrence_id
  FROM expense_occurrence_shares eos
  INNER JOIN expense_occurrences eo ON eo.id = eos.occurrence_id
  INNER JOIN recurring_expenses re ON re.id = eo.recurring_expense_id
  WHERE eos.id = p_share_id AND re.household_id = p_household_id;

  IF v_occurrence_id IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Expense occurrence share not found in this household';
  END IF;

  UPDATE expense_occurrence_shares
  SET is_paid = p_is_paid, paid_at = IF(p_is_paid = 1, NOW(), NULL)
  WHERE id = p_share_id;

  SELECT IF(COUNT(*) = SUM(is_paid), 1, 0) INTO v_all_paid
  FROM expense_occurrence_shares
  WHERE occurrence_id = v_occurrence_id;

  UPDATE expense_occurrences
  SET is_paid = v_all_paid, paid_at = IF(v_all_paid = 1, NOW(), NULL)
  WHERE id = v_occurrence_id;

  SELECT eos.id, eos.occurrence_id, eos.member_id, hm.display_name, eos.percentage, eos.amount_owed,
         eos.is_paid, eos.paid_at
  FROM expense_occurrence_shares eos
  INNER JOIN household_members hm ON hm.id = eos.member_id
  WHERE eos.occurrence_id = v_occurrence_id
  ORDER BY hm.id ASC;
END;
