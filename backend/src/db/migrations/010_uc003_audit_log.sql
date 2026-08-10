-- UC-003 (guide §2.3 / §3.2): append-only audit trail for every mutating
-- UC-003 action — who, what entity, what changed (before/after JSON), when.
-- Rows are NEVER updated or deleted; business-record deletes are soft
-- deletes (deleted_at) audited here.

CREATE TABLE uc003_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity VARCHAR(50) NOT NULL,               -- e.g. 'payroll_adjustment'
  entity_id UUID,
  action VARCHAR(20) NOT NULL,               -- 'create'|'update'|'delete'|'calculate'|'void'|'submit'
  before_json JSONB,
  after_json JSONB,
  actor_id UUID NOT NULL REFERENCES users(id),
  actor_role VARCHAR(30) NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX uc003_audit_log_entity ON uc003_audit_log (entity, entity_id);
CREATE INDEX uc003_audit_log_occurred_at ON uc003_audit_log (occurred_at);
