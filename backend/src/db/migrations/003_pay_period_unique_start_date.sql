-- Shared: pay_period.start_date needs a unique constraint so
-- payPeriodService's "ON CONFLICT (start_date) DO NOTHING" seeding logic
-- can safely run every time the server starts without creating duplicates.

ALTER TABLE pay_period ADD CONSTRAINT pay_period_start_date_unique UNIQUE (start_date);