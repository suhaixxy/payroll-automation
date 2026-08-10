# AI Reflection — UC-001: Roster and Staff Management

## How I Used AI

I used Codex, Claude Code and other AI tools as development assistants while working on UC-001. My work focused on the roster and staff-related parts of the payroll system: roster synchronisation, staff records, pay periods and backpay reports. I used AI to understand the existing project structure, locate the relevant frontend and backend files, improve page layout, identify UI issues and check the final changes before committing them.

I used Claude Code mainly when I wanted help turning a specific requirement into a coding approach. For example, I could describe the expected behaviour of the roster or staff pages and ask it to identify the relevant files, suggest the smallest change, or explain how existing data was passed from the API into the interface. Claude Code was helpful for drafting code and for explaining unfamiliar parts of the project, but I did not treat its first answer as final.

I used Codex to inspect the project, make targeted changes and run checks. It was particularly useful for searching across the frontend and backend, comparing similar pages, reviewing Git status and running the production build. Using more than one AI tool also helped me compare suggestions instead of relying on a single answer.

## Where AI Helped

AI was useful for tracing how the roster-related pages were connected. It helped me identify the pages and API modules for Roster Sync, Staff, Pay Periods and Backpay Reports, then compare their layout with the roster page so the screens used a more consistent design. It also helped improve the Staff page by making weekly availability apply only to part-time staff, since full-time staff already have committed working hours.

AI also helped with practical development tasks such as understanding Git branches, checking the working tree, creating commits and pushing work to the remote repository. This was helpful when preparing my changes for the shared development branch.

Another useful part of the workflow was prompt refinement. When an AI suggestion was too broad or did not match the screen I was looking at, I gave a more specific follow-up prompt. I explained the page, the exact UI problem, what should not be changed and the expected outcome. This was more effective than asking for a general redesign because it kept changes focused on UC-001 and made them easier to review.

## My Own Judgement and Decisions

I did not accept AI output without reviewing it. I checked both my prompts and the generated code carefully to make sure the result really matched the requirement before allowing changes to be applied. I tried to be specific about the page, the feature, and the behaviour I expected. If a suggestion did not make sense, looked too broad, or risked affecting another member's work, I asked for clarification or chose not to use it.

I decided that the roster sync page should remain unchanged when it was already working well, while the Staff, Pay Periods and Backpay Reports pages needed to match its visual standard. I reviewed the proposed UI changes and kept the existing API behaviour rather than changing backend contracts unnecessarily. This was important because the pages are part of an integrated application and a visual improvement should not break the existing roster and payroll workflow.

For staff availability, I decided that a generic “Max weekly hours” field was unclear. I changed the wording to “Weekly availability (hours)” and limited it to part-time staff. This matches the payroll context better because full-time staff already have committed standard hours.

I also reviewed the layout of filtering controls and summary cards. One issue was that the status selector could become visually cramped. Instead of accepting an initial assumption that the problem was only cosmetic, I checked the affected page and refined the layout so the selector had a clear desktop width and a full-width layout on smaller screens. This showed me that frontend work needs both code inspection and visual checking.

## Verification

I checked the affected frontend pages and ran the production frontend build using `npm.cmd run build`. The build completed successfully. I also ran the frontend lint command and reviewed its output. The remaining warnings were in unrelated files, not in the UC-001 pages I worked on.

I reviewed Git status and commits before pushing the work, so I could confirm which changes were included on my branch. I checked that the relevant commit was on my feature branch before pushing it to GitHub. This was important because the repository contains work from several team members and I needed to avoid accidentally treating another person's work as my own.

## Limitations and Risks

AI can suggest changes that look correct in code but need to be checked in the actual browser. UI spacing, responsive behaviour and form labels especially need human review. A short or unclear prompt can also lead to an answer that solves a different problem from the one intended. For this reason, I learned to state the exact page, current issue, required outcome and scope before asking AI to make a change.

In a group project, AI can also suggest changes outside my assigned use case, so I kept my work focused on UC-001-related pages and avoided changing unrelated functionality. I also needed to be careful with AI logs because they can contain local file paths, tool output or other information that should be reviewed before submission. The submitted evidence should show the relevant project workflow without exposing unnecessary sensitive information.

## What I Learned

I learned that AI is most useful when I give it a specific task, such as finding the files for one feature, improving one screen or checking an error. I learned that the quality of the prompt affects the quality of the result. Clear constraints such as “keep the existing API”, “do not change the roster sync page” and “only update the staff-related pages” helped keep the changes safe and relevant.

I also learned that clear labels are important in payroll software because users need to understand what a field means before entering data. Renaming “Max weekly hours” to “Weekly availability (hours)” made the purpose of the field clearer for part-time staff. Finally, I became more confident using Git to check a branch, commit selected work and push it to the shared repository.

## Overall Reflection

AI made the UC-001 work faster by helping me inspect the codebase, refine the interface and verify changes. Claude Code helped me formulate and explore coding approaches, while Codex helped me inspect, implement and check changes in the repository. However, the final decisions remained mine. I reviewed prompts and suggestions, checked generated code against the actual requirement, kept the work within my assigned scope and verified the build before committing the result.
