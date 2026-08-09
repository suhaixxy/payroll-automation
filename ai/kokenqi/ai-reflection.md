# AI Reflection — UC-005

## 1. How I Used AI

I used Codex and Claude Code while developing UC-005 — Payment Processing, Payment File Generation, HRMS Sync and Payslips. Codex was the tool I used more extensively. The logs show it supporting the project from early planning through implementation, integration, testing, documentation and final deployment preparation. I used Claude Code less often, mainly for focused database work, frontend debugging and verification.

In the early Codex sessions on 13 and 19 July, I used it to break the feature into manageable parts and reason about the flow from an approved and locked payroll period to a Payment Batch, payment file, HRMS result, payslips and audit records. Later prompts became narrower. I required the tools to inspect before editing, identify the root cause, preserve other members' work and report the files changed because the final repository was an integrated group project.

## 2. Where AI Added Value

AI added the most value when a task required tracing information across several layers. For example, payment readiness depends on pay-period state, the approved calculation run, complete payroll lines, staff bank details and duplicate Payment Batch checks. AI helped me follow these relationships through React pages, API calls, Express routes, Sequelize services and PostgreSQL tables. This accelerated planning and helped me identify edge cases such as invalid bank details, non-positive net pay, failed HRMS synchronization, cancellation restrictions and employee ownership of payslips. However, I still had to reconcile those suggestions with the actual school stack and the group repository.

The database work was another strong use. In the Claude sessions `029c65cf...` and `3cacffff...`, AI compared SQL migrations, Sequelize models and seed dependencies. It helped identify missing relationships for `user_account`, `payment_batch_item` and `payslip`, and explained why seed execution order and foreign keys mattered. This was useful because Payment Batch items and payslips preserve historical snapshots that must remain consistent even when staff data changes. The same work was also high-risk: migrations and shared tables affect every teammate, so a technically neat proposal was not automatically an appropriate group-project change.

AI also improved debugging speed by searching the codebase, comparing frontend expectations with backend responses and suggesting targeted checks. During the 8 August Codex integration session, this helped with the Dashboard CSS regression, login error classification, database integration and Payment Preview refresh behavior. It also helped organize Jest and Supertest coverage and cross-check final documentation against the integrated code.

## 3. Critical Evaluation of AI Output

I did not treat AI output as authoritative. One important example involved database migrations. AI explained that replacing the accumulated history with a cleaner six-file baseline was technically possible. I chose not to rebaseline or delete migrations 001–015 because teammates could already have those migrations recorded in their local databases and branches. Replacing history might make a clean installation look simpler while breaking existing environments. Instead, I kept the existing migration history and made only the lower-risk integration changes that were necessary. This was my decision based on team ownership and migration safety, not the AI's preference for a cleaner design.

A second example came from the Claude session `f3a41685...`. The initial inspection concluded that the Payslips filtering and pagination code appeared correct, but that did not match what I could see in the browser. I rejected the conclusion and explicitly stated that the rendered behavior was still wrong. I asked for investigation of the actual rendering path and then for temporary runtime instrumentation. The evidence showed that filtering and pagination counts were correct while extra table rows were still rendered. This led to the real problem: a Sequelize association/join condition could match a payroll line across more than one Payment Batch. The accepted solution used both the payment batch and payroll line relationship. This experience reinforced that an AI diagnosis is a hypothesis until runtime evidence supports it.

A third example was the Dashboard Quick Actions CSS bug in the 8 August Codex session. The first change to `main.css` did not fix the rendered page. I did not accept the change merely because the edited rule looked reasonable. A second cascade inspection found that a global `button { display: inline-flex; }` rule in `App.css` was affecting the action cards. I chose the smallest scoped correction, adding `display: block` to `.dashboard-action`, rather than changing the global button rule and risking regressions elsewhere.

The login error bug was similar. Wrong credentials and an unreachable backend were being shown as the same network error. Inspection showed that the backend already returned a structured 401/403 error; the frontend checked the wrong response field and then treated `error.request` as proof of a network failure. I kept the fix in frontend error classification instead of allowing unnecessary authentication or database changes. Checking the real Axios response and backend error contract prevented a broader and less accurate solution.

I also repeatedly constrained AI from modifying UC-001, UC-002, UC-003 or UC-004. Those areas belong to other group members. Shared code was changed only where an integration issue directly affected UC-005 and after inspecting its consumers. The coverage work followed the same principle. Global Jest thresholds were pulled down mainly by UC-003 files, but I did not alter another member's code or add meaningless tests to raise a group-wide number. I separated the global measurement from core UC-005 coverage and added only the missing UC-005 contracts.

## 4. Verification and Quality Control

I verified AI-assisted changes in several ways rather than relying on generated explanations. I used manual frontend workflow testing and API checks, including login, Payment Preview, bank-detail updates, Payment Batch generation, GIRO download, HRMS failure and retry, cancellation, payslip access and PDF download. Jest and Supertest covered backend contracts and authorization paths. I inspected the database state, model associations, foreign keys and seed ordering when changes involved PostgreSQL.

The test-database workflow is a good example of verification improving safety. Initially, plain `npm test` depended on manually supplying `TEST_DATABASE_URL`. The final workflow creates a uniquely named disposable PostgreSQL database, runs migrations and seeds, executes Jest and removes that database afterward. The normal `payroll_automation` database remains protected. Cleanup was checked after successful runs and coverage failures, and `--detectOpenHandles` was used to investigate Jest's delayed-exit notice rather than assuming there was a real unresolved handle.

After adding targeted tests, the authoritative suite passed 20 suites and 183 tests. Core UC-005 coverage reached 95.05% statements, 75.33% branches, 95.65% functions and 96.30% lines. I also used frontend build/lint checks where relevant, reviewed Git diffs and status, and checked documentation against actual routes, services, models and tests. These checks made AI changes auditable and limited accidental scope expansion.

## 5. Limitations and Risks

AI can infer the wrong root cause from code that looks correct, as the Payslips case demonstrated. It can also recommend broad refactors that are reasonable in isolation but unsafe in a shared Git and database history. Generated tests may create false confidence if they reproduce implementation details instead of asserting documented API and authorization contracts. AI also lacks ownership context unless I state clearly which use cases belong to other members.

There are privacy risks in AI evidence. Session logs can contain tool output, local paths, credentials or authentication material. During the evidence audit, I intentionally excluded two Claude logs because one contained JWT-shaped and personal-email material and another contained a potentially sensitive database password. I did not include or reproduce those values. This showed that AI logs should be reviewed before submission rather than committed automatically.

## 6. What I Learned

I became more precise in how I prompted AI. My later prompts separated inspection from authorization to edit, named permitted files, prohibited unrelated refactoring and required tests and diffs afterward. I learned to ask what evidence supports a diagnosis, especially when the browser, database or test output disagrees with static inspection. Narrow prompts were more effective than asking for a general cleanup because they made the result easier to review and reduced the risk to teammates' work.

I also developed a better understanding of integration risks. Migration history, model associations, error envelopes, CSS cascade rules and test isolation can each cause failures outside the file being edited. AI helped locate those connections, but deciding whether a change was appropriate required knowledge of the payroll workflow, feature ownership and submission requirements.

## 7. Overall Reflection

AI improved my productivity, particularly for searching across layers, generating test ideas and accelerating iterative debugging. Its strongest contribution was not one-shot code generation; it was helping me form and test hypotheses while I reviewed the evidence. The final scope decisions, acceptance of fixes and verification remained my responsibility. Using AI responsibly in this project meant treating it as a coding assistant rather than an authority, preserving other members' work, and requiring real code, runtime and test evidence before accepting its output.
