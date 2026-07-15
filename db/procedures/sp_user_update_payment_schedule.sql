DROP PROCEDURE IF EXISTS sp_user_update_payment_schedule;

CREATE PROCEDURE sp_user_update_payment_schedule(
  IN p_user_id INT UNSIGNED,
  IN p_payment_frequency VARCHAR(20),
  IN p_payment_weekday TINYINT UNSIGNED,
  IN p_payment_day TINYINT UNSIGNED
)
BEGIN
  IF p_payment_frequency = 'weekly' AND (p_payment_weekday IS NULL OR p_payment_weekday NOT BETWEEN 1 AND 7) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Seleccioná el día de la semana';
  ELSEIF p_payment_frequency = 'monthly' AND (p_payment_day IS NULL OR p_payment_day NOT BETWEEN 1 AND 31) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Seleccioná el día del mes';
  ELSEIF p_payment_frequency NOT IN ('weekly', 'monthly', 'semimonthly') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Periodicidad inválida';
  END IF;

  UPDATE users
  SET
    payment_frequency = p_payment_frequency,
    payment_weekday = IF(p_payment_frequency = 'weekly', p_payment_weekday, NULL),
    payment_day = IF(p_payment_frequency = 'monthly', p_payment_day, NULL)
  WHERE id = p_user_id;

  SELECT id, email, name, payment_frequency, payment_weekday, payment_day
  FROM users
  WHERE id = p_user_id;
END;
