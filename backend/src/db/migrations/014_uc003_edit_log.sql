-- UC-003: edit history audit trail for payroll lines, adjustments, and
-- performance inputs. Append-only: rows are never updated or deleted.
-- Each entry records who changed what, when, and the before/after values.

CREATE TABLE payroll_edit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_type VARCHAR NOT NULL
    CHECK (entity_type IN ('payroll_line', 'adjustment', 'performance_input')),
  entity_id UUID NOT NULL,
  action VARCHAR NOT NULL
    CHECK (action IN ('created', 'updated', 'deleted')),
  user_id UUID,
  user_name VARCHAR NOT NULL DEFAULT 'System',
  changes JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_edit_log_entity
  ON payroll_edit_log (entity_type, entity_id, created_at DESC);
