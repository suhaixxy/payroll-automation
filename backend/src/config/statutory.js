// Statutory CPF and SDL rates — THE ONLY place these numbers may live.
// The engines import from here; no statutory number may appear inside
// calculation code (CLAUDE.md rule). When the government changes a rate,
// this file changes and nothing else.
//
// All money values are INTEGER CENTS. Percentages are plain numbers
// (12.5 means 12.5%) exactly as printed in the official tables.
//
// ── CPF ─────────────────────────────────────────────────────────────────
// Source: CPF Board — "CPF contribution rates from 1 January 2026"
//   https://www.cpf.gov.sg/content/dam/web/employer/employer-obligations/documents/CPFcontributionratesfrom1Jan2026.pdf
//   https://www.cpf.gov.sg/service/article/what-are-the-changes-to-the-cpf-contribution-rates-for-senior-workers-from-1-january-2026
// Effective: 1 January 2026. Table below is for Singapore Citizens /
// 3rd-year+ PRs earning > $750/month (the standard full rates — this
// project's simplifying assumption; the phased-in rates for $500–$750
// earners are out of scope).
//
// Ordinary Wage ceiling: $8,000/month from 1 Jan 2026 (final step of the
// Budget-2023 ceiling increases).
//   https://www.cpf.gov.sg/service/article/what-is-the-ordinary-wage-ow-ceiling
const CPF = {
  effectiveFrom: '2026-01-01',
  ordinaryWageCeilingCents: 800000, // $8,000/month

  // A band applies when age <= maxAge (bands checked in order). The last
  // band's maxAge of null means "no upper limit" (above 70).
  ageBands: [
    { maxAge: 55, employerPct: 17, employeePct: 20 }, // 55 and below — total 37%
    { maxAge: 60, employerPct: 16, employeePct: 18 }, // >55 to 60 — total 34% (raised 1 Jan 2026)
    { maxAge: 65, employerPct: 12.5, employeePct: 12.5 }, // >60 to 65 — total 25% (raised 1 Jan 2026)
    { maxAge: 70, employerPct: 9, employeePct: 7.5 }, // >65 to 70 — total 16.5%
    { maxAge: null, employerPct: 7.5, employeePct: 5 }, // above 70 — total 12.5%
  ],
};

// ── SDL ─────────────────────────────────────────────────────────────────
// Source: SkillsFuture Singapore / CPF Board — "Skills Development Levy"
//   https://www.cpf.gov.sg/employer/employer-obligations/skills-development-levy
//   https://www.cpf.gov.sg/service/article/how-do-i-calculate-skills-development-levy-sdl
// Long-standing rates (unchanged in 2026): 0.25% of monthly total wages,
// minimum $2 (wages under $800), maximum $11.25 (levy is computed on the
// first $4,500 of wages only).
const SDL = {
  rateBasisPoints: 25, // 0.25% = 25 basis points (integer, so the math stays exact)
  minLevyCents: 200, // $2.00
  maxLevyCents: 1125, // $11.25
  wageCapCents: 450000, // levy computed on the first $4,500 of wages
};

module.exports = { CPF, SDL };
