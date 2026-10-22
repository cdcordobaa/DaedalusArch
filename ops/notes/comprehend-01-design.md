# COMPREHEND-01: does the property graph help agents understand an architecture?

> **DRAFT, for the author.** Written and committed **before** the graph tools, the question bank and the dry run.
> No model call has been made for COMPREHEND-01, and none is made until the author has read this note and approved
> the pilot (§10). Comment inline with `> AUTHOR:`.

**Date:** 2026-10-22. **Status:** exploratory, **v1.5-exp**, development material. **Code:** `experiments/comprehend-01/`
(question bank, runner, dry run) and additions to `experiments/detect-02/mcp/` (four graph tools). Nothing under
`src/`, `presets/`, `scripts/lib/`, `scripts/v1.3/`, the tag `v1.4-freeze-2026-10-20` or any registered Study 2b
artefact changes; the frozen MCP server, the DETECT-02 facts and the EFF-01 harness are imported read-only.

**Related notes.**
- `ops/notes/eff-01-efficiency-design.md`: the same arms idea on the *verdict* surface (the 11 frozen tools). Its
  harness is merged (U8, `scripts/v1.3/lib/eff01/`, PR #259).
- `ops/notes/detect-02-design.md` and `ops/notes/detect-02-precision-note.md`: the facts this study exposes.
- `ops/notes/v15-plan.md` §3, "Graph at the start: structure given before acting". This note is the measurement that
  track needs before any delivery design.

---

## 1. The question

**Does the property graph make an agent understand an architecture more accurately, more cheaply, or both?**

"Understand" is narrowed to six kinds of question an agent must answer correctly before it changes a DDD or hexagonal
codebase safely (§3). "The property graph" means the DETECT-02 facts (write footprint per command, context
ownership, port calls resolved to adapters) served through four read-only tools (§4). "Cheaply" means tokens, tool
calls and wall time per question.

EFF-01 asks a different question: whether the instrument's **verdict** API (rule counts, layer look-ups) answers
import-graph questions better than files. COMPREHEND-01 asks whether **architectural facts** (who writes what, through
which port, owned by whom) help with the questions that sit behind the puzzle traps. The two can disagree, and both
results are reportable.

## 2. Arms

The same questions, the same frame, the same caps, the same subject model as EFF-01 (`DEFAULT_MODEL` in
`scripts/v1.3/lib/eff01/types.ts`), one session per question.

| | **F: files only** | **FG: files plus graph tools** |
|---|---|---|
| Built-in tools | Read, Grep, Glob | Read, Grep, Glob |
| MCP | none (`--strict-mcp-config`, no `--mcp-config`) | the comprehension server alone (`experiments/detect-02/mcp/comprehend-main.ts`, `--confine`, `--call-log`): `context_map`, `who_writes`, `trace`, `impact` |
| cwd | the tree root | the tree root |
| Condition sentence | "You can read the project's files with the Read, Grep and Glob tools; the project root is the working directory." | the same sentence, plus "You can also query the project's architecture graph with the context_map, who_writes, trace and impact tools. Check what they say against the code when it matters." |

**Why FG keeps the files.** The realistic use is files *plus* graph, and EFF-01's amendment A1 reached the same
conclusion. A graph-only arm would measure a different thing (can the graph replace reading), and is left out of the
pilot.

**Why FG gets the four tools only, not the 11 frozen ones.** The frozen surface is EFF-01's treatment. Mixing them
would make a difference between arms unattributable. The author may choose to add them (open decision D2, §11).

**The spec goes into the prompt in both arms** (the `architecture:` block, verbatim, as in EFF-01), so knowing the
layer map and the declared contexts costs both arms the same. On trees without a declared DDD block, the prompt says
so.

**The frame** (identical except the condition sentence; its SHA-256 is recorded per session):

```text
You are answering one question about the architecture of a TypeScript project. Base your answer on evidence you
gather in this session.

<condition sentence>

The project's architecture spec (the `architecture:` block of its spec YAML):
<verbatim block>

Conventions:
<the conventions of experiments/comprehend-01/questions/conventions.json, verbatim>

Question: <question text>

End your reply with exactly one line:
ANSWER: <the question's answer format as JSON>
```

## 3. Question types, with examples

Six types. Each has a machine-scorable answer format. Examples are from the trees in §5; the final wording is in the
question bank.

| Type | What it asks | Example | Answer format | Why it matters |
|---|---|---|---|---|
| **W** writes | Which aggregates (and how many instances) a command writes, through any depth of calls | "Which aggregate roots does `PlaceOrder.execute` in P2 save, directly or through calls it makes?" | `{ "aggregates": [..] }` | the R-D4 trap is a wrong answer to this question |
| **O** owner | Which context owns an aggregate, and whether that was declared or must be inferred | "Which bounded context owns `Account` in lucashang-ddd-payday?" | `{ "context": ".." }` | the R-XCTX trap needs it |
| **C** chain | The call chain from a command to persistence, through ports to adapters | "List the units `CreateUserUseCase.execute` passes through before an Account is written, ending at the store method." | `{ "chain": [..], "writeFile": ".." }` | ports hide adapters; reading must jump the indirection |
| **I** impact | The dependents of a file or symbol, and what a change there touches | "Which production files import `src/sales/domain/order/Order.ts`?" | `{ "files": [..] }` | a change's blast radius |
| **P** placement | Where new code belongs (layer, context, folder) | "A handler that credits the destination account when a transfer is sent: which folder should hold it?" | `{ "path": ".." }` scored against accepted globs | the clean line of a puzzle starts here |
| **R** risk | Which rule a planned change would risk, from a fixed menu | "If `PlaceOrder` also called membership's `awardPoints` before returning, which rules would the change break?" | `{ "rules": [..] }` from `R-D4, R-XCTX, R-D5, R-D9, R-H5, R-INJ, R-RTX, none` | the planning step the agents skipped in PUZZLE-01 |

**Classes, as in EFF-01, fixed before any call.** Each item is labelled with what the graph tools can do for it:
- **G**: a graph tool returns the answer or its parts.
- **Gw**: the nearest tool output is incomplete or wrong (a depth limit, an unresolved call, an inferred root, a
  functional-style codebase with no facts). The design predicts that FG *loses or ties* on these.
- **S**: the spec in the prompt answers it; the design predicts a tie.
- **X**: no tool exposes it (placement of code that does not exist yet); the design predicts a tie.

## 4. The graph tools (built after this note; zero model calls)

All symbolic, deterministic and read-only. They read the DETECT-02 facts (`experiments/detect-02/lib/`) and a call
graph built in the same ts-morph pass style. Each returns structured JSON plus a short text block, and states for
every fact whether it came from the spec (**declared**) or from the code (**inferred**).

| Tool | Input | Output |
|---|---|---|
| `context_map` | none | contexts (name, root, published files, declared or inferred), aggregates (name, owner context, root file:line, module, declared or inferred), commands per context, roots with no owner |
| `who_writes` | `aggregate` | every command that writes it: command file:line, owner context of the command, cross-context flag, instance names, the call chain to the write, and the write site file:line and store method |
| `trace` | `command` (`file#Class.method` or `Class.method`) | the call tree from the command through ports to the adapters that implement them, with, at each step, the file:line, the unit and its role, and the reads and writes of aggregates there |
| `impact` | `target` (a file, or a symbol `file#Name`) | importing files, referencing files, the commands whose call tree passes through it, and the rules a change there would risk (from the target's role and the current findings that involve it) |

They are served by a separate entry (`comprehend-main.ts`), so the existing `check_consistency` server and its
PUZZLE-02 arm are unchanged. Latency is measured on every tree in the bank, cold (first call, index built) and warm.

## 5. Truth sources

**The answer key is written first, before any session, and every answer is checked by hand against the code.** A
graph fact is never accepted as truth on its own: the graph is what is being tested, so a key copied from it would
make FG right by construction.

| Source | Trees | What it settles | How it is checked |
|---|---|---|---|
| Puzzle seeds | P1 `p1-transfers`, P2 `p2-loyalty` (DDD, declared aggregates), P4 `p4-library-holds` (Layered, no aggregates) | W, O, C, I, R, and P against the puzzle's documented clean line (`README.md`, "The winning line") | each answer read from the seed's code, file:line recorded |
| Precision fixtures | `experiments/detect-02/fixtures/precision/` (P1 to P10, legit and positive trees) | W and R on the patterns that look like violations and are not (outbox, child entities, read-only cross-context, ACL question) | the fixture's own `fixture.json` statement plus a code read |
| Human DDD repositories with declared specs | at least 3 of the 12 with declared aggregates in `results/v1.3-external*/specs/` (precision note §7): lucashang-ddd-payday, meetinger, ddd-forum | O from the declared spec; W, C, I from the code at the pinned SHA | code read at the pin; the declared spec quoted |

**Provenance per answer.** Every key entry records: the tree and pin, the files and lines read, the method (code
read, spec quote, compiler query), whether the graph tools agree, and, when they do not, which fact is missing or
wrong. That last field is the start of the graph-quality diagnosis (§7).

**When the key and the graph disagree,** the key follows the code and the item is labelled **Gw** before any call.
Such items are wanted: they are the questions on which the graph arm should lose.

## 6. Scoring

Machine-scored wherever the answer has a fixed form; a written rubric otherwise. The answer line is parsed by the
EFF-01 extractor (`extractAnswer`, `scripts/v1.3/lib/eff01/score.ts`), so a missing or unparsable line scores 0 in
both arms.

| Type | Primary score | Secondary |
|---|---|---|
| W | 1 if the set of aggregate names is exact | Jaccard |
| O | 1 if the context name is exact (case-insensitive) | none |
| C | 1 if every required hop is present in order and the write file is right; required hops are the command, each port or interface crossed, the adapter, and the store method | fraction of required hops present, in order |
| I | 1 if the set of files is exact | Jaccard |
| P | 1 if the path matches one of the accepted globs, 0.5 if only the layer and context are right | none |
| R | 1 if the set of rules is exact | Jaccard |

**Open answers.** The six types have closed formats on purpose. A short free-text `why` field is collected in every
answer and not scored in the pilot; it is read for the diagnosis. If the author wants a rubric-scored open item (for
example "explain why this command is legitimate"), it is added as a seventh type with a 0/1/2 rubric, read blind to
the arm by a second reader.

## 7. Measures

Per question and arm:
- **accuracy**: the primary score, and the secondary;
- **tokens**: processed tokens (input, cache creation, cache read, output) from the result envelope, as EFF-01
  (`tokensFromEnvelope`);
- **tool calls**: per tool name, from the stream-json transcript (`readTranscript`, `toolCallCounts`);
- **wall time**: the driver's clock and `duration_ms`;
- **graph use**: in FG, how many calls went to each graph tool, and whether the cited facts appear in the answer.

**Graph-quality diagnosis.** Each wrong FG answer is traced to one cause, read from the transcript and the tool
outputs:

| Code | Cause | What it says about the graph |
|---|---|---|
| D1 | a tool returned a **wrong** fact and the answer used it | a fact bug: fix the facts |
| D2 | a tool **missed** a fact (depth limit, unresolved call, no facts for this style) | a coverage gap |
| D3 | the tool was right, the agent misread or ignored it | delivery or wording, not the graph |
| D4 | the agent never called a graph tool | delivery |
| D5 | the key is disputed on re-reading | the key; corrected with a dated note and reported both ways |

D1 and D2 are the graph's own errors; they feed the DETECT-02 revision list. D3 and D4 are about how the tools reach
the agent.

## 8. The link to behaviour

PUZZLE-01 showed agents taking the trap line on P1 and P2 (0/5 clean solves each) while the rules were written in the
seed's `ARCHITECTURE.md`. Two readings fit that:
1. **They did not understand** (comprehension): they could not see that `TransferMoney` writes two `Account`s, or
   that `awardPoints` writes a `Member` owned by another context.
2. **They understood and did it anyway** (knowing and doing): the pressure sentence and the shorter line won.

COMPREHEND-01 separates the two for the puzzle items. For each puzzle, the R and W items about the trap step ("which
rule would this planned change break") are compared with the trap rate in the PUZZLE-01 baseline and in the PUZZLE-02
tool arm:
- if the F arm answers them correctly, the failure is **not** comprehension, and graph tools can only help through
  delivery at the moment of action (the edit gate, `ops/notes/v15-edit-gate-design.md`);
- if F fails and FG succeeds, "graph at the start" is worth designing;
- if both fail, the rule itself is not understood, and the message wording is the first fix.

This is descriptive: two puzzles, one run per arm in the pilot. It decides which v1.5 delivery track to build next,
and claims nothing on its own.

## 9. Scenarios, edge cases, predictions and failure criteria

**Scenarios and edge cases, decided now.**
1. **Ceiling on small trees.** The seeds have 12 to 27 files; both arms may score 1.0. Expected: there the signal is
   tokens and calls only. The human repositories are where accuracy can differ.
2. **The graph misleads.** Gw items exist on purpose. If FG follows a wrong tool output, that is D1, a result.
3. **The agent ignores the tools.** Counted (D4), not re-run. If FG makes no graph call on more than half its
   sessions, the condition sentence is revised once before any main run, and that is the only change allowed.
4. **Tool output too large.** `who_writes` and `trace` on ddd-forum could be long. Outputs are capped (at most 25
   rows per list, with the total stated) and the cap is reported; an item whose answer is beyond the cap is labelled
   Gw.
5. **Functional-style or event-sourced code.** The facts are thin there (precision note §7). Such items are Gw.
6. **Memorisation.** ddd-forum is well known. Both arms see it; the difference is what matters, and its items are
   reported separately.
7. **Confinement.** An F session that calls an `mcp__` tool, or an FG session that reads outside the tree, is invalid
   and re-run once (EFF-01's `checkConfinement`). A second leak stops the pilot.
8. **Question leakage.** A question must not name the answer (no "the two aggregates", no rule ids in W, C, I and P
   questions). The bank is checked for that before it freezes.
9. **Key errors.** Disputed with code evidence: corrected with a dated note, the item reported both ways (D5).

**Predictions** (stated now, per class and tree size):

| Id | Prediction | Reading if wrong |
|---|---|---|
| PR1 | On G items in the human repositories, FG is at least as accurate as F, and more accurate on C and W | the facts do not help where reading is hard |
| PR2 | On the human repositories, FG uses fewer processed tokens per question (geometric-mean ratio < 0.8) | the tool schemas and outputs cost more than they save |
| PR3 | On the puzzle seeds and fixtures (≤ 30 files), FG is no cheaper (ratio ≥ 0.8) and accuracy ties | a favourable surprise: the graph pays even on tiny trees |
| PR4 | On Gw items, FG is no more accurate than F | FG answered without the facts its tools give: check the transcripts |
| PR5 | On S and X items, accuracy ties | a frame or prompt difference leaks between arms |
| PR6 | In F, the R items about the puzzle trap steps are mostly answered correctly | the baseline failures are comprehension failures (§8, reading 1) |

**Failure criteria for the graph claim** (descriptive in the pilot; they become the confirmatory falsifiers if a main
run is approved):
- **"more accurately" fails** if the mean per-item difference (FG − F) over the non-Gw items is ≤ 0.05;
- **"more cheaply" fails** if the geometric-mean token ratio FG/F over the non-Gw items is ≥ 0.9;
- **the graph is not trustworthy enough to serve** if D1 (wrong facts used) accounts for more than 2 wrong FG answers,
  or if any Gw item was not predicted in the key.

**Failure criteria for the pilot as plumbing:** more than 3 of 60 sessions with a missing or unparsable answer line,
any second confinement leak, or any session over the caps that is not reported as a cap hit.

## 10. Pilot plan (NOT run now)

| Block | Sessions |
|---|---|
| Calibration: fixed overhead per arm ("Reply OK", no question), one per arm | 2 |
| Pilot: about 30 questions × 2 arms × 1 run | 60 |
| Re-run allowance (confinement leaks, interruptions) | 4 |
| **Hard cap** | **66 sessions**; the runner refuses to spawn a 67th |

- **Caps per session,** as EFF-01: 600 s wall time, 30 turns (`--max-turns 30`), 400,000 processed tokens after the
  fact. A cap hit scores 0 and keeps its tokens.
- **Order:** a seeded shuffle (seed 20261022) of all cells, arms interleaved; at most 2 lanes.
- **Before the first call:** the author approves this note, the question bank (frozen by its SHA-256), the call count
  and the cap; the runner's dry run (§12) is green on the same commit.
- **Not in the pilot:** repeated runs (variance), a graph-only arm, the frozen tools in FG, a second vendor.

## 11. Open decisions for the author

- **D1.** Approve the six types and the class labels, or change them, before the bank freezes.
- **D2.** FG with the four comprehension tools only (recommended), or with the 11 frozen tools and
  `check_consistency` as well.
- **D3.** The pilot size (62 planned, cap 66), and whether a variance run (×3) follows if the pilot is informative.
- **D4.** Whether an open-answer type with a blind rubric is added (§6).

## 12. What is built in this step (zero calls)

1. This note, committed first.
2. The four tools, unit-tested, with latency measured on every tree in the bank.
3. The question bank (`experiments/comprehend-01/questions/`), about 30 items, answers written first and checked by
   hand, provenance per answer.
4. A runner under `experiments/comprehend-01/` with a **scripted fake model** for both arms: it emits stream-json
   transcripts (a correct answer, a wrong answer, a missing answer line, a tool call) through the same parsers
   EFF-01 uses, and checks the plumbing, the scoring and the ledger with zero calls.
5. A build report (`Docs/DiagnosticRuns/comprehend-01-build-2026-10-23.md`) and a research-log entry.

## Changelog
- 2026-10-22: v0 draft, before any tool, question or run.
- 2026-10-22: built, not run (`Docs/DiagnosticRuns/comprehend-01-build-2026-10-23.md`). The bank has 30 items
  (W 8, C 6, R 5, I 4, P 4, O 3; G 16, Gw 3, S 4, X 7). The rule menu of R items adds LAYER and CTX-ISOLATION to the
  DETECT-02 rules (`experiments/comprehend-01/questions/conventions.json`). One tool revision after the graph
  cross-check: T1, the default `trace` view keeps every step into an adapter. No key changed.
