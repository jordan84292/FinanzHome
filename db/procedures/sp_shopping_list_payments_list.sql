DROP PROCEDURE IF EXISTS sp_shopping_list_payments_list;

CREATE PROCEDURE sp_shopping_list_payments_list(
  IN p_household_id INT UNSIGNED
)
BEGIN
  SELECT
    sl.id AS shopping_list_id, sl.confirmed_at, sl.total_estimated,
    sl.total_estimated_currency_id, c.symbol AS currency_symbol,
    sls.id AS split_id, sls.member_id, hm.display_name,
    sls.percentage, sls.amount_owed, sls.is_paid, sls.paid_at
  FROM shopping_lists sl
  INNER JOIN shopping_list_splits sls ON sls.shopping_list_id = sl.id
  INNER JOIN household_members hm ON hm.id = sls.member_id
  LEFT JOIN currencies c ON c.id = sl.total_estimated_currency_id
  WHERE sl.household_id = p_household_id AND sl.status = 'confirmed'
  ORDER BY sl.confirmed_at DESC, hm.id ASC;
END;
