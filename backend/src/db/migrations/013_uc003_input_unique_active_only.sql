-- UC-003 phase 5: the one-value-per-metric guard on performance_inputs must
-- only apply to LIVE rows. The plain UNIQUE constraint from 008 also counted
-- soft-deleted rows, which made "delete an input, then add a corrected one
-- of the same type" impossible. A partial unique index fixes that.

ALTER TABLE performance_inputs
  DROP CONSTRAINT IF EXISTS performance_inputs_staff_id_period_id_input_type_key;

CREATE UNIQUE INDEX IF NOT EXISTS performance_inputs_active_unique
  ON performance_inputs (staff_id, period_id, input_type)
  WHERE deleted_at IS NULL;
