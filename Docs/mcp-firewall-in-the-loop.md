# Firewall in the loop: experiment design (DRAFT, v1.3 prototype)

> **Status**: draft design written with the v1.3 MCP prototype (`src/mcp-server/`). Nothing here is registered, no
> arm has been run, and nothing in this file is in `REGISTERED_ARTEFACTS` (`scripts/lib/prereg.ts`). The frozen
> instrument (v1.2e) is untouched. Running any of this needs a pre-registration bump first (§7).
> **Update (v1.3-mcp-loop)**: the pre-registration draft `Docs/prereg-drafts/firewall-in-the-loop.md` refines this
> design (three arms, A3 dropped for leakage; outcomes, analysis, threats and budget made specific).
> **Not claimed**: that agents use the tools well, or that they produce better architecture. That is what the
> experiment would test.

## 1. Question

E1 (`experiments/e1-grid/`) tests whether telling a coding agent the architecture in the prompt changes what the
frozen firewall finds in the code it writes (spec levels `none`, `minimal-prose`, `full-aac`). It gives the
constraints once, before the agent starts. This experiment asks about a different channel: **constraints and
verdicts queried while the agent works.**

- **RQ1.** Does giving the agent any architecture tool reduce the violations the frozen firewall finds in the
  finished project, compared with no tool?
- **RQ2.** Does the DaedalusArch MCP (constraints and verdicts) do better than a tool that only exposes project
  structure (a context graph) and not the rules?
- **RQ3 (secondary).** Does the effect hold on rules the tool does not expose (held-out rules), or only on the
  rules it checks?

## 2. Arms

Same tasks, same models, same prompts apart from one sentence naming the available tools; the tool set is the
only manipulated factor.

| Arm | Tools available | What it controls |
|---|---|---|
| **A0 none** | no MCP server (as E1) | baseline |
| **A1 context graph** | a read-only graph tool over the working tree: files, symbols, import edges, layer membership by the spec's globs. No rules, no verdicts | extra tool calls and structure knowledge, without the constraints |
| **A2 DaedalusArch MCP, spec tools** | `get_architecture_spec`, `which_layer`, `check_import`, `explain_violation` | constraints and instant verdicts on single imports |
| **A3 DaedalusArch MCP, all tools** | A2 plus `evaluate_project` | adds a whole-project verdict with the exact AHS the scorer will compute |

A2 against A3 isolates scoring leakage (§6, T4): in A3 the agent can read the objective it is scored on. Whether
to run A3 at all is a pre-registration decision; the default is to run it and report it separately.

**Spec level.** Cross the arms with `none` and `minimal-prose` only. `full-aac` puts the whole preset in the
prompt, so the tools would add nothing to learn; including it would make A2 and A3 look useless by construction.
Under `none`, A2 and A3 hand the agent the spec through `get_architecture_spec`: that is the treatment, and the
report must say so rather than describe `none` + A2 as "no spec".

**A1 does not exist yet.** Building it is part of the pre-registered work (§7). Its tool descriptions must match A2
in length and style, so the comparison is not a comparison of prose.

## 3. Units, factors and size

Reuse the E1 machinery (`scripts/generate-projects.ts`, `Docs/generator-protocol.md`): one Claude Code headless
generation per cell, fresh directory, pinned model ids, a plan-file `orderSeed`, three runs per cell.

- Tasks: `task-management`, `order-fulfilment` (the E1 tasks, spec `specs/clean-arch.yaml`).
- Models: the E1 pinned list.
- Cells: 4 models x 2 spec levels x 2 tasks x 4 arms x 3 runs = **192 generations** (E1 is 72). The A1/A3 arms
  can be dropped to give 4 x 2 x 2 x 2 x 3 = 96 if the budget requires; that choice is registered, not made after
  seeing data.
- A pilot (a few cells per arm, excluded from analysis) fixes the tool-call budget, timeouts and the call log
  format. Variance for the sample size is taken from E1's registered outputs, not from the pilot's effect.

Randomise cell order with the plan `orderSeed`; run all arms of a (model, task, level, run) tuple in the same
block so model-side drift hits arms alike.

## 4. Measures

Scored by the frozen firewall only: `evaluate` symbolic-only, instrument v2, spec `specs/clean-arch.yaml`, the
E1 per-run tsconfig (ADR-032). The agent never touches the scorer's database.

- **Primary**: `ahsDeterministic` of the finished project, per cell.
- **Co-primary**: count of violations of the rules the MCP checks (FF-S01, FF-S03, FF-S04, FF-P01).
- **Held-out (RQ3)**: violations of rules `check_import` does not cover: FF-S02 cycles, FF-P02 to FF-P06, FF-C*,
  FF-SO*. A subset is fixed in advance as the held-out set.
- **Process** (needs the call log, §7): tool calls by tool, calls after the first write, violations flagged by
  `check_import` that the agent then fixed or ignored, turns, wall time, tokens.
- **Guards**: type-check pass (the E1 `tsc` of record), task completion (does the project implement the brief;
  rubric or tests registered per task), and a second, independent architecture measure on the same output
  (`experiments/tool-comparison/depcruise`, which translates the spec for dependency-cruiser) so a result is not
  only "the firewall agrees with the firewall".

## 5. Analysis

Follow the conventions of `Docs/analysis-plan.md`: paired by (model, task, level, run) block, effect sizes with
bootstrap intervals, permutation tests, seeds from the plan. Contrasts, in order: A2 vs A0 (RQ1), A2 vs A1 (RQ2),
A3 vs A2 (leakage), then the held-out repeat (RQ3). Report intention-to-treat (every cell, whether or not the
agent called a tool) as primary and per-protocol (cells with at least one architecture-tool call) as secondary;
the gap between them is itself a result, because an agent that ignores the tool is a finding about adoption.
This file does not register any test statistic; the analysis plan does.

## 6. Threats

**T1 Circularity (construct).** The firewall that scores the project also supplies the constraints in A2/A3. An
effect shows the agent can follow the firewall's rules, not that the architecture is better. Mitigations: held-out
rules (RQ3), the dependency-cruiser measure, a blind review of a sample of outputs, and an explicit statement in
the write-up that the outcome is rule compliance.

**T2 Tool fidelity (internal).** `check_import` restates four Cypher rules as predicates. If it says "allowed" where
the graph says "violation", A2 is a worse treatment than designed; if it over-flags, the agent wastes effort.
Alias imports return `unknown`; exclude paths and role exemptions are partly ignored. Mitigation: a registered
fidelity check before any generation (§7).

**T3 Prompt and description confounds (internal).** The sentence naming the tools, and the tool descriptions, are
part of the treatment. A1 and A2 must be matched; descriptions are hashed and frozen. Any wording change is a new
version.

**T4 Scoring leakage (internal).** In A3 the agent reads the AHS the scorer will compute and can optimise it
(Goodhart). Also, `get_architecture_spec` returns rule ids and thresholds, so A2 sees more of the instrument than
E1's `full-aac` prompt does. Reported separately; A3 results are not pooled with A2.

**T5 Adoption (internal).** Agents may not call the tools, or call them once. ITT/per-protocol (§5) and the call
log address it; a tool-use nudge in the prompt is part of the registered text, identical for A1, A2 and A3.

**T6 Infrastructure interference (internal).** `evaluate_project` ingests into Neo4j and replaces the graph. Parallel
cells sharing one database would corrupt each other's verdicts. Mitigation: one database (or container) per cell
for A3, or run A3 serially; never the scorer's database.

**T7 Confinement (security).** The E1 generator uses `--strict-mcp-config`, a fixed allow-list and a confined
`cwd` (`Docs/generator-protocol.md` §1). Adding an MCP server changes the attack surface: the server reads the
spec and, in A3, opens a Neo4j connection. Mitigations: spec outside `cwd` and read-only, MCP tools allow-listed by
exact name, the five confinement probes re-run with the server attached, no credentials in the child environment
beyond the scratch Neo4j.

**T8 Model and CLI drift (reliability).** MCP tool-use behaviour changes between model and CLI versions. Pin ids and
CLI version in the plan as E1 does; record the version in every RunRecord.

**T9 External validity.** Two small greenfield tasks, one style (clean architecture), TypeScript only, the
agents' own sandbox. No claim about brownfield repositories, interactive editor agents (Cursor) or larger
codebases.

**T10 Tasks that cannot violate.** If a task rarely tempts a violation under `none`, the baseline AHS is near the
ceiling and the arms cannot separate. E1's `none` results bound this; the registered analysis states the minimum
baseline violation rate for a task to enter the contrasts.

## 7. Pre-registration needs

Per BR-U5b-50 and `scripts/lib/prereg.ts`, a new `corpus/prereg.json` version with a reason, hashed before the first
generation. The prototype adds nothing to `REGISTERED_ARTEFACTS`; the experiment would add (as patterns, in that
bump):

1. This design, finalised (replacing the draft status), and its analysis section folded into `Docs/analysis-plan.md`
   or a registered addendum.
2. **The treatment code**: `src/mcp-server/**` at a recorded commit, `package-lock.json` (the SDK is pinned at
   `1.32.1`) and the A1 tool's source. The tool is part of the instrument for this experiment.
3. **Tool descriptions and the tool-naming prompt sentence**, as hashed text (the model sees them).
4. **Prompt templates per arm** and level, hashed like `scripts/generator/prompts/*.md`; the MCP config files each
   arm uses.
5. **A new generator protocol version** (MCP allow-list, `--strict-mcp-config` replaced by an explicit config, T7
   probes and their results) and an experiment plan with pinned model ids, CLI version, `orderSeed`, arms, the
   run count and the A1/A3 inclusion decision.
6. **Outcome definitions**: primary, co-primary, the held-out rule set, guards, exclusion rules (cell crashed,
   no project produced, tool server failed to start), and the minimum baseline violation rate (T10).
7. **The fidelity check (T2)**: for every import edge of the corpus and `fixtures/` projects, `check_import` vs the
   graph's FF-S01/S03/S04/P01 verdict. Registered acceptance: 100 percent agreement on edges it can resolve, with
   the disagreements and `unknown`s listed. Run before any generation.
8. **A call log**: structured, append-only, outside `cwd` (tool, arguments, result hash, timestamp). The prototype
   does not log.
9. **Neo4j provisioning** for A3 (T6) and the scorer, recorded in `Docs/environment.md`.

## 8. What the prototype gives and lacks

Gives: the five tools over stdio, spec-based `check_import` with no graph, `evaluate_project` on the existing
symbolic-only pipeline behind injected ports, unit tests on the `fixtures/` projects with Neo4j mocked.

Lacks, in order of need: the A1 context-graph tool; the call log; the fidelity check against the graph on the
corpus; per-cell Neo4j isolation; cycle detection and class-level rules in a fast path (so A2 would cover more than
four rules); handling of `tsconfig` path aliases; the generator-protocol and confinement work (T7).

Fix hints (v1.3, `Docs/v1.3/fix-hints.md`): with `hints: true` (or the server's `--hints`), `check_file` and
`check_diff` attach a deterministic hint to each blocking violation (the problem, the edge and the allowed-dependency
rule it breaks, the target layer and folder, the minimal structural fix and its graph edit). It is off by default, so
the arms' tool output is unchanged unless an arm turns it on.
