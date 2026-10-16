# Spec-driven development with DaedalusArch in the loop: a worked example

Written 2026-10-16 on branch `v1.3-sdd-demo` (base `origin/v1.3`). Example: `examples/sdd-library-loans/`. Bridge:
`scripts/sdd/`. Tests: `tests/unit/scripts/sdd/openspec-to-aac.test.ts`. Replay report: `results/v1.3-sdd-demo/replay.json`.

**What this is.** One run, written down so it can be replayed: a coding agent builds a small service through five
OpenSpec changes, and DaedalusArch, reached only through its MCP server (`src/mcp-server`, the v2 tools), checks
every implementation step against an architecture that is itself derived from the spec-driven artifacts. It is a
demonstration for the thesis. It is **not** Study 2 and not the pilot, and it is not evidence that the tools change
what an agent writes. The domain (library loans) is new and unsealed. No sealed directory (`../daedalus-sealed/`) was
read, no Cypher template was edited, and nothing under `aidlc-docs/` or `Docs/prereg-drafts/` was changed.

## 1. Summary

- **Bridge.** `scripts/sdd/openspec-to-aac.ts` (OpenSpec) and `scripts/sdd/aidlc-to-aac.ts` (AWS AI-DLC application
  design) read an `## Architecture` section (style, layers, allowed dependencies, forbidden packages) from the design
  artifacts and write the DaedalusArch spec: the style's canonical preset with those parameters filled in. 12 unit
  tests (11 on the converters, one replays the committed demo).
- **Run.** Five OpenSpec changes (catalogue, members, lending, overdue report, overdue reminders), 76 recorded events:
  39 file writes, 6 derived specs, 16 MCP tool calls over stdio, 6 full evaluations on the in-process engine, 9 agent
  notes. The service is 35 files, 773 lines; `openspec validate --all --strict` passes (5 specs) and the 19 OpenSpec
  scenarios pass as executable checks.
- **The blocking moment.** The overdue-report change's first design read the loan store directly. The first attempt
  at the report use case imported the in-memory adapter; `check_file` answered `block` (FF-S01, application may not
  import adapters-outbound). The agent asked `explain_finding`, revised the design (a read-only port), and the second
  attempt passed. The full evaluation, given the blocked file in a scratch copy, also fails it on FF-S01 alone (§4.1).
  How "natural" that moment was is discussed honestly in §4.1.
- **Replay.** `npm run demo:sdd` rebuilds the project from the transcript in an empty directory and re-checks every
  step in process (no LLM, no database, no network): 76/76 steps reproduced, the rebuilt tree is byte-identical to the
  committed one, `tsc` passes, 19/19 scenarios pass. About 10 s.
- **Latency.** Over stdio, each call on a fresh server: check_file p50 142 ms, check_diff p50 311 ms (cold: a new
  server process per call). In process, warm: check_file p50 28 ms, check_diff p50 90 ms. The full evaluation on the
  in-process engine took 1.7 to 2.0 s per step when recorded (§5).
- **Tool defects seen** (reported, not fixed here): for a hexagonal spec, `get_architecture_spec`, `which_layer` and
  `suggest_placement` report every layer as importable (their layer view ignores `allowed_dependencies`);
  `suggest_placement` proposes no port for a repository and places unknown roles in the domain; the naming rule
  FF-CV03 selects `OverdueReportUseCase` and `ReportController` because "Report" contains "Repo", and suggests the
  rename `rtControllerRepo` (§4.4).

## 2. The two spec-driven frameworks

| | OpenSpec | AWS AI-DLC |
|---|---|---|
| Source | `@fission-ai/openspec` **1.14.0** (npm, published 2026-09-30, MIT), pinned in `scripts/sdd/lib/sdd-sources.ts` (`OPENSPEC_VERSION`); docs read from the package (`README.md`, `schemas/spec-driven/schema.yaml` and its templates) | this repository's own copy: `CLAUDE.md` and `.aidlc-rule-details/` (application design: `inception/application-design.md`) |
| Unit of work | a change folder `openspec/changes/<change>/`: `proposal.md` → `specs/<capability>/spec.md` (delta: ADDED / MODIFIED / REMOVED requirements with WHEN/THEN scenarios) → `design.md` (optional) → `tasks.md`; `openspec archive` merges the deltas into `openspec/specs/` and moves the change to `changes/archive/<date>-<change>/` | stages with approval gates; Application Design writes `aidlc-docs/inception/application-design/{components,component-methods,services,component-dependency,application-design}.md`; construction units have `construction/<unit>/functional-design/` |
| Where architecture lives | `design.md` ("how": decisions, alternatives). OpenSpec's own guidance keeps class names and framework choices **out** of specs | the application-design documents (components and their dependencies) |
| Used in this run | yes: `openspec init --tools none`, `openspec new change`, `openspec validate --strict`, `openspec archive -y` (CLI 1.14.0, telemetry off) | the converter reads it and is unit-tested; the demo itself was developed with OpenSpec only |

The repository's interactive AI-DLC workflow (`CLAUDE.md`) was not run for this unit: it was an unattended run with no
one to answer the approval gates, and the work is an example and a script, not a change to the firewall.

## 3. How spec-driven artifacts become fitness functions

### 3.1 The convention

Neither framework has a machine-readable architecture. OpenSpec specs are behavioural contracts ("The system SHALL
lend a book for 21 days..."), and should stay so; the architecture is a design decision. The bridge therefore reads
one Markdown section, which a designer writes in `design.md` (OpenSpec) or in the application design (AI-DLC):

```md
## Architecture
Style: hexagonal

### Layers
| Layer | Kind | Directories | Roles |
|---|---|---|---|
| domain | domain | `src/domain/**` | entity, value-object, domain-service |
| application | application | `src/application/**` | use-case, port |
...

### Allowed dependencies
- application -> domain
- adapters-inbound -> application, domain
...

### Forbidden in domain
- `express`
```

Optional `### Components` (component, layer, path) adds paths to a layer. The full section of the run is in
`examples/sdd-library-loans/openspec/changes/archive/2026-10-16-add-book-catalog/design.md`.

### 3.2 What each part parameterises

| Artifact part | Spec field | Fitness functions it parameterises (hexagonal) |
|---|---|---|
| Style | `architecture.style`, and which preset is the base | the style's template set and the v1.3 tiers for that style |
| Layers (name, kind, directories) | `architecture.layers` | every layer-bound rule: the layer of each file, the domain (core) layer, the port and adapter layers |
| Allowed dependencies | `architecture.allowed_dependencies` | FF-S01 dependency-direction-graph (an import against an edge, blocking), FF-S03 layer-skip-graph (an import with no edge either way, advisory), FF-S04 core-isolation (blocking), FF-S02 cycles |
| Forbidden in domain | FF-P01 `forbidden_imports` | domain-purity (blocking) |
| Roles | `layers[].roles` | read by `suggest_placement`; no rule reads them |
| (nothing) | everything else | copied from `presets/<style>.yaml` unchanged: rule ids, thresholds, scoring, tiers |

So the artifacts choose the **parameters** of existing, tiered fitness functions; they do not create new rules. A
requirement like "returned loans SHALL NOT appear in the report" is behaviour and is checked by the scenarios
(`scenarios.ts`), not by DaedalusArch.

### 3.3 Several changes

Each OpenSpec change may carry its own `## Architecture` section. The converter reads every archived change's
`design.md` plus the active changes named with `--changes` (the agent passes the change it is implementing), and
merges them **order-independently**: layers by name (directories and roles united), allowed dependencies per `from`
(targets united), forbidden packages united. A layer whose kind differs between two artifacts, two different styles,
an edge to an undeclared layer, no layer at all, or a hexagonal design without allowed dependencies is an error, never
resolved silently. Order independence matters because OpenSpec's archive folders carry only a date
(`2026-10-16-<change>`), so several archives of one day have no reliable order.

The limit of this rule: a later change can add but not remove (a layer, an edge, a forbidden package). Removing one
means editing the earlier design, which the archive is not meant for. An "## Architecture (MODIFIED)" convention,
mirroring OpenSpec's MODIFIED requirements, would be the natural extension; it is not implemented.

The YAML header names the generator and every input with its sha256, and contains nothing time-dependent, so the
output is reproducible; `--check` compares a committed spec with its artifacts (a CI gate).

### 3.4 In the run

| Event | Change | Inputs | Result |
|---|---|---|---|
| #6 | add-book-catalog | its own design | five layers, four `from` entries, six forbidden packages |
| #20, #30, #46 | members, lending, report | the archived catalogue design | the same architecture (only the input path in the header changed) |
| #62 | add-overdue-reminders | the archived catalogue design + its own design | adds layer `adapters-scheduled` (presentation), `adapters-scheduled -> application, domain`, `config -> adapters-scheduled` |
| #71 | after archiving it | both archived designs | the same as #62 |

## 4. Transcript highlights

The full log is `examples/sdd-library-loans/transcript/transcript.md` (rendered from `transcript.jsonl`). The agent
was this session's model acting through `scripts/sdd/agent.ts`: it wrote each OpenSpec artifact, recorded it, wrote
the code, and called the tools through a real stdio MCP client (`@modelcontextprotocol/sdk` 1.32.1 `Client` +
`StdioClientTransport`, server `src/mcp-server/main.ts --project <example>`; the spec is passed per call). Before
writing a file it sometimes called `check_file` on the proposed content; after writing a step it called `check_diff`
on the code changed since the previous `check_diff` (after-write mode, so modified files are checked as a delta), then
ran the full evaluation in process.

| Change | Artifacts | Tool calls | First check | Full evaluation |
|---|---|---|---|---|
| add-book-catalog | proposal, spec, design (architecture), tasks | get_architecture_spec, suggest_placement, check_file, check_diff | pass | pass |
| add-members | proposal, spec, tasks (no design: architecture unchanged) | check_diff | pass | pass |
| lend-and-return | proposal, spec, design, tasks | check_diff, explain_finding, suggest_placement, check_diff | pass, 2 advisory hints | pass; advisory FF-SO02, FF-C02 |
| add-overdue-report | proposal, spec, design, tasks; design revised | check_file, explain_finding, check_file, check_diff | **block** (FF-S01) | pass (after the fix) |
| add-overdue-reminders | proposal, spec, design (adds a layer), tasks | suggest_placement, check_diff | pass | pass; advisory FF-P02 |

### 4.1 The blocking moment (events #38 to #54)

1. **#38** The full evaluation after the lending change passes, with an advisory FF-SO02 (interface-segregation
   proxy) on `LoanRepository`: six methods, threshold five. The fast path does not decide FF-SO02 (it is in
   `notChecked`); only the full evaluation reports it.
2. **#44** The report change's `design.md` takes that advisory seriously: rather than add a seventh method to
   `LoanRepository`, "the report use case takes the store directly", because `InMemoryLoanRepository` already has
   `all()`. This is a read-model shortcut that real code bases take.
3. **#47** The first `OverdueReportUseCase` (in `src/application/reporting/`) imports
   `InMemoryLoanRepository` from `adapters/outbound/persistence/`. `check_file`, before the file is written:
   **block**, FF-S01, "application may not import adapters-outbound: the allowed edge runs adapters-outbound ->
   application, not the reverse", with the fix "Declare a port (interface) in application or an inner layer for what
   you need, implement it in adapters-outbound, and wire it in the composition root."
4. **#48** `explain_finding FF-S01`: the construct (adapters depend on ports, never the reverse), Cockburn 2005, the
   tier, a violating and a compliant example.
5. **#49, #50** The agent revises `design.md` first (a read-only port `OverdueLoansQuery` with one method, implemented
   by the same adapter; both earlier alternatives recorded as rejected, with the reason), then the code.
6. **#51** `check_file` on the second attempt: pass. **#53** `check_diff` on the whole change: pass. **#54** full
   evaluation: pass.

**Counterfactual (replay).** For every `check_file` that blocked, the replay writes the blocked content into a scratch
copy of the project at that point and runs the full evaluation: it fails on FF-S01 only, the same rule set as the fast
check. The blocked file was never written to the real project.

**How natural was it?** The task asked for a realistic moment where a first attempt breaks a defining rule, arising
from the work, and to say so if it did not arise. What happened: the violation followed from a design decision written
down before any code, and that decision responded to a real advisory (#38) that nobody planned. But the agent and the
author of the demo are the same model, which knows hexagonal architecture and knew that the demo wanted such a moment.
So the moment is plausible and unforced in its mechanics, and it is not a spontaneous error in the sense an
experiment would need. Read it as an illustration of the loop (artifact, check, explanation, revised artifact, check),
not as a measurement of how often agents make this mistake.

### 4.2 An advisory hint acted on (events #31 to #37)

The first lending use cases called `new Date()`. `check_diff` passed with two advisory hints
(`APG2.nondeterminism-in-core`). The agent acted on them, because the lending spec's scenarios are dated ("lent
2026-10-01, due 2026-10-22") and cannot be reproduced against the system clock: a `Clock` port, a `SystemClock`
adapter, and a clock passed to the container. The scenarios use a fixed clock.

### 4.3 Advisories left alone

FF-C02 (fan-out of the composition root), FF-SO02 (`LoanRepository`), FF-P02 (`SendOverdueRemindersUseCase` injects
the concrete `OverdueReportUseCase`, a deliberate reuse) and the always-present metrics FF-C03, FF-C06, FF-CV05. All
advisory; none changes the v1.3 verdict. FF-SO02 and FF-P02 are reported by the full evaluation only.

### 4.4 What the run showed about the tools

| Observation | Events | Effect on an agent |
|---|---|---|
| `get_architecture_spec` lists every other layer under `mayImport` for every layer of the hexagonal spec (domain "may import" adapters-outbound). `importableLayers` (`src/mcp-server/spec-rules.ts`) asks the four v1 import rules, and for hexagonal those are the `-graph` templates it does not match. `which_layer` and the `mayImport` of `suggest_placement` use the same function. | #7, #9, #63 | Misleading before writing code. `check_file`/`check_diff` read `allowed_dependencies` correctly, so the error is caught after the fact. |
| `suggest_placement("repository for books")` returns one placement, `class BookRepository` in adapters-outbound, and no interface. Written as suggested, a repository class that implements no port is what FF-P03 port-adapter-pattern (blocking) flags. | #9 | The agent followed the design instead. |
| `suggest_placement` does not know the roles `clock` or `scheduled-job` and defaults to a domain entity (it says so in `notes`). | #35, #63 | Ignored by the agent. |
| FF-CV03 naming-repos selects classes whose name **contains** `Repo`: `OverdueReportUseCase`, `ReportController`. The full evaluation reports the same two classes (it is the template's substring selection, not a fast-path error). The fast path's suggested fix is `Rename ReportController to rtControllerRepo`. | #47, #53, #54 | Advisory noise with a nonsensical fix. |

None of these was fixed in this branch: the unit is a demo, and the MCP server is shared with other units. They are
candidates for a small MCP fix unit.

## 5. Latency per check

Machine: 4 vCPU, Node 22.22.0. **Recorded** = the 16 calls of the run, over stdio, each on a freshly started server
(`node --import tsx src/mcp-server/main.ts`), measured around `callTool` only; server start-up to `listTools` took
1.9 to 2.9 s and is excluded. So every recorded call is a cold first call. **Replay** = the same calls in process
(`createServer` over an in-memory transport), modules warm, from `npm run demo:sdd` (`results/v1.3-sdd-demo/replay.json`).

| Check | Calls | Recorded p50 ms | Recorded max ms | Replay p50 ms | Replay max ms |
|---|---|---|---|---|---|
| check_diff | 6 | 311 | 343 | 90 | 143 |
| check_file | 3 | 142 | 147 | 28 | 42 |
| explain_finding | 2 | 48 | 82 | 8 | 14 |
| get_architecture_spec | 2 | 52 | 52 | 7 | 35 |
| suggest_placement | 3 | 96 | 103 | 9 | 54 |
| full evaluation (cypher-interp, symbolic, v1.3) | 6 | 1868 | 2022 | 502 | 1173 |

The check_diff calls carried 5 to 10 files each. For comparison, `Docs/v1.3/mcp-v2.md` §9 measured warm calls over
stdio on the reference projects at check_file p95 13 ms and check_diff p95 36 ms, with a built server (start-up about
0.8 s). The cold numbers here are the cost of one fresh server per call under `tsx`, not the steady state. Every
check stayed under the 1 s target of the MCP v2 unit; the full evaluation, which an agent would run once per change
rather than per edit, took about 2 s.

## 6. Reproduce

```bash
npm ci
npm run demo:sdd                               # rebuild + re-check; exit 0 iff everything reproduces
npm run demo:sdd -- --no-full-eval             # fast checks only (about 5 s)
npm run demo:sdd -- --json <file>              # also write the per-step report
npx jest --maxWorkers=2 tests/unit/scripts/sdd # converter tests + a fast-path replay of the committed demo
```

The replay compares, per event: file contents (sha256); the converter's YAML with the recorded one; each tool result
with the recorded one (whole JSON, keys sorted, the project root replaced by `<project>`); the full evaluation's
verdict, blocking findings, advisory rules and count (and advisory locations for events recorded after #41, when they
were added to the record). At the end: the rebuilt tree against `examples/sdd-library-loans/`, `transcript.md`
against its rendering, `tsc --noEmit`, and `scenarios.ts`.

Recording another run uses the same recorder:

```bash
npx tsx scripts/sdd/agent.ts snapshot   --change <c> --phase proposal|specs|design|tasks|implement|fix|archive --note "..."
npx tsx scripts/sdd/agent.ts derive     --change <c> --active <c>
npx tsx scripts/sdd/agent.ts check-file --change <c> --path src/... --content-file <proposed file>
npx tsx scripts/sdd/agent.ts check-diff --change <c>
npx tsx scripts/sdd/agent.ts call explain_finding --json '{"rule":"FF-S01","location":"src/...:1"}' --change <c>
npx tsx scripts/sdd/agent.ts full-eval  --change <c>
npx tsx scripts/sdd/replay-demo.ts --render
```

## 7. What this suggests for Study 2's MCP arm

These are suggestions drawn from one illustrative run, to be weighed when the Study 2 protocol is written; none is a
finding about effects.

1. **The arm's spec can come from the task's own artifacts.** If a Study 2 task ships a design document, the bridge
   turns its architecture section into the spec mechanically and reproducibly (`--check`), so the spec the MCP arm
   checks against is traceable to what the agent was told. The task authors would have to write that section; the
   converter refuses ambiguous input.
2. **The decisive moment was at design time.** The one blocking answer came from a design decision, written before the
   code. A check of the design's dependencies against the architecture (before code) is not something the current
   tools offer; the protocol should at least record design artifacts in the transcript so that such moments can be
   located.
3. **Fix the misleading tool surfaces before the arm is frozen.** For hexagonal (and DDD) specs, the `mayImport`
   lists of `get_architecture_spec`, `which_layer` and `suggest_placement` are wrong (§4.4). An agent in the MCP arm
   that trusts them is misled before it writes code, which would bias the arm against the tools. The FF-CV03 rename
   suggestion is noise of the same kind.
4. **Log like this.** A transcript that holds the file states and every tool call with its result makes each run
   replayable and re-scorable without the model. The loop harness could emit the same JSONL.
5. **Latency is not the bottleneck; start-up is.** Warm checks are tens of milliseconds; a fresh server under `tsx`
   costs 2 to 3 s. The arm should run the built server (`dist/mcp-server/main.js`) once per session.
6. **Full-evaluation-only rules matter for the narrative.** FF-SO02 and FF-P02 shaped the design but are invisible to
   the fast path. If the arm exposes only the fast tools (`evaluate_project` is denied in the pinned arm), those
   advisories never reach the agent; the in-process engine (`--engine cypher-interp`) would make a per-change full
   evaluation cheap enough to offer without a database.

## 8. Files

| Path | What |
|---|---|
| `scripts/sdd/lib/architecture-markdown.ts` | the `## Architecture` parser, the order-independent merge, the YAML builder (pure) |
| `scripts/sdd/lib/sdd-sources.ts` | where OpenSpec and AI-DLC keep designs; `convert()` |
| `scripts/sdd/openspec-to-aac.ts`, `scripts/sdd/aidlc-to-aac.ts` | the two converters (CLI: `--project`, `--changes`, `--out`, `--check`) |
| `scripts/sdd/agent.ts` | the recorder and stdio MCP client the agent drove |
| `scripts/sdd/lib/transcript.ts`, `lib/render.ts` | the transcript format; the Markdown rendering |
| `scripts/sdd/lib/full-eval.ts` | the full evaluation on the in-process engine, summarised |
| `scripts/sdd/lib/replay.ts`, `scripts/sdd/replay-demo.ts` | `npm run demo:sdd` |
| `tests/unit/scripts/sdd/openspec-to-aac.test.ts` | 12 tests (one replays the demo, fast checks only) |
| `examples/sdd-library-loans/` | the example, its OpenSpec project, the derived spec and the transcript |
| `results/v1.3-sdd-demo/replay.json` | the replay report the latency table quotes |
