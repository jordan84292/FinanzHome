DROP PROCEDURE IF EXISTS sp_recurring_expense_list;

CREATE PROCEDURE sp_recurring_expense_list(
  IN p_household_id INT UNSIGNED
)
BEGIN
  SELECT
    re.id, re.household_id, re.name, re.category_id, ec.name AS category_name,
    re.amount, re.currency_id, c.code AS currency_code, c.symbol AS currency_symbol,
    re.periodicity, re.due_day_config, re.withdrawal_day, re.first_due_date,
    re.monthly_due_day, re.funding_mode, re.installment_frequency,
    re.responsible_member_id, hm.display_name AS responsible_display_name,
    re.is_active, re.created_at,
    next_occ.id AS next_occurrence_id,
    next_occ.due_date AS next_due_date,
    CASE
      WHEN next_occ.id IS NULL THEN 'sin_ocurrencia'
      WHEN next_occ.due_date < CURDATE() THEN 'vencido'
      WHEN next_occ.due_date <= DATE_ADD(CURDATE(), INTERVAL 3 DAY) THEN 'vence_pronto'
      ELSE 'al_dia'
    END AS status
  FROM recurring_expenses re
  INNER JOIN expense_categories ec ON ec.id = re.category_id
  INNER JOIN currencies c ON c.id = re.currency_id
  INNER JOIN household_members hm ON hm.id = re.responsible_member_id
  LEFT JOIN expense_occurrences next_occ ON next_occ.id = (
    SELECT eo.id FROM expense_occurrences eo
    WHERE eo.recurring_expense_id = re.id AND eo.is_paid = 0
    ORDER BY eo.due_date ASC
    LIMIT 1
  )
  WHERE re.household_id = p_household_id AND re.is_active = 1
  ORDER BY (next_occ.due_date IS NULL) ASC, next_occ.due_date ASC, re.name ASC;
END;
