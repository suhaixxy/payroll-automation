-- Auth: the users table previously existed only because Sequelize's startup
-- sync created it, which meant migrations could not reference users(id) —
-- on a fresh database, migrations run BEFORE the server ever boots.
-- The UC-003 tables that follow (statutory_rate_sets, payroll_adjustments,
-- uc003_audit_log ...) all carry created_by / actor_id foreign keys, so the
-- table must be owned by a migration. The shape matches models/User.js
-- exactly; the startup sync sees the table exists and leaves it alone.

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,            -- always a bcrypt hash
  role VARCHAR(30) NOT NULL DEFAULT 'accounting' CHECK (role IN ('accounting', 'manager')),
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);
