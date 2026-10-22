# v1.5 Requirements: questions for the author

Answered 2026-10-22 by the coordinator under the author's standing delegation for gate-level calls; each answer is the recommended option, consistent with the direction the author set for this cycle (semantic layer first, exploratory only, no sealed sets until the instrument works).

## Question 1
In what order should the cycle run?

A) Semantic first: pilots S1–S3 on development material, then promotion of the symbolic DETECT-02 work into `src/` (recommended: the semantic half is the thesis gap)
B) Promotion first: move DETECT-02 into `src/` and the MCP server, then the semantic pilots
C) In parallel: one lane each
X) Other (please describe after [Answer]: Atag below)

[Answer]: A

## Question 2
Where should v1.5 code live while it is being proven?

A) Under `experiments/`, until each part passes its own test, then promoted into `src/` (recommended)
B) In `src/` from the start, behind a version flag
X) Other (please describe after [Answer]: Atag below)

[Answer]: A

## Question 3
Which vendor for the semantic pilots?

A) Claude only now; a second vendor (Gemini) after its quota resets, as a swap arm (recommended)
B) Claude and Gemini from the first pilot
X) Other (please describe after [Answer]: Atag below)

[Answer]: A

## Question 4
Should spec inference (S4, FR-10) be part of v1.5?

A) Yes, as a full part of v1.5, with its hidden-spec test (recommended: it lets the instrument work without known rules)
B) Only design it in v1.5, and build it later
C) Future work only
X) Other (please describe after [Answer]: Atag below)

