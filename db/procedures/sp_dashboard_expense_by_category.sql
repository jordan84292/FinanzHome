DROP PROCEDURE IF EXISTS sp_dashboard_expense_by_category;

CREATE PROCEDURE sp_dashboard_expense_by_category(
  IN p_household_id INT UNSIGNED,
  IN p_month DATE,
  IN p_display_currency_id TINYINT UNSIGNED
)
BEGIN
  SELECT
    ec.id AS category_id,
    ec.name AS category_name,
    ROUND(SUM(
      re.amount * CASE
        WHEN re.currency_id = p_display_currency_id THEN 1
        WHEN re.currency_id = 2 THEN IFNULL((
          SELECT rate_crc_per_usd FROM exchange_rates er
          WHERE er.effective_date <= eo.due_date
          ORDER BY er.effective_date DESC, er.id DESC LIMIT 1
        ), 1)
        WHEN re.currency_id = 1 THEN 1 / IFNULL((
          SELECT rate_crc_per_usd FROM exchange_rates er
          WHERE er.effective_date <= eo.due_date
          ORDER BY er.effective_date DESC, er.id DESC LIMIT 1
        ), 1)
        ELSE 1
      END
    ), 2) AS total_amount
  FROM expense_occurrences eo
  INNER JOIN recurring_expenses re ON re.id = eo.recurring_expense_id
  INNER JOIN expense_categories ec ON ec.id = re.category_id
  WHERE re.household_id = p_household_id
    AND eo.is_paid = 1
    AND YEAR(eo.due_date) = YEAR(p_month)
    AND MONTH(eo.due_date) = MONTH(p_month)
  GROUP BY ec.id, ec.name
  ORDER BY total_amount DESC;
END;
