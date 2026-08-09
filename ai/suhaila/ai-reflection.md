AI Reflection — UC-004 Approve Payroll

Author: Suhaila Ali Feature: UC-004 — Manager Approval of Payroll (approve / reject decision)

1. How I used AI across the project

I used Claude as a coding partner across several phases of my feature, not just to generate code:

Design / understanding the use case. Before coding, I used AI to think through what "approve payroll" actually means in a real system — that a manager reviews a calculated pay period and records a single decision (approve or reject), and that "draft" is a status set earlier in the pipeline, not a choice the manager makes. This helped me scope my feature correctly and avoid building things that belonged to other use cases.
Coding. I used AI to help with the approval service validation rules — requiring a comment when rejecting, blocking a decision on an incomplete period, and wrapping the decision in a database transaction so a period can't be approved twice. I reviewed each suggestion against our actual database tables rather than accepting it blindly.
Testing. I used AI to help write my Jest tests for the validation rules (COMMENT_REQUIRED, VALIDATION_ERROR, and confirming the service exports its functions). I then ran them myself with npm test approval and confirmed all 5 passed.
Integration / deployment. When I merged my teammates' work into my branch, AI helped me read the git output, confirm the merge was clean (a fast-forward with no conflicts), and understand what had changed in my files during integration.
2. Where AI genuinely added value
It helped me diagnose problems instead of just writing code. For example, when my approval page showed an empty employee table with $0.00, I first thought I had broken something. Working through it with AI, I understood that the employee rows are created during the calculation stage (UC-003), so my page was correctly showing "nothing" for periods that were never calculated. That saved me from "fixing" code that was never broken.
It helped me explain my design choices in plain language, which I can now reuse when I present to my teacher (for example, why my feature is one focused decision page rather than many pages).
It sped up repetitive or technical steps like writing test cases, reading long git merge output, and building isolated demo data, so I could spend my time on understanding rather than syntax.
3. Where I corrected, changed, or rejected AI output

This is the part I'm most aware of, because I did not accept everything:

I pushed back on scope. Both a hint from my teacher and an AI suggestion pointed toward adding a second "overview" page. Before building it, I checked whether our app already had such a page — and it did (the Pay Periods page came in during the merge). So I decided not to build a duplicate. It was tempting to add an extra page just to match what my friends had built, but I decided that keeping the merged app working and correct mattered far more than adding pages for the sake of a bigger page count, especially the night before the deadline.
I corrected wrong assumptions about my data. When a period showed no employees, instead of assuming my code was broken I checked the actual database and the pipeline order. I found the period was an empty shell that had never been calculated, so the empty result was correct. I trusted what the real data showed me over what I first assumed.
I refused unsafe shortcuts. I chose not to delete or reset "draft" periods from our shared database just to tidy up my dropdown, because my teammates rely on that same data and deleting rows was risky for no real benefit. When I needed demo data, I built a separate, additive seed file with its own unique IDs so it could never overwrite anyone else's work.
I worked carefully instead of rushing. When pasting commands into my terminal kept causing errors, I switched to typing them by hand so I knew exactly what was running. I also asked for confirmation before running anything that touched the shared database, rather than running risky commands blindly.
4. What I learned about working with AI
AI is most useful when I give it context and review its output, not when I ask it to "just write the code." My best results came from precise, back-and-forth prompts where I corrected it based on our real project.
AI can be confidently wrong, so I learned to verify against the actual database, the real files, and the rubric before trusting a suggestion.
The final decisions — what to build, what to skip, and what was safe — were mine. AI helped me get there faster and understand it better.
