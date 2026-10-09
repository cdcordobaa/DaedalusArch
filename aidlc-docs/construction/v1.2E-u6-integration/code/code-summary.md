# U6 Integration — code summary (ADR-021)

**Date**: 2026-10-09. **Unit**: U6 (ADR-021 item 1). **Closing stage**: registration P-U6, branch
`v1.2e-u6-register`, `corpus/prereg.json` **version 4**. No live LLM call, no so4-heldout, e7-corpus, e1-grid or
live-labelling run, and no Neo4j container started. Lane notes: `so1.md`, `so2.md`, `so4.md`, `so5-gen.md`,
`so5-agg.md`, `labels.md`, `docs.md` (this directory).

## 1. The 44 audit findings (`Docs/DiagnosticRuns/so-readiness-audit-2026-10-08.json`)

| Findings | Closed by | Registered by |
|---|---|---|
| SO1-B, SO1-D, SO1-E, X-7 | SO1 lane, PR #27 | P-U6 (fixture specs, presets, analysis plan §3) |
| SO1-C | SO4 lane, PR #28, #31 | P-U6 (analysis plan §3 SO1) |
| SO2-1, SO2-2, SO2-3, SO2-4, SO2-5, X-2, X-4 | SO2 lane, PR #23, #24, #29; P-U6 (aggregate `latency.csv` columns; type-resolution rate declared dropped) | P-U6 (analysis plan §2, §3; `apg-ablation` plan) |
| SO3-1, SO4-08, SO5-09 | agy labeller lane, PR #21 | P-U6 (`Docs/labeller-route.md`) |
| SO3-2, SO3-3, SO3-5, SO4-01, SO4-02, SO5-01, THR-3, THR-6 | Labels lane, PR #26; corrected by P-U6 (ADR-021 item 8) | P-U6 (`corpus/label-plan-config.json` v2, analysis plan §4–§6, matching rule §8) |
| SO3-4, THR-5 | PR #21 (route), P-U6 (registration) | P-U6 |
| SO4-03, SO4-04, SO4-05, SO4-06 | SO4 lane, PR #28, #31; P-U6 (`so4-plan-entries`) | P-U6 (analysis plan §3, §5, §8; held-out entries) |
| SO5-03, SO5-04, SO5-05, THR-8 | SO5-gen lane, PR #18, #25, #30 | P-U6 (`generator-protocol.md` §11, `e1-grid/generator-plan.json`) |
| SO5-08 | SO5-gen lane, PR #18 (estimate) | residual: measured calls per window need live calls |
| SO5-07, X-3, THR-4 | SO5-agg lane, PR #33 | P-U6 (analysis plan §3, §6, §8) |
| THR-9, X-5, X-6 | Docs lane, PR #19, #32 | P-U6 (`Docs/threats-to-validity.md` in the registry) |
| SO4-07, SO5-06, THR-1, X-1 | ADR-020 (P-M, prereg v3) | P-M |

## 2. What the P-U6 stage did (this PR)

**ADR-021 item 8 (label-size corrections), before the bump.**
- `scripts/lib/label-plan.ts`, `corpus/label-plan-config.json` (version 2):
  - P3 is out of live labelling (`maxItems` 0), and its calls go to P2 (30, drawn PPS by stratum size).
  - Escalation by whole weeks of 180 calls, up to `maxWeeks` 4 (720 calls). A plan is never refused; past the
    limit, P1 + MS are thinned by a seeded SRS.
  - The P1 + MS basis is stated.
  - Context ceilings per kind: 6 000 characters, and 32 000 for judge units (= `codeSnippet` × 4).
  - `seeds.audit` is 6105.
- `scripts/build-label-plan.ts`:
  - Kish effective n and the half-width per row (E1 headline, fixtures, per generator, P2 overall, censuses).
  - `context.cut` by kind; the escalated budget; `auditSeed` carried in the plan.
  - `--bases` is optional.
- `scripts/llm-label.ts`:
  - The budget counts agy invocations, retries included (no call is sent unless two invocations fit).
  - `kappa_ci_*` and `ac1_ci_*` from the item bootstrap, and the run-vs-run `taxonomy_rule` (κ < 0.60 judged on
    the point estimate).
  - The 30-item audit is drawn from the plan by kind × population (`AUDIT_SEED_MISMATCH`, `AUDIT_NOT_LABEL_BLIND`),
    with `uncertain` kept as a category.
- `scripts/aggregate.ts`:
  - Label-dependent `fpat_*` are N/A without P3 labels, never 0.
  - `so5_patterns.csv` gains a `basis` column and symbolic profile rows.
  - SO2 follow-up in `latency.csv`: `within_stage`, `cycle_queries_sum_ms`, `gate_result_unregistered`, and
    `total_ms` = `timings.totalMs`.

**ADR-021 item 5.**
- `so4-heldout` names the seven held-out baseline entries, and `e7-corpus` names the three E7 bases.
- The count inputs and the spec-chain tools are registered without a recount.
- `u5a-site-feasibility.md` records the reconstructed command lines.

**ADR-021 item 7.**
- Prereg v4 registers `Docs/generator-protocol.md` and `experiments/e1-grid/generator-plan.json`.
- CI runs `--check-prereg` on every `experiments/*/plan.json` for PRs to `v1.2e`.

**Registry.** `REGISTERED_ARTEFACTS` gains:
- `Docs/DiagnosticRuns/u5a-site-feasibility.json`, `u5a-base-typecheck.json` and `e7-spec-generation.json`;
- `corpus/selections/*.json`;
- the spec-chain tools `scripts/generate-e7-specs-cli.ts`, `migrate-corpus-spec{,-cli}.ts`, `remap-domain-layer{,-cli}.ts` and `corpus-rubric-u4{,-cli}.ts`;
- `Docs/threats-to-validity.md` and `Docs/labeller-route.md`.

**Documents.**
- `Docs/analysis-plan.md`: the U6 text of every lane, plus §11 rows.
- `Docs/matching-rule.md` §8: the plan-drawn audit. The rule version stays 1.1.0.
- `Docs/threats-to-validity.md`: statuses, TV-96, the deviations, and the trace for ADR-021 item 10.
- `Docs/labeller-route.md`: registered.
- ADR-021 item 10 records the P-U6 decisions:
  - MO-DF01 seeds are not added to `apg-ablation`.
  - The type-resolution rate is dropped.
  - The audit seed is 6105, because 6104 is the open-coding seed.
- `Docs/prereg-reasons.md` section P-U6.

**Dry-run hand-offs** (`aidlc-docs/construction/build-and-test/experiment-runbook.md` §8):
- New `scripts/so4-plan-entries{,-cli}.ts` (`lib/so4-plan-entries.ts`): the seeded entries from a manifest, in
  the item 9 form, with `--self-test`.
- New `scripts/lib/mock-labeller.ts`: the labeller-shaped Mock of `llm-label --provider mock`.

## 3. Prereg version 4 and the gate

`corpus/prereg.json` v4 holds 65 registered artefacts. Previous versions: v1 `84bd30c`, v2 `02fbb2f`, v3 `a83de82`.
The per-artefact reasons are in `Docs/prereg-reasons.md` § P-U6. `--check-prereg` printed
`pre-registration v4 ok: 65 registered artefacts unchanged` for all seven plans: apg-ablation, e1-grid, e7-corpus,
fixtures, latency-gate, sensitivity and so4-heldout.

## 4. Tests and gates

- New tests:
  - `tests/unit/scripts/u6/label-sizes.test.ts`: κ and AC1 intervals and the κ rule; invocation counting and the
    budget stop; FPAT N/A and symbolic rows; aggregate latency columns; the Mock labeller.
  - `tests/unit/scripts/u6/so4-plan-entries.test.ts`.
- Rewritten: `tests/unit/scripts/u6/label-plan.test.ts`, with hand-computed fixtures for:
  - the escalation weeks (136 → 540 calls; 200 → 720; 300 → P2 −30, P4 −1; 400 → thinned with p = 345/400);
  - PPS (sizes 1/2/3/14, m = 2 → π = 1/6, 1/3, 1/2, 1; every non-certain item p = 1/6);
  - Kish n (10 × 1 + 10 × 3 → 16) and the Wilson half-widths.
- Updated: `label-audit`, `build-label-plan`, `label-adapters`, `aggregate`, `prereg` and `threats-register`
  tests. The Mock label fixture and the agy smoke labels gain the `invocations` field only (replayed; no label
  changed).
- Gates:
  - **T** clean (typecheck, u0-tests, scripts, u3-tests, u4-tests).
  - **L**: the changed files have no new lint errors.
  - **B** = 80, 0 `TS2688`, the same per file as `origin/v1.2e`.
  - **U**: a full `npm test -- --maxWorkers=2` under the lane lock (numbers in the PR).
    `tests/unit/cli/cli.test.ts` "defaults neo4j-uri" fails only when `NEO4J_URI` is exported, as it is for the
    shared lane; it fails the same way on `origin/v1.2e`.
  - **G**: no `src/` change, so the golden snapshots are unchanged and there is no `CHANGES.md` line.

## 5. Open items

- **so4-heldout seeded entries.** These follow `mutate` on the seven prepared bases (runbook 3.2–3.4) and need their
  own dated bump before the first so4-heldout run.
- **Measured labeller tokens.** After the first live record, `llm-label --usage` gives the input tokens per call.
  Recording them in `Docs/labeller-route.md` §6 is now a registered change (a bump).
- **SO5-08 residual.** The measured judge calls per usage window, the dated comparison line in
  `Docs/judge-preregistration.md` and an E7 estimate all need live calls.
- **SO1 at the tag.** `so1-metrics-<sha>.json` at the tag, and possibly the FR-20 layered run at the tagged commit
  (lane SO1).
- **Author decisions:**
  - TV-84: the controlled developer study is out of scope, and no ADR records that.
  - MarvinRF stays excluded. It may be re-admitted only as an exploratory extra, by a dated decision.
- **B&T plan wording.** `aidlc-docs/construction/plans/v1.2E-build-and-test-plan.md` still says the CI
  `--check-prereg` step is deferred. The B&T lane owns that file, and the main checkout has uncommitted edits in it,
  so this PR does not touch it.
- **Gate maintenance.** From now on, any PR to `v1.2e` that changes a registered artefact must carry its own bump, or
  the new CI step fails. The other lanes need to know this, especially BT, which owns corpus specs and
  `Docs/operator-catalogue.md`.
