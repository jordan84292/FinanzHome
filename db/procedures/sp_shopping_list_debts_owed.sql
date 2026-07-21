DROP PROCEDURE IF EXISTS sp_shopping_list_debts_owed;

-- Aggregated pending debt for one member, grouped by who actually paid at
-- checkout (shopping_lists.paid_by_member_id) — used for the "you owe someone"
-- reminder shown once per app open. Excludes the payer's own split row
-- (paid_by_member_id <> member_id) since nobody owes themselves.
CREATE PROCEDURE sp_shopping_list_debts_owed(
  IN p_member_id INT UNSIGNED,
  IN p_household_id INT UNSIGNED
)
BEGIN
  SELECT
    sl.paid_by_member_id, payer.display_name AS payer_display_name,
    COUNT(*) AS pending_count,
    SUM(sls.amount_owed) AS amount_owed,
    c.symbol AS currency_symbol
  FROM shopping_list_splits sls
  INNER JOIN shopping_lists sl ON sl.id = sls.shopping_list_id
  INNER JOIN household_members payer ON payer.id = sl.paid_by_member_id
  LEFT JOIN currencies c ON c.id = sl.total_estimated_currency_id
  WHERE sl.household_id = p_household_id
    AND sls.member_id = p_member_id
    AND sls.is_paid = 0
    AND sl.paid_by_member_id IS NOT NULL
    AND sl.paid_by_member_id <> p_member_id
  GROUP BY sl.paid_by_member_id, payer.display_name, c.symbol
  ORDER BY payer.display_name ASC;
END;
