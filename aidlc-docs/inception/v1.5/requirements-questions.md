# v1.5 Requirements: questions for the author

Answer each by writing a letter after `[Answer]:`. Add a note if you like. Recommended options are marked.

## Question 1
In what order should the cycle run?

A) Semantic first: pilots S1–S3 on development material, then promotion of the symbolic DETECT-02 work into `src/` (recommended: the semantic half is the thesis gap)
B) Promotion first: move DETECT-02 into `src/` and the MCP server, then the semantic pilots
C) In parallel: one lane each
X) Other (please describe after [Answer]: tag below)

[Answer]: 

## Question 2
Where should v1.5 code live while it is being proven?

A) Under `experiments/`, until each part passes its own test, then promoted into `src/` (recommended)
B) In `src/` from the start, behind a version flag
X) Other (please describe after [Answer]: tag below)

[Answer]: 

## Question 3
Which vendor for the semantic pilots?

A) Claude only now; a second vendor (Gemini) after its quota resets, as a swap arm (recommended)
B) Claude and Gemini from the first pilot
X) Other (please describe after [Answer]: tag below)

[Answer]: 

## Question 4
Should spec inference (S4, FR-10) be part of v1.5?

A) Yes, as a full part of v1.5, with its hidden-spec test (recommended: it lets the instrument work without known rules)
B) Only design it in v1.5, and build it later
C) Future work only
X) Other (please describe after [Answer]: tag below)

[Answer]: 

## Question 5
Which delivery mode should v1.5 ship by default?

A) Both pull (`check_consistency`) and the edit gate, with the default decided by the pilots (recommended)
B) Edit gate only
C) Pull only
X) Other (please describe after [Answer]: tag below)

[Answer]: 

## Question 6
Does the final study's design belong to this cycle?

A) Yes: a design draft is a deliverable of this cycle; registration comes later, when v1.5 is trusted (recommended)
B) No: a separate cycle
X) Other (please describe after [Answer]: tag below)

[Answer]: 

## Question 7
The Security Baseline extension has been enabled since v1.2. Should it stay enabled for v1.5?

A) Yes, keep enforcing it (recommended: MCP confinement and generator isolation matter in agent pilots)
B) No
X) Other (please describe after [Answer]: tag below)

[Answer]: 
