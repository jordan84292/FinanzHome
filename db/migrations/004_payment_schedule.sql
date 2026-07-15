ALTER TABLE household_members
  DROP CONSTRAINT chk_household_members_payment_day,
  DROP COLUMN payment_day;

ALTER TABLE users
  ADD COLUMN payment_frequency ENUM('weekly', 'semimonthly', 'monthly') NULL AFTER name,
  ADD COLUMN payment_weekday TINYINT UNSIGNED NULL AFTER payment_frequency,
  ADD COLUMN payment_day TINYINT UNSIGNED NULL AFTER payment_weekday,
  ADD CONSTRAINT chk_users_payment_schedule CHECK (
    (payment_frequency = 'weekly' AND payment_weekday BETWEEN 1 AND 7 AND payment_day IS NULL)
    OR (payment_frequency = 'monthly' AND payment_day BETWEEN 1 AND 31 AND payment_weekday IS NULL)
    OR (payment_frequency = 'semimonthly' AND payment_weekday IS NULL AND payment_day IS NULL)
    OR (payment_frequency IS NULL AND payment_weekday IS NULL AND payment_day IS NULL)
  );
