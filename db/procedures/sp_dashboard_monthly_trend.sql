DROP PROCEDURE IF EXISTS sp_dashboard_monthly_trend;

CREATE PROCEDURE sp_dashboard_monthly_trend(
  IN p_household_id INT UNSIGNED,
  IN p_months_back INT UNSIGNED,
  IN p_display_currency_id TINYINT UNSIGNED
)
BEGIN
  SELECT
    DATE_FORMAT(eo.due_date, '%Y-%m') AS period_month,
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
  WHERE re.household_id = p_household_id
    AND eo.is_paid = 1
    AND eo.due_date >= DATE_SUB(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL p_months_back MONTH)
  GROUP BY DATE_FORMAT(eo.due_date, '%Y-%m')
  ORDER BY period_month ASC;
END;
