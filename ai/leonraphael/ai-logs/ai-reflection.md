AI Reflection — Full Stack Application Development

1. How I Used AI

I used Claude Code and Qwen Code at different stages of my Full Stack Application Development project. My use of AI was not limited to generating code. I used both tools to understand the existing codebase, run the application, troubleshoot errors, implement my UC-003 payroll calculation features, integrate my work with the shared repository, improve the user interface, and review the project against the assignment rubric.

The assignment places 20 marks on AI Workflow and Reflection. For an excellent result, the rubric expects AI to be used strategically across design, coding, testing and deployment, with precise and iterative prompts, and it expects the reflection to explain where AI added value and where its suggestions were rejected or significantly modified. My workflow developed toward that approach over the course of the project.

Claude Code

I used Claude Code extensively during the earlier development and implementation stages. My first Claude sessions focused on understanding how to run the project locally because I was initially unsure how the frontend, backend and PostgreSQL database fitted together. I asked questions such as how to run the project, how to view it on localhost, and how to get the backend and database running.

Claude then became more useful as a development assistant for my UC-003 work. I used it to inspect the existing codebase, understand the database and migration structure, implement database plumbing, and troubleshoot issues involving PostgreSQL, Node/Express and the React frontend. For example, the logs show me using Claude around migration problems, missing dependencies such as dotenv, port conflicts, backend startup problems and database relationships.

As my UC-003 implementation became larger, I used Claude to reason about the payroll calculation feature, including payroll lines, statutory rates, performance inputs, incentives, CRUD behaviour and integration with the existing application. I also used it to understand how my changes should be separated into small commits rather than committing everything as one large change. This was important because my work was part of a shared group repository.

Claude was also used for debugging and verification. When something failed, I generally supplied the actual terminal output or browser behaviour rather than asking for generic code. Examples included the backend failing to start, migration failures, frontend dependency problems, and application behaviour that did not match what I expected.

Qwen Code

I used Qwen Code more heavily during the later integration, refinement and review stages. After merging changes from the dev branch, I used Qwen to inspect what had happened to my UC-003 feature and to restore or correct functionality that had been affected by the merge.

A major part of the Qwen work involved iterative debugging of the Payroll Calculation feature. I reported concrete browser and API errors, such as 401, 400, 424 and 500 responses, and asked Qwen to investigate and fix the underlying issues. I also used screenshots and console output when the visual result or runtime behaviour was important.

Qwen was particularly useful for UI refinement. I asked it to improve the layout of cards, align content inside cards, apply consistent button hover behaviour, make payroll summary cards use the available page width more effectively, and make the Payroll Calculation subtabs visually consistent with existing Roster and Staff tabs. I also used Qwen to restore and refine functionality such as Submit for Approval, CRUD operations, edit history, calculation timestamps, sequential staff IDs and run history.

Qwen was also used for Git and project-management tasks. I asked it to help identify the files belonging to small commits, prepare commit messages, explain how to push my branch to dev, explain how to handle pull-request merge conflicts, and generate pull-request descriptions.

Overall, Claude was more prominent during initial setup, implementation and database/backend work, while Qwen was more prominent during post-merge integration, debugging, UI refinement, Git workflow and rubric checking.

2. Where AI Added Value

The biggest value of AI was its ability to work across multiple layers of the application. My project was not only a React interface; changes often involved the frontend, Express/Node backend, PostgreSQL database, migrations, authentication and Git integration. AI helped me trace problems across these layers much faster than inspecting every file manually.

One example was getting the application running. Initially I was unsure how all the project files fitted together. Claude helped me understand the relationship between the frontend, backend and database and helped interpret real terminal errors. This changed my approach from guessing commands to using the project's package scripts and actual error output as evidence.

Another important area was database and migration work. I encountered migration failures involving missing relations and dependencies between tables. Instead of treating the migration error as an isolated message, AI helped me trace which migration created or depended on a particular table. This was valuable because the migration sequence was part of a shared project, so changing one migration could affect other use cases.

AI was also valuable when implementing and restoring UC-003 functionality. Qwen helped me reason through the relationship between payroll periods, payroll lines, staff, rate sets, adjustments and calculation runs. It also helped me identify missing or broken functionality after merging dev, including CRUD operations, Submit for Approval, calculation history and UI navigation.

The debugging process was especially useful when I provided actual evidence. For example, when the browser showed API errors, I gave Qwen the exact status codes and endpoints rather than simply saying that the feature was broken. This allowed the investigation to focus on the real failure rather than generating a completely new implementation.

AI also helped with consistency. I used existing parts of the application as references instead of asking AI to invent an unrelated design. For example, I asked Qwen to use the dashboard's button styling as a reference and to make Payroll Calculation subtabs follow the same interaction and styling pattern as Roster and Staff. This helped preserve the visual language of the group project.

Finally, AI helped me work more systematically with Git. I repeatedly asked for small, meaningful commits and for the files belonging to each commit. This encouraged me to think about changes as separate units rather than treating the whole feature as one large change.

3. Critical Evaluation of AI Output

I did not treat AI output as automatically correct. The logs show several situations where the first solution or diagnosis was not sufficient and I had to provide additional evidence or change the requested approach.

One example was after merging dev. My UC-003 feature appeared to have disappeared, and the Payroll Calculation route was incorrectly taking me to a login page that belonged to my earlier branch implementation. I explicitly clarified that the shared dev login should remain, but the login page that existed inside my Payroll Calculation feature should not. This required AI to distinguish between two different pieces of functionality rather than simply restoring the older code. The final direction was therefore based on the intended application architecture and my ownership of UC-003, not just on whichever code existed previously.

Another example involved the API errors appearing after the merge. The browser showed multiple failures, including 401 Unauthorized responses, 424 Failed Dependency responses and 400/500 errors for UC-003 endpoints. I did not consider a single generic fix sufficient. I used the actual errors to iteratively narrow down the problems and then checked whether the resulting Payroll Calculation feature still behaved correctly.

I also rejected overly broad changes when they did not match the scope I wanted. For example, when I asked for logout-related changes, I specifically required the logout display and feature to be removed only from Payroll Calculation without changing authentication and logout elsewhere in the application. This was important because AI can easily make a technically valid global change that creates a regression in another use case.

The UI work provided another example of critical review. When I asked for cards and form controls to be improved, I gave specific feedback such as keeping the contents inside the card, using integers for quantity increments and floating-point values for $ per unit, and ensuring cards remained evenly distributed instead of wrapping unpredictably. I therefore did not simply accept the first visual implementation; I reviewed it against the intended design and iterated.

I also used AI recommendations selectively for Git. Although AI could suggest a clean single commit, I specifically chose small commits because this was a shared group repository and I needed a clear history of my UC-003 work. This shows that a technically neat suggestion is not necessarily the best project decision.

A further limitation is that AI does not automatically understand team ownership. I had to repeatedly specify that my work was UC-003 and that changes outside my feature could belong to other group members. This became especially important during merges, because fixing one issue by modifying another member's feature could create a larger integration problem.

4. Verification and Quality Control

I verified AI-assisted changes using actual application behaviour rather than relying only on AI explanations.

For backend work, I used terminal output, server startup logs, API responses and database/migration results. For frontend work, I checked the application in the browser and used console errors and screenshots to communicate problems. When an endpoint returned an error, I checked whether the endpoint worked after the proposed change instead of assuming that changing the relevant code was enough.

I also used Git status, branch information, commit organisation and pull-request state to verify that changes were being made on the correct branch and that my UC-003 work could be integrated into dev without unnecessarily including unrelated files.

For the Payroll Calculation feature, verification included checking that the major user-facing functionality remained available after integration: payroll calculation, payroll lines, adjustments, performance inputs, CRUD operations, approval-related behaviour, calculation/run history, timestamps, staff ordering and the relevant navigation and subtabs.

I also used the assignment rubric as a separate verification layer. The rubric explicitly expects strategic AI use across design, coding, testing and deployment and expects meaningful critical reflection rather than a description of AI usage alone. I therefore used Qwen near the end of the process to identify remaining gaps across Sections A, B and C instead of assuming that a working feature automatically meant the assignment was complete.

The rubric also places emphasis on meaningful tests, edge cases, deployment documentation, client requirements and clear demonstration of the application. These criteria helped me realise that implementation alone is not the complete submission requirement.

5. Limitations and Risks

One limitation of AI was that it could misunderstand the state of the application after a merge. A codebase can contain remnants from different branches, so a solution that looks correct in isolation may not match the intended merged architecture.

Another risk was scope expansion. Because AI can inspect and modify many files quickly, it could make a larger change than necessary. I reduced this risk by specifying the feature or files involved, especially when the requested change affected authentication, UI components or shared code.

Database changes were another high-risk area. A migration or schema modification can affect the rest of the team, so I needed to consider migration order, existing data and other use cases before accepting a change.

Generated code can also create false confidence. A feature may compile while still behaving incorrectly in the browser, returning the wrong API response, or breaking another flow. This is why I increasingly relied on runtime evidence, browser testing, terminal output and Git inspection.

There was also a privacy and security consideration when working with AI logs. Some sessions contained sensitive-looking terminal information such as environment configuration and database credentials. I have not reproduced those values in this reflection. This reinforced that AI logs should be reviewed before being submitted as evidence and that sensitive information should not be unnecessarily shared.

6. What I Learned

The biggest change in my workflow was learning to give AI more context and then verify its output. My earlier prompts were often simple questions such as how to run the project. As the project became more complex, my prompts became more specific and evidence-based. I started providing the exact error, endpoint, file, screenshot or expected behaviour and explaining what should not be changed.

I also learned that iterative prompting is more effective than expecting one response to solve a complex feature. For example, the Payroll Calculation work developed through several cycles: identify the problem, make a change, test it, inspect the new behaviour, report what was still wrong, and refine the implementation.

I learned to use different AI tools for different purposes. Claude was particularly useful to me when I was learning the project structure, getting the environment running and working through implementation and database problems. Qwen became particularly useful when I was integrating my work after merges, repairing the UC-003 feature, refining the UI and checking my progress against the assignment requirements.

Most importantly, I learned that AI is better treated as a development partner or debugging assistant rather than an authority. It can search a codebase and suggest relationships very quickly, but it does not know whether a change is appropriate for my team's branch strategy, feature ownership, client requirements or submission scope unless I provide that context.

7. Overall Reflection

Using Claude and Qwen significantly improved my productivity during this project. The most valuable contribution was not simply generating code. It was helping me understand an unfamiliar codebase, trace problems across frontend/backend/database layers, interpret errors, generate possible solutions and iterate quickly.

At the same time, the project showed me why AI output needs human judgment. Some problems required me to reject or constrain a proposed solution because it affected shared code, authentication, database history or another member's work. Other problems could only be confirmed by running the application and checking the browser or terminal.

My use of AI therefore evolved from asking, "How do I make this work?" to asking, "Here is the evidence, here is what I expect, here is the scope, and here is what must not change." I believe this was the most important lesson from using AI in the project.

Ultimately, AI helped me move faster, but I remained responsible for deciding what should be implemented, reviewing the output, testing the result and ensuring that the final changes matched the project requirements. This aligns with the assignment's expectation that AI should be used strategically and critically, demonstrating judgment rather than simply demonstrating AI usage.