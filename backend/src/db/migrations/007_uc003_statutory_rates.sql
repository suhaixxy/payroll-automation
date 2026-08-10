-- UC-003 (guide §3.2, adapted to this repo's UUID keys): versioned statutory
-- rates. A calculation run pins one rate set forever, so recalculating an
-- old period with today's rates is impossible by construction.
-- Rates are FRACTIONS in NUMERIC(6,4): 0.0025 = 0.25%, 0.2000 = 20%.
-- Money is NUMERIC(12,2) — never float (guide §2.4).

CREATE TABLE statutory_rate_sets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  version_label VARCHAR(50) NOT NULL,        -- e.g. '2026-Q1'
  effective_from DATE NOT NULL,
  effective_to DATE,                         -- NULL = current version
  sdl_rate NUMERIC(6,4) NOT NULL,
  sdl_min NUMERIC(12,2) NOT NULL,
  sdl_max NUMERIC(12,2) NOT NULL,
  sdl_wage_cap NUMERIC(12,2) NOT NULL,
  ot_multiplier NUMERIC(6,4) NOT NULL,
  ph_multiplier NUMERIC(6,4) NOT NULL,
  cpf_ow_ceiling NUMERIC(12,2) NOT NULL,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ                     -- soft delete only (guide §2.3)
);

-- CPF contribution rates per age band, belonging to a rate set.
CREATE TABLE cpf_rate_bands (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rate_set_id UUID NOT NULL REFERENCES statutory_rate_sets(id),
  age_min INTEGER NOT NULL,
  age_max INTEGER,                           -- NULL = no upper bound
  employee_rate NUMERIC(6,4) NOT NULL,
  employer_rate NUMERIC(6,4) NOT NULL,
  min_wage_threshold NUMERIC(12,2) NOT NULL  -- below this, no employee CPF
);

CREATE INDEX cpf_rate_bands_rate_set_id ON cpf_rate_bands (rate_set_id);
