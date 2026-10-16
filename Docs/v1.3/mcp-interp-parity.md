# MCP blocking parity through the Cypher interpreter (backlog job V1)

Status: tooling, development set only. OFF by default. Do not merge without the author's review.

## 1. Problem

`check_file`, `check_diff` and `check_import` decide blocking findings with TypeScript re-statements of the rules
(`src/mcp-server/fast-rules.ts`, `spec-rules.ts`, `import-check.ts`). The scored evaluation runs the compiled Cypher of
the spec. Two definitions of one rule can drift:

- #142 (`Docs/v1.3/loop-replay.md` §4, risk 1): in the replay the `daedalus-mcp` agent got no blocking feedback on the
  hexagonal and DDD steps where the full evaluation blocked (`dependency-direction-graph`, `core-isolation`,
  `context-isolation`). Gate line V9 is RED.
- #161 (floor-probe report §3.7): (1) `check_import` returns `allowed`/`pass` for hexagonal application →
  adapters-outbound while the graph scores the same edge FF-S01 blocking; (2) `check_file`/`check_diff` carry two
  verdicts (`verdict` from the old import checker, `blockingVerdict` from the v1.3 rules) that disagree both ways.

The interpreter (#128, `src/cypher-interp`) executes the real Cypher text in process. With it the MCP tools can run the
compiled rules themselves, so the arm the agent consults reports exactly the rules that are scored.

## 2. Option

| Surface | Value | Default |
|---|---|---|
| Server flag | `--fast-rules-engine fast\|cypher-interp` (also `--fast-rules-engine=…`) | `fast` |
| Environment | `DAEDALUS_FAST_RULES_ENGINE` | unset = `fast` |

The flag wins over the environment. An unknown value is ignored (the server stays on `fast`). With `fast` nothing
changes: no new field, no new note, the same tool descriptions. A golden-capture test asserts it
(`tests/unit/mcp-server/interp-parity-default.test.ts`).

## 3. Design

### 3.1 One evaluation path

`src/mcp-server/interp-check.ts` evaluates a project *state* (the files on disk under the project root, plus a map of
overrides: path → new content, or deleted) with the same pipeline `evaluate_project` and the CLI use:
`createPipeline({ graphEngine: 'cypher-interp', evaluationMode: 'symbolic-only', scoringMode: 'v1.3', persist: false,
diff: false })`. Extraction, ingestion, `CompileFunctions` (edge views, exclude markers, parameters) and the symbolic
evaluation are the pipeline's own code; nothing in the rule path is re-implemented.

- The state is materialised as a scratch copy of the project root (no `node_modules`, no `.git`; `node_modules` is
  symlinked when present) with the overrides written on top. The pipeline reads that directory.
- If the project has no `tsconfig.json` (a loop work tree keeps its tsconfig outside the cwd), the scratch copy gets
  the loop's ISE snapshot tsconfig (`include: ['src/**/*.ts']` when `src/` exists, else `['**/*.ts']`). These compiler
  options only affect import resolution.
- Cache: the result of a state is cached by `sha256(spec text, sorted (path, sha256(content)) of every file read)`
  (at most 16 states, least recently used out). The project state before a change is usually the same across calls
  (`before-write`: it is the project on disk), so most calls run one evaluation, not two.
- Not done: incremental re-extraction of only the changed files. The extractor builds one ts-morph project per run;
  splitting it is a change to `src/apg-extractor` and out of this job's scope. The latency table (§5) says what the
  whole-state rebuild costs.

### 3.2 What counts as blocking

A row counts as blocking exactly as the scored v1.3 verdict counts it at the status quo: `ruleTier(ruleId, spec.style)`
is `blocking` and, for a partial rule, the row's `relType` is not one of the partial's N/A rel types
(`splitPartial`). No construct switch is read.

### 3.3 The tools with the option on

Identity of a finding: `(ruleId, file, target)`, the identity the consistency check and the readiness gate use.

- **`check_diff`** (project root required). The diff's files are rebuilt as today (`rebuild`: the project holds
  either side). State *before* = root with every changed path set to its old content (an added file absent); state
  *after* = root with every changed path set to its new content (a deleted or renamed-away file absent). Findings =
  rows of *after* minus rows of *before* (multiset on the identity). A row is reported under its file's entry; a row
  located in a file outside the diff (the change made another file break a rule) is reported under an extra entry with
  `change: 'affected'`. If a modified file cannot be rebuilt (neither side on disk), the call falls back to the fast
  path for the whole diff and says so in a note.
- **`check_file`** (project root required). State *after* = root with the file set to `content`. Findings = rows of
  *after* located in that file (whole-file answer, as today) plus rows elsewhere that *after* has and the root does
  not.
- **`check_import`** (project root required). The proposed edge is written as source: state *after* = root with
  `from` set to its current content (empty when absent) plus one line `import * as __daedalusProbe from '<module>';`.
  Answer = blocking rows of *after* minus rows of the root whose file is `from`. A specifier the extractor cannot
  resolve gives no edge and the answer `unknown` (said in a note). This writes the edge through the real extractor
  instead of adding it to a copy of the graph: the edge then has every property the templates read (edge views,
  `isTypeOnly`, barrel re-exports), which a hand-made edge would have to guess.
- **No project root** (spec-only): the option cannot build a graph. The tools answer on the fast path and add the note
  `fast-rules-engine cypher-interp needs a project root; answered on the fast path`.

### 3.4 One verdict object

With the option on, every result carries `engine: 'cypher-interp'` and the legacy fields are derived from the one
answer, so they cannot disagree (#161 §3.7.2):

- `findings` = the graph rows (blocking and advisory), `blockingVerdict`, `blockingCount`, `advisoryCount`,
  `blockingSummary` from them;
- `violations` = the blocking findings; `verdict` = `violations` when there is any, else `clean`; `summary` =
  `blockingSummary`;
- `hints` (APG v2 and cheap-proxy hints, always advisory) stay as the fast path computes them;
- `checkedRules` = every active rule the spec compiles; `notChecked` = empty.
- `check_import`: `violations` = the delta rows as rule hits, `verdict` `violation`/`allowed`/`unknown`,
  `blockingVerdict` from the same rows, `checkedRules` = every active rule.

A finding's `fix` is the rule's explanation pointer (`explain_finding` with rule and location) because the graph row
carries no fix text; the fast path's fix texts are not reused (they belong to the re-statements).

## 4. Pass criterion and analysis (fixed before any number was computed)

Committed before the implementation's first run.

1. `scripts/v1.3/mcp-consistency.ts --fast-rules-engine cypher-interp` over the 71 reference variants: in the two
   project modes (`after-write`, `before-write`) every style reports blocking answer, blocking rules and locations
   agreeing on every variant (100%), 0 unexplained, and no documented limit used. `spec-only` is reported but is not
   part of the criterion (the option falls back, §3.3).
2. Default mode: `mcp-consistency.ts` without the flag reproduces the committed `results/v1.3-reference/mcp-v2/`
   tables byte-for-byte, and the golden-capture test passes.
3. The three #161 defects as regression tests with the option on: (a) `check_import` hexagonal application →
   adapters-outbound returns the graph's FF-S01 `block`; (b) `check_file` `verdict` and `blockingVerdict` agree; (c)
   `check_diff` lists no advisory finding as a violation.
4. #142 replay snapshots: the replay's hexagonal and DDD feedback steps (shelter step 3, relief step 2) block with the
   option on. #142 is not merged; if its tapes cannot be run against this branch, the item is recorded as pending, not
   as passed.
5. Latency per call (p50/p95, `check_diff` and `check_file`, option on) on the largest reference variant. Reported,
   no threshold.
6. Rule 3: the 71 reference results through `ue-baseline-live.ts --engine cypher-interp` byte-identical to
   `results/v1.3-reference/after-member-facts` except `elapsedMs`.

The result is reported whatever it is.

## 5. Results

Filled in after the run (§4 was committed first).
