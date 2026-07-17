DROP PROCEDURE IF EXISTS sp_dashboard_member_balances;

-- Two kinds of "shared money" exist in this schema and only one has a known
-- payer: expense_occurrences.paid_by_member_id records who actually paid a
-- shared recurring expense, so expense_owed_to_others/expense_fronted_by_them
-- form a real net_balance (who owes whom) for that slice. Shopping lists have
-- no equivalent "who paid at checkout" column (only created_by_member_id, the
-- list's creator, which is not necessarily the payer) — so shopping_share_amount
-- is reported separately as each member's expected contribution, not netted
-- into net_balance.
CREATE PROCEDURE sp_dashboard_member_balances(
  IN p_household_id INT UNSIGNED,
  IN p_display_currency_id TINYINT UNSIGNED
)
BEGIN
  DECLARE v_rate DECIMAL(12,4);

  SELECT rate_crc_per_usd INTO v_rate
  FROM exchange_rates
  WHERE effective_date <= CURDATE()
  ORDER BY effective_date DESC, id DESC
  LIMIT 1;

  SELECT
    hm.id AS member_id,
    hm.display_name,
    IFNULL(shopping.shopping_share_amount, 0) AS shopping_share_amount,
    IFNULL(owed.expense_owed_to_others, 0) AS expense_owed_to_others,
    IFNULL(fronted.expense_fronted_by_them, 0) AS expense_fronted_by_them,
    ROUND(IFNULL(fronted.expense_fronted_by_them, 0) - IFNULL(owed.expense_owed_to_others, 0), 2) AS net_balance
  FROM household_members hm
  LEFT JOIN (
    SELECT sls.member_id, ROUND(SUM(
      sls.amount_owed * CASE
        WHEN sl.total_estimated_currency_id = p_display_currency_id THEN 1
        WHEN sl.total_estimated_currency_id = 2 THEN IFNULL(v_rate, 1)
        WHEN sl.total_estimated_currency_id = 1 THEN 1 / IFNULL(v_rate, 1)
        ELSE 1
      END
    ), 2) AS shopping_share_amount
    FROM shopping_list_splits sls
    INNER JOIN shopping_lists sl ON sl.id = sls.shopping_list_id
    WHERE sl.household_id = p_household_id AND sl.status = 'confirmed'
    GROUP BY sls.member_id
  ) shopping ON shopping.member_id = hm.id
  LEFT JOIN (
    SELECT eos.member_id, ROUND(SUM(
      eos.amount_owed * CASE
        WHEN re.currency_id = p_display_currency_id THEN 1
        WHEN re.currency_id = 2 THEN IFNULL(v_rate, 1)
        WHEN re.currency_id = 1 THEN 1 / IFNULL(v_rate, 1)
        ELSE 1
      END
    ), 2) AS expense_owed_to_others
    FROM expense_occurrence_shares eos
    INNER JOIN expense_occurrences eo ON eo.id = eos.occurrence_id
    INNER JOIN recurring_expenses re ON re.id = eo.recurring_expense_id
    WHERE re.household_id = p_household_id
      AND eo.is_paid = 1
      AND eo.paid_by_member_id IS NOT NULL
      AND eos.member_id <> eo.paid_by_member_id
    GROUP BY eos.member_id
  ) owed ON owed.member_id = hm.id
  LEFT JOIN (
    SELECT eo.paid_by_member_id AS member_id, ROUND(SUM(
      eos.amount_owed * CASE
        WHEN re.currency_id = p_display_currency_id THEN 1
        WHEN re.currency_id = 2 THEN IFNULL(v_rate, 1)
        WHEN re.currency_id = 1 THEN 1 / IFNULL(v_rate, 1)
        ELSE 1
      END
    ), 2) AS expense_fronted_by_them
    FROM expense_occurrence_shares eos
    INNER JOIN expense_occurrences eo ON eo.id = eos.occurrence_id
    INNER JOIN recurring_expenses re ON re.id = eo.recurring_expense_id
    WHERE re.household_id = p_household_id
      AND eo.is_paid = 1
      AND eo.paid_by_member_id IS NOT NULL
      AND eos.member_id <> eo.paid_by_member_id
    GROUP BY eo.paid_by_member_id
  ) fronted ON fronted.member_id = hm.id
  WHERE hm.household_id = p_household_id
  ORDER BY hm.id ASC;
END;
