# COMPREHEND-01 build: graph tools, question bank and dry run (zero model calls)

**Written:** 2026-10-22 (UTC); the file name follows the coordinator's brief. **Status:** exploratory, **v1.5-exp**,
development material. **Design:** `ops/notes/comprehend-01-design.md` (DRAFT, committed first, 58242c7a).
**Model calls:** 0. **Not changed:** `src/`, `presets/`, `scripts/lib/`, `scripts/v1.3/`, the tag
`v1.4-freeze-2026-10-20` and every registered Study 2b artefact. The frozen MCP server, the DETECT-02 facts and the
EFF-01 harness are imported read-only.

## 1. What was built

| Step | Output |
|---|---|
| Design note, first | `ops/notes/comprehend-01-design.md`: question, arms, six question types, truth sources, scoring, measures, graph-quality diagnosis, link to puzzle behaviour, predictions, failure criteria, pilot plan |
| Four graph tools | `experiments/detect-02/mcp/comprehend/` (index and tools), `comprehend-server.ts`, `comprehend-main.ts`; 15 unit tests |
| Question bank | `experiments/comprehend-01/questions/bank.json`: 30 items, keys written and hand-checked before any graph cross-check (07ce2918) |
| Graph cross-check and latency | `experiments/comprehend-01/graph-check.ts` → `results/graph-check.json`, `results/latency.json` |
| Runner and dry run | `experiments/comprehend-01/run.ts` with a scripted fake model → `results/dry-run/`; 11 unit tests |

## 2. The tools

All four are symbolic and read-only, and every fact they return says whether it was declared in the spec or inferred
from the code. They are served by a separate server (`daedalus-graph`), so the `check_consistency` server and its
PUZZLE-02 arm are unchanged.

| Tool | Answers |
|---|---|
| `context_map` | contexts, aggregates and their owner contexts, published files, commands per context |
| `who_writes(aggregate)` | the commands that save it: file:line, context, cross-context flag, instance, store method, call chain |
| `trace(command)` | the call tree through ports to the adapters that implement them, with reads, writes, IO and unresolved calls per step |
| `impact(file or file#Symbol)` | importers, symbol references, commands reaching it, rules a change there could break (by file kind, and from current findings), layering |

**What the call graph adds to the DETECT-02 facts.** The facts give each command's write footprint. `trace` and
`impact` need the whole call graph, so the index builds one with the same resolution rules (an interface member
resolves to every in-tree implementation: classes, abstract bases and object literals typed by the interface), plus
reads (a store-like owner's method that returns an aggregate), external IO and unresolved calls.

**Latency** (`results/latency.json`, MCP layer, in-process client, `--confine`, one run in this sandbox; ms):

| Tree | Files | Units | First call (cold) | First impact | context_map | who_writes | trace | impact | Largest output (chars) |
|---|---|---|---|---|---|---|---|---|---|
| p1-seed | 18 | 48 | 225 | 301 | 1 | 2 | 1 | 7 | 1,096 |
| p2-seed | 26 | 65 | 251 | 146 | 2 | 1 | 1 | 5 | 1,588 |
| p4-seed | 11 | 37 | 154 | 74 | 1 | – | 0 | 6 | 754 |
| fx-p05-positive | 13 | 24 | 125 | 64 | 1 | 0 | 0 | 2 | 1,586 |
| fx-p07-positive | 14 | 25 | 106 | 83 | 1 | 1 | 1 | 3 | 1,621 |
| fx-p08-positive | 17 | 31 | 175 | 120 | 1 | 0 | 0 | 3 | 2,608 |
| fx-p09-legit | 13 | 25 | 146 | 76 | 1 | 0 | 1 | 9 | 1,465 |
| lucashang-ddd-payday | 61 | 114 | 484 | 280 | 1 | 0 | 1 | 6 | 3,782 |
| meetinger | 144 | 263 | 1,333 | 743 | 1 | 0 | 1 | 5 | 4,899 |
| ddd-forum | 250 | 433 | 1,884 | 1,124 | 1 | 0 | 1 | 4 | 2,621 |

- The warm columns are the maximum over the bank's arguments.
- The first call builds the index (two ts-morph passes: the facts and the call and import graph).
- The first `impact` also runs the DETECT-02 rules once, for the current findings.
- Outputs stay under about 5,000 characters, roughly 1,200 tokens.
- An end-to-end stdio smoke, starting the server exactly as an FG session's MCP config does, lists the four tools and
  answers `context_map` on p2-seed (2.2 s including process start) and ddd-forum (4.7 s).

## 3. The question bank

| Type | Items | Class | Items |
|---|---|---|---|
| W writes | 8 | G: a tool answers | 16 |
| C call chain | 6 | Gw: the nearest tool output is wrong or incomplete | 3 |
| R rule risked by a planned change | 5 | S: the spec in the prompt answers | 4 |
| I impact (importers) | 4 | X: no tool answers (plans, placement) | 7 |
| P placement | 4 | | |
| O owner context | 3 | | |

**Trees:** P1 seed 4, P2 seed 6, P4 seed 3, precision fixtures 4 (p05, p07, p08 positive; p09 legit), and three human
DDD repositories with declared specs: lucashang-ddd-payday 4, meetinger 4, ddd-forum 5. The repositories are cloned at
their pinned SHAs (`trees.json`) and analysed without installing their dependencies, as the precision pass did.

**How the keys were made.** Every key was read from the code (file:line in `provenance.read`), from the spec (owner
items), or from the puzzle's documented trap and clean lines (R and P items on the seeds). The keys were committed
before any tool was run on the bank. Seven items carry a `behaviour` link to a puzzle trap or clean step (design §8).

**Cross-check against the tools** (`results/graph-check.json`, after the keys were committed):

| Class | Items | Answered by a tool | Tool answer correct |
|---|---|---|---|
| G | 16 | 16 | 16 |
| Gw | 3 | 3 | **0**, as predicted |
| S | 4 | 3 | 3 |
| X | 7 | 0 | – |

The three Gw items, each predicted in the key's provenance before the cross-check, and each a coverage gap (D2):

| Item | What the code does | What the graph misses |
|---|---|---|
| LH-WW1 | Deposit and Withdraw save the Account through `update(t: UpdatePartial<Account>)` | the mapped type is not read as an Account parameter, so who_writes lists only the two creating commands |
| MT-WW1 | CreateMeetingUseCase saves `meetingOrError.unwrap()` | the Result type comes from a package that is not installed, so the argument is untyped and the write is missed |
| DF-C1 | user creation reaches CreateMember through a Sequelize `afterCreate` hook and a `DomainEvents.register(callback)` registry | neither is a resolvable call, so trace stops at `SequelizeUserRepo.save` |

**One tool revision, T1 (2026-10-22, after the cross-check, no key changed).** The first cross-check found one G item
wrong: P4-C1, the chain from the controller to the loan insert in the Layered seed. The default `trace` view hid the
step into `LoanGateway.insert`. It is a direct call to a class in a tree with no aggregates, so the step had no port
crossing, read or write. The fix: a step into an adapter (an infrastructure or persistence file) is always shown.
After T1, 16 of 16 G items agree.

The fix was found on this bank, so the G agreement is a development result, not a validation of the tools. The same
cross-check also caught a server bug before it was committed: `--tsconfig` was not passed through to the index.

## 4. Dry run (scripted fake model, zero calls)

`run.ts` runs the full plan with a scripted fake model that writes stream-json in the shape the EFF-01 transcript
reader parses. It uses the real argv builder (F is EFF-01's R argv; FG adds one MCP config and the four allow rules,
checked by `checkArmArgs` and `checkEff01Args`), per-session MCP configs and call-log paths, confinement checks,
re-runs, the hard cap, scoring and the ledger.

**The script.** FG copies the tool answer wherever a tool answers the item; otherwise both arms answer the key. Seven
scripted faults are added: two wrong F answers, one missing answer line, one turn-cap hit, one wrong FG answer on an X
item, one FG session with no graph call, and one confinement leak followed by a valid re-run.

**Result** (`results/dry-run/summary.json`): every number below is what the script dictates, which is the check.

| Measure | Value |
|---|---|
| Sessions spawned (fake) | 63 = 62 planned + 1 re-run; 0 refused; hard cap 66 |
| Invalid sessions | 1 (`DF-P1-FG#1`, a Read outside the tree), re-run valid |
| Cap hits / format failures | 1 (`P4-I1-F`, turns) / 1 (`LH-I1-F`) |
| Accuracy F / FG | 0.867 / 0.867 (all items); 0.852 / 0.963 (non-Gw) |
| By class, FG | G 1.00, Gw 0.00, S 1.00, X 0.857 |
| Token ratio FG/F (geometric mean) | 0.785 (fake token numbers: plumbing only) |
| FG sessions without a graph call | 1 |
| Diagnosis candidates for wrong FG answers | 3 Gw items → "D1 or D2" (the tool output was wrong); 1 X item → "to read" |

**Unit tests** of the runner (`run.test.ts`, 11 tests) cover:
- every key scores 1, and every perturbed key scores below 1;
- the 62-cell plan is reproducible;
- the argv of each arm;
- confinement;
- a re-run allowance of 4 that is enforced;
- the pilot stopping on a second leak;
- a hard cap that refuses the next spawn;
- cap hits and missing answers scoring 0.

**Live path.** It exists but was not run. It is refused unless `COMPREHEND01_LIVE=1`, `--live`,
`--confirm-sessions 62`, the frozen bank's SHA-256, a CLI binary and an absolute config directory are all given.

## 5. What this does and does not show

- It shows that the tools answer the bank's tool-answerable items in milliseconds, that the three predicted gaps are
  real and diagnosable, and that the runner, scorer and ledger work end to end with zero calls.
- It does **not** say anything about the arms. The dry-run accuracies and tokens are scripted.
- **Limits.**
  - The bank is small (30 items) and was written by a Claude session, as was the subject's model family (design §9).
  - The G labels were checked against the same tools they describe, after revision T1.
  - The human repositories are analysed without their dependencies, which causes one of the three gaps (MT-WW1).
    Whether the pilot installs dependencies is an open question for the author.

**Place in the v1.5 cycle.** `aidlc-docs/inception/v1.5/` reached main after this build started. COMPREHEND-01 is not
one of its units U1–U7; it is closest to U2 (delivery). FR-4 asks for under 200 ms per symbolic call: warm calls meet
it, but the cold first call, which builds the index, does not.

## 6. Before the pilot (the author)

1. Read the design note and decide D1–D4 (§11 there): the types and classes, FG's tool set, the size (62, cap 66),
   and an open-answer type.
2. Approve the bank, which freezes it by SHA-256; then the live run, with its guard, on the same commit as a green
   dry run.
3. Decide whether the human repositories are analysed with installed dependencies. This would close MT-WW1's gap and
   change its class to G.
