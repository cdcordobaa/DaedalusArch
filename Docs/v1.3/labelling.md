# v1.3 labelling harness (unit U-F)

Code for the labelling of `Docs/v1.3/validation-protocol.md` §3. This unit builds the harness and its tests. **It made no live model call and needs no Neo4j.** Nothing here is pre-registered (author decision): the seeds, the provider and the model id for a real run are chosen when that run is planned.

| Protocol §3 item | Where |
|---|---|
| **Correct**, checked deterministically | `scripts/v1.3/check-correct.ts`, `scripts/v1.3/lib/labelling/{correctness,source-facts,spec-facts}.ts` |
| **Meaningful**, by an independent-vendor labeller, tools off | `scripts/v1.3/label-meaningful.ts`, `lib/labelling/{meaningful,meaningful-prompt,providers}.ts` |
| Per-rule sample: all findings if fewer than 40, else a seeded 40 | `scripts/v1.3/sample-findings.ts`, `lib/labelling/sampler.ts` |
| Wilson bound per rule | `correctness.json` and `labels.json` summaries |
| Author audit: ≥ 30 items, shuffled, blind to the rule id; κ ≥ 0.60 | `scripts/v1.3/audit-sheet.ts`, `lib/labelling/audit.ts` |

Tests: `tests/unit/scripts/v1.3/labelling/` (fixture project `tests/fixtures/v1.3-labelling/clean-mini`, plus the committed reference-run evidence). Run with `npx jest tests/unit/scripts/v1.3/labelling`.

## 1. Inputs: the jobs file

Every step reads a jobs file: one entry per evaluated project, with its source root, its spec and the report whose `violations` hold the findings.

```json
{ "schemaVersion": 1, "kind": "e1", "jobs": [
  { "projectId": "claude-opus-5-5/task-management/none/run-0",
    "projectRoot": "/abs/daedalus-e1-outcomes/claude-opus-5-5/task-management/none/run-0",
    "spec": "/abs/DaedalusArch/specs/clean-arch.yaml",
    "report": "/abs/DaedalusArch/results/e1-grid/reports/e1-grid-000-….json" } ] }
```

A finding keeps only the report fields of the schema (rule `functionId`, `filePath`, `line`, `lines`, `target`, `discriminator`, `evidence`, `message`). Judge rows (FF-N01, FF-N02, route `neuronal`) are dropped. The template is recovered from the violation type (`CUSTOM_<template>` for the hexagonal and DDD libraries) and the tier from `ruleTier(ruleId, style)`. A *rule* in the sample is the pair `ruleId/template`, because DDD and hexagonal re-use frozen ids for other templates.

## 2. Running on the E1 cells

```bash
# 1. jobs: the accepted cells of the run directory; the spec of each task and the outcomes root come from the plan
npx tsx scripts/v1.3/labelling-jobs.ts --e1-runs results/e1-grid/runs --e1-plan experiments/e1-grid/plan.json --out results/v1.3-labelling/e1/jobs.json
# (when the outcomes are elsewhere: --e1-root <dir>; to force one spec: --spec <spec.yaml>)

# 2. sample (blocking rules by default; --tiers all adds the advisory rules)
npx tsx scripts/v1.3/sample-findings.ts --jobs results/v1.3-labelling/e1/jobs.json --seed <seed> --out results/v1.3-labelling/e1/sample.json

# 3. correctness (no model)
npx tsx scripts/v1.3/check-correct.ts --jobs results/v1.3-labelling/e1/jobs.json --sample results/v1.3-labelling/e1/sample.json --out results/v1.3-labelling/e1

# 4. meaningful: estimate first, then record (live), then replay (offline, from cassettes)
npx tsx scripts/v1.3/label-meaningful.ts --sample results/v1.3-labelling/e1/sample.json --jobs results/v1.3-labelling/e1/jobs.json --estimate
GEMINI_API_KEY=… npx tsx scripts/v1.3/label-meaningful.ts --sample … --jobs … --provider gemini --model <id> \
  --mode record --cassette-dir results/v1.3-labelling/e1/cassettes-gemini --seed <seed> --out results/v1.3-labelling/e1/labels-gemini.json
npx tsx scripts/v1.3/label-meaningful.ts … --provider gemini --model <id> --mode replay --cassette-dir … --seed <seed> --out …

# 5. author audit, then agreement
npx tsx scripts/v1.3/audit-sheet.ts sheet --sample results/v1.3-labelling/e1/sample.json --jobs results/v1.3-labelling/e1/jobs.json --seed <seed> --out results/v1.3-labelling/e1/audit
#    (the author fills audit/audit-answers.csv from audit/audit-sheet.md without opening audit/audit-key.json)
npx tsx scripts/v1.3/audit-sheet.ts agreement --key results/v1.3-labelling/e1/audit/audit-key.json --answers results/v1.3-labelling/e1/audit/audit-answers.csv \
  --labels results/v1.3-labelling/e1/labels-gemini.json --correctness results/v1.3-labelling/e1/correctness.json --out results/v1.3-labelling/e1/agreement.json
```

The E1 sources are outside the repository (`experiments/e1-grid/plan.json`: `outcomesRoot` `../daedalus-e1-outcomes`); `labelling-jobs` reports the project roots it cannot find, and the checker returns `not-checkable` ("project source not present") for every finding of such a project, so run it where the outcomes are.

**State on the committed Study 1 E1 reports (2026-10-15, dry run, no model).** 65 accepted cells, specs `specs/clean-arch.yaml`. They hold **no blocking-tier finding**: every symbolic finding is advisory under the v1.3 tiers (FF-CV05 1184, FF-C03 154, FF-P02 51, FF-C02 21, FF-C06 6, FF-SO01 3, FF-C04 2, FF-SO02 2). The blocking sample is therefore empty and costs 0 calls; `--tiers all` samples 154 findings over 8 rules, `--estimate` 308 calls (worst case 1232). The v1.3 E1 cells (re-evaluated under the v1.3 rules) are what this harness is for.

**v1.3 re-evaluation of the E1 cells (U-F live run).** `scripts/v1.3/e1-v13-evaluate.ts --e1-runs results/e1-grid/runs --e1-root <outcomes> --spec specs/clean-arch.yaml --out results/v1.3-labelling/e1` evaluates each accepted cell symbolic-only under the v1.3 defaults, on a temporary copy, with the pinned ADR-032 tsconfig, holding the Neo4j lock, and writes the reports and a jobs file whose jobs carry `"tsconfig": "adr-032"` (the checker then reads the cell with the same pinned tsconfig). Results: `Docs/DiagnosticRuns/v1.3-labelling-2026-10-15.md`.

## 3. Running on the reference runs

The reference projects are materialised from `tests/fixtures/v1.3-reference` (patch and overlay formats), one per variant with an evidence file:

```bash
npx tsx scripts/v1.3/labelling-jobs.ts --reference results/v1.3-reference/after-fixes/evidence --materialise /tmp/v13-label-variants --out results/v1.3-labelling/reference/jobs.json
npx tsx scripts/v1.3/sample-findings.ts --jobs results/v1.3-labelling/reference/jobs.json --seed <seed> --out results/v1.3-labelling/reference/sample.json
npx tsx scripts/v1.3/check-correct.ts --jobs results/v1.3-labelling/reference/jobs.json --sample results/v1.3-labelling/reference/sample.json --out results/v1.3-labelling/reference
# then steps 4 and 5 of §2 with the reference paths
```

**Dry run on `after-fixes` (2026-10-15, no model).** 71 variants. Every blocking finding re-verifies as **correct** (53 of 53 checkable, over 15 rule/template pairs); the 3 FF-P06 rows are FLOWS_TO rows and come out `not-checkable`, and the sampler leaves them out as N/A. The blocking sample is 53 findings over 15 rules (all exhaustive, every rule has fewer than 40), and `--estimate` gives 106 calls (worst case 424). With `--tiers all`, FF-CV05 (1426 findings) re-verifies as correct; the metric rules are `not-checkable` (no deterministic check is defined for a threshold metric). The unit test repeats the hexagonal and DDD part of this and checks that moving a finding's line or target makes it `incorrect`.

## 4. The correctness checker

Each finding's condition is re-checked from the **source** (TypeScript compiler API: one `ts.Program` per project from its own `tsconfig.json`; `ts.resolveModuleName` for specifiers; the checker's alias chain for barrels) and the **spec** (layer, context and role globs matched with picomatch; layer kinds and function fields from the spec parser). It never reads the graph, the extractor or the report's other sections. Verdicts: `correct`, `incorrect` (with the failing fact), `not-checkable` (with the reason). `correctness.json` holds every result with the facts established on the way, and a per-rule summary with the Wilson interval of `correct` among checkable findings; `correctness.csv` is the review sheet.

- **Edge rules** need an import or export statement covering the finding's `line` (the FR-12 line; `lines` only when there is no `line`), of the finding's relation (`IMPORTS` or `RE_EXPORTS` from the discriminator), whose specifier resolves to `target`. Literal-view templates (edge-views.md) need the specifier to resolve to `target` itself; resolved-view templates (`domain-purity`, `aggregate-boundary`, `repository-aggregate-root`) also accept a name that `target` declares, reached through a barrel. Then the layer condition of the template on both ends.
- **Cycles** need every consecutive pair of the listed files joined by an import that resolves to the next file.
- **Declaration rules** need the class in the file and its `implements` clause, constructor parameter type or method list to be what the template's Cypher computes.

`npx tsx scripts/v1.3/check-correct.ts --coverage` prints the table.

| Style | Rule | Template | Coverage |
|---|---|---|---|
| clean-architecture, nestjs, layered | FF-S01 | dependency-direction | full |
| clean-architecture, nestjs, layered, hexagonal | FF-S02 | no-cyclic-deps | full |
| layered | FF-S03 | no-layer-skip | full |
| clean-architecture, nestjs | FF-S04 | no-domain-outward-dep | full |
| clean-architecture, nestjs, layered, hexagonal | FF-P01 | domain-purity | full (direct import, or a name re-exported from the package) |
| clean-architecture, nestjs | FF-P03 | repository-pattern | full |
| clean-architecture, nestjs, layered, hexagonal | FF-P06 | domain-state-purity | partial: constructor injection checked; FLOWS_TO rows not-checkable |
| hexagonal, ddd | FF-S01 | dependency-direction-graph | full |
| hexagonal | FF-S04 | core-isolation | full |
| hexagonal | FF-P03 | port-adapter-pattern | full |
| ddd | FF-DS01 | bounded-context-modules | full |
| ddd | FF-DS02 | context-isolation | full (literal view) |
| ddd | FF-DT01 | aggregate-boundary | full |
| ddd | FF-DT02 | repository-aggregate-root | full |
| ddd | FF-DT03 | value-object-immutability | full: the frozen setter-name proxy, and each member clause of the v1.3 member-fact template (public mutable field, set accessor, mutator method) |
| ddd | FF-DT04 | domain-purity | full |

Also checked (advisory): `layer-skip-graph`, `naming-services`, `naming-repos`, `test-file-pairing`.

**Uncoverable or out of scope**
- FF-P06, FLOWS_TO (field) rows: N/A by rule-tiers.md (finding 9).
- `port-dependency-inversion` (hexagonal): advisory (ratio-based).
- ADR-derived and custom rules: untiered, so advisory by default; their condition is free Cypher.
- FF-N01, FF-N02: judge dimensions, measured separately.
- Advisory metrics (FF-C01..C06, FF-SO01..03, FF-P02, FF-P04, FF-P05) and the remaining conventions: `not-checkable` (no check defined; they are outside the blocking verdict).

The protocol also allows a rule-blind *agent* for "correct"; this harness covers every blocking rule deterministically, so no agent path is built.

## 5. The meaningful labeller

**Prompt** (`meaningful-prompt.ts`, neutral by construction; the unit test checks that no rule id, template name or violation type reaches it):
1. the style's definition: the rows of `Docs/v1.3/style-rule-sources.md` for the style (nestjs: the Clean and NestJS rows), with every parenthesised rule id or template name cut;
2. the code excerpt: the finding's file, 15 lines either side of its line (the first 31 lines when it has none);
3. the finding's claim without the rule id: the report message with ids and template names removed, or, for messages that are only "Violation in …", a sentence built from the finding's fields (class, target, field);
4. the question "Would an architect following this style want this changed?" with the options yes / no / uncertain as letters, and the answer format `{"choice": "<letter>", "reason": "<one sentence>"}`.

**Two runs, permuted options.** Run 0 shows the canonical order, run 1 a seeded non-identity permutation (seed from `--seed` and the finding key). The letter is mapped back. An unparseable answer is re-asked once; then the run is invalid. The item's label is the runs' label when they agree, else `uncertain` (`disagree` or `invalid-run`). `labels.json` holds every run and a per-rule summary (yes / no / uncertain, share of yes with its Wilson interval).

**Providers** (`providers.ts`):
- `codex`: Codex CLI, a GPT model. `codex exec --json` with `--sandbox read-only`, `web_search="disabled"`, `--ignore-user-config`, `--ignore-rules`, and the generator arm's disabled features plus the shell features (`CODEX_DISABLED_FEATURES`, `CODEX_SHELL_FEATURES`). Each call runs in a fresh empty temporary cwd, with the generator arm's child environment (`buildCodexChildEnv`: API keys and `*_TOKEN`/`*_KEY` removed, `CODEX_HOME` = the dedicated logged-in home given by `--codex-home`, `HOME` = `--codex-user-home`). The prompt goes on stdin, with the system text first. Any completed item other than the answer or reasoning is a tool step: the call fails closed (`LABEL_TOOL_USE`) and is retried once. A usage-limit message stops the run.
- `gemini`: the Gemini API through U4's `GeminiProvider`: no tools, temperature 0, the response schema as `responseSchema`, the system text as `systemInstruction`. The key is read from `GEMINI_API_KEY`. It is never logged: it is scrubbed from errors, outputs and cassettes. 429, quota and overload stop the run and are never stored.
- `mock`: deterministic, for tests and dry runs.

**Cassettes.** One file per call, `<cassette-dir>/<key[0..2]>/<key>.json`, key = sha256 of the canonical request (provider, model, system text, prompt, temperature, run index). `--mode record` answers from the cassette or calls and stores; `--mode replay` never calls and stops on a miss (`CASSETTE_MISS`). A re-ask has its own key. **`--estimate`** prints `items × 2` calls and the worst case (one re-ask and one retry each) and calls nothing. `--rule` and `--limit` restrict a run.

The protocol names the Gemini labeller for *meaningful*. Codex is wired as a second independent-vendor route; which route a real run uses is the author's call.

## 6. Author audit and agreement

`audit-sheet sheet` draws `--n` items (default and minimum 30) round-robin over the sampled rules, each rule's items in a seeded order, then shuffles them. It writes:
- `audit-sheet.md`: style, file, neutral claim and excerpt per item; no rule id, template, type or labeller answer;
- `audit-answers.csv`: `auditId,meaningful,correct,note` (meaningful = yes / no / uncertain; correct = yes / no, optional);
- `audit-key.json`: audit id to finding key and rule. Keep it away from the author until the answers are in.

With `--labels <labels.json,…>` the draw is stratified by rule × labeller label (`selectAuditStratified`), so both labels are represented. With `--format table --sheet-out <file.md> --key-out <file.json>` the sheet is one Markdown table with an `[Answer]` column (excerpts below it) and the key goes to its own path; `agreement --answers <file.md>` reads that column. `--sample`, `--jobs`, `--labels` and `--correctness` take comma-separated lists (one audit over E1 and the reference runs).

`audit-sheet agreement` reports, for author vs labeller on *meaningful*: the 3×3 table, Cohen's κ, Gwet's AC1, and the observed agreement with its Wilson interval. It reports the same for the binary split (yes vs not yes), and the **gate**: κ (three-way) ≥ 0.60 with n ≥ 30. With `--correctness`, it also reports author vs checker on *correct* (checkable items only). Unanswered and unmatched audit ids are listed. The director's 30 independent ratings (protocol §3) use the same sheet and calculator: give the director's CSV as `--answers`.
