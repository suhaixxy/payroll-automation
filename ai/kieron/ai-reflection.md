# AI Reflection – UC002 Timesheet Validation

## Introduction

I used generative AI as a development assistant while working on UC002, Timesheet Validation. I did not treat AI output as final code that could be accepted automatically. I used it mainly to help me understand the required workflow, propose implementation approaches, identify integration issues, and structure code and documentation. I then compared the suggestions against the shared project repository, the existing database schema, and the architecture used by my teammates before deciding what to keep, modify, or reject.

## Where AI Added Value

AI was most useful during the early design and implementation stages because it helped break UC002 into smaller responsibilities. Instead of keeping all validation logic inside one frontend page or route file, the final structure separates concerns across a controller, route definitions, validation service, validation rules engine, request validator, frontend API module, reusable React components, and the main validation page. This made the feature easier to understand and more consistent with the structure used elsewhere in the team project.

AI also helped translate the business requirement of “timesheet validation” into concrete rules that could be tested. The implemented rules include detecting unmatched or invalid roster rows, shifts exceeding an 8-hour daily review threshold, overlapping same-day shifts, weekly totals exceeding 44 hours, and active staff members with no matched timesheet entry. The rules engine is kept separate from database access, which makes the core logic easier to test independently.

Another useful area was the user interface. An earlier version of my work placed too much logic directly in the page and used direct API calls. After reviewing the team's shared frontend structure, I changed the implementation so that UC002 uses the existing API client, Material UI components, shared page components, and the team's common stylesheet. I also separated reusable validation UI elements, such as the summary cards, review table, resolution dialog, status chips, and audit panel, from the page-level state management.

## Suggestions I Significantly Modified

One of the most important changes was the database design. An early AI-generated approach assumed a separate validation table and field names that did not match the team's final PostgreSQL schema. The shared repository already contained `timesheet_exception` for UC002, UUID primary keys, `shift_date`, `total_hours`, and other roster fields. I therefore did not keep a competing validation table. Instead, the UC002 migration extends `timesheet_exception` by allowing exceptions that are not tied to a single timesheet row and by adding `pay_period_id`, `staff_id`, `expected_value`, and `actual_value`. This was necessary for weekly-limit and missing-entry findings and kept the feature compatible with the team's shared data model.

I also changed the backend organisation from an isolated validation route to the shared `/api/timesheets` route structure. All UC002 endpoints now use the existing authentication and authorisation middleware and are restricted to managers. Request parameters and bodies are validated with the shared request-validation approach before they reach the controller. These changes were made because fitting the existing application architecture was more important than preserving the first AI-generated structure.

The frontend was modified for the same reason. I rejected the idea of using standalone Axios calls inside the page because the project already had a shared API client that attaches the access token and handles unauthorised responses. The final UC002 frontend therefore calls `validationApi.js`, which uses the shared client. I also added only UC002-specific CSS to the existing `main.css` instead of creating an unrelated visual theme.

## Suggestions I Rejected or Deferred

I did not implement every possible validation rule suggested during development. The database supports a `public_holiday` rule type, but the current rules engine does not automatically generate public-holiday exceptions because the project does not currently provide a trusted holiday-calendar source for UC002. Adding a rule without reliable source data could create incorrect findings, so I left the type available for future integration rather than pretending the rule was complete.

The current overlap rule also deliberately does not attempt to detect cross-midnight overlap. The roster model stores a shift against its start date, and supporting cross-midnight comparisons correctly would require additional date/time handling. I preferred to keep the implemented same-day rule predictable rather than add incomplete logic simply to increase the number of features.

## How I Evaluated AI Output

I evaluated AI suggestions by checking them against the actual shared repository instead of assuming the suggestions matched the project. In particular, I compared database column names, table relationships, route structure, frontend API usage, authentication middleware, and teammate coding patterns. When an AI suggestion conflicted with the shared project, I changed the suggestion to fit the repository rather than changing shared code unnecessarily.

I also used Git to keep my work traceable. UC002 changes were committed in logical groups for the backend, database support, tests, frontend, and styling on my feature branch. This makes it easier to review which changes belong to my use case and to identify later fixes separately.

Testing is an important part of verification. I created automated tests for the validation rules and a database integration test for the validation service. During development, local Docker testing was temporarily blocked because hardware virtualization was disabled in the PC firmware. I therefore did not treat the existence of AI-generated tests as proof that the feature worked. Before final submission, I will only state that the tests pass after I have successfully started PostgreSQL, applied the migrations, seeded the database where required, and run the Jest test suite in the final integrated repository.

## Conclusion

AI improved my productivity by helping me explore implementation options, understand integration problems, and produce a clearer structure for UC002. The most important part of the process, however, was reviewing and adapting the suggestions. Several early assumptions did not match the team's database or shared architecture, so I changed or rejected them. My final approach was to use AI as a tool for proposing and explaining solutions while keeping responsibility for integration decisions, verification, and the final submitted implementation.
