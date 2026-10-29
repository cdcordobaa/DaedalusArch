# SO5 failure-pattern taxonomy (S-TAX): design note

Date: 2026-10-29. Written and committed **before any case is collected or read for coding**. Descriptive only: no test,
no confirmatory claim. Delivers the proposal's SO5 product, a reproducible failure-pattern taxonomy built by open
coding (never derived before; Kap8 old §8.2 unwritten, Kap9 "FPAT is a rule-family profile", methodology review
2026-10-08 item B4). Thesis slot: Kap8 SO5 section (about 2 pages) with the codebook in an appendix.

## 1. Question

What do coding agents do when they break a declared architecture? Named by the agent's action and its apparent
motive, not by which rule fired: a rule id is evidence, never the code.

## 2. Sources (zero model calls; all are committed records)

| Source | What it contributes | Facets available |
|---|---|---|
| Study 1 (v1.2E E1 grid, `results/e1-grid/`, `results/v1.3-study1-rerun/`) | Violations in greenfield builds | model × spec level × style |
| Study 2b (`results/v1.4-study2b/`) | The inherited wiring shortcut and its spread or removal per step | spec level / tool cell, Layered |
| HEXDDD-01 hand read (`results/v1.4-pilot-hexddd-01/`, report 2026-10-20) | 9 non-import violations, already described | Hexagonal + DDD, brownfield |
| PUZZLE-01 to PUZZLE-04 (`results/v1.4-puzzle-0*`) | Trap failures with oracle verdicts | DDD / Hexagonal, arms |
| TRAPRATE-01 (`results/v1.5-traprate-01/`) | Trap failures and admitted-rule identities, agent alone | DDD / Hexagonal |
| v1.5 final study (`results/v1.5-study/lane-a`, `lane-b`) | **Only after** its registered analysis is run and recorded | arm × style |

Never read: the MEAN-01 sample, `daedalus-sealed/`, any sealed hold-out, the calibration sets' cases (they are
builder-written, not agent behaviour).

## 3. Unit of analysis

A **failure episode**: one agent session's introduction of one architecturally wrong construct, located by a file and
the step that introduced it. Sources are reduced to episodes as follows:
- a new violation identity (rule + file + subject) first present at a step, or
- an oracle trap sub-goal failed at the final step (with the hunk that fails it), or
- a hand-read violation (HEXDDD-01).
Several identities from the same construct in the same session (for example one wiring line repeated per feature) are
one episode with a multiplicity. Repairs (an inherited violation removed) are coded separately as **repair episodes**
under the same procedure, so the taxonomy also says what agents do right.

## 4. Sampling

All episodes from HEXDDD-01, PUZZLE-01–04 and TRAPRATE-01; Study 1 and Study 2b capped by a seeded stratified draw
(mulberry32, seed 20261029) of at most 60 episodes each, stratified by model × spec level (Study 1) and cell × step
(Study 2b), so that one source cannot dominate. The final-study outputs enter only after their analysis is recorded,
with the same cap per lane. Counts drawn and not drawn are reported.

## 5. Coding procedure

1. **Episode cards** (zero calls, scripted): source, facets, file, step, the diff hunk (at most 40 lines) and the
   enclosing type, the rule ids or oracle sub-goal as evidence. No task names in the card text beyond the neutral id.
2. **Open coding** (first coder, this session): a short code per card for the action ("wires repositories in the HTTP
   app file", "copies vendor decline codes into a port type", "saves two aggregates in one command"), with a memo of
   the apparent motive where the code shows it (shortest path to a passing test, imitation of existing code, request
   wording, missing abstraction).
3. **Axial grouping** into 6–12 categories. Each category gets: a name, a one-sentence definition, include and exclude
   rules, and 1–2 anonymised examples (the codebook). Categories are named by action, cutting across styles where the
   action is the same.
4. **Second coder** on a seeded ~20 % sample, blind to the first coder's codes and to the facets: Cohen's κ per category
   assignment, and the confusion table. **The second coder is the author's decision** (the author on a subset, or a
   model panel as in DEV-1, with the same-vendor limit stated). Step 4 does not start until it is chosen.
5. **Freeze** the codebook with a date and a sha256 before counting.
6. **Counts**, descriptive: episodes per category by model × spec level × style (and arm, for the tool runs), with
   source shown; no tests, no p values.

## 6. Limits, stated now

- Claude-only for the v1.5 sources; Study 1 adds the models it ran.
- The first coder wrote the instrument and knows the results; the second coder and the frozen codebook bound this.
- Episodes come from trap tasks for most v1.5 sources, so category frequencies reflect the traps offered, not natural
  rates; counts are reported per source.
- HEXDDD-01 and the puzzle results are owned by the AGENT paper; the thesis uses them, the paper is cited.

## 7. Outputs

`experiments/so5-taxonomy/` (card builder, cards, codes, codebook, counts), report
`Docs/DiagnosticRuns/so5-taxonomy-<date>.md`, thesis Kap8 SO5 section and appendix codebook.
