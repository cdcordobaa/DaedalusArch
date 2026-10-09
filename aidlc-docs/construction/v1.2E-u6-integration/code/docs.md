# U6 lane Docs — threats register, thesis figures, bump naming (ADR-021)

**Date**: 2026-10-08. **Branch**: `v1.2e-u6-docs` (worktree `DaedalusArch-wt-docs`, from `origin/v1.2e` `961ec81`).
**Findings closed**: THR-9, X-5, X-6. **Live LLM calls**: 0. No experiment run.

## Findings

| Finding | What closes it |
|---|---|
| THR-9 | `Docs/threats-to-validity.md`: 89 rows (TV-01..TV-89; TV-86..89 added on resume for ADR-021 item 5). Each maps a threat to a mitigation (`M:`) or a reporting duty (`D:`), with its output file, a status (`in place`, `P-M`, `pending <finding>`, `P-1` / `P-3` / `P-4`, `residual`, `open`) and its Kap7–9 section. Also: §3, the registered home of the BR-U5b-50 / ADR-015 item 2 deviation entries, plus the declared pre-run deviations; §4, the judge degradation-ladder governing rules (steps, trigger, timing, scope, record), as the audit's verify note asked; §5, a source trace that covers U1 §8, U3 §11, U4 §11, B&T summary §8, ADR-018..021, Fable A1–B7 and every THR-* finding. TV-35 restates the U4 §11 self-preference mitigation (the cited "Phase 5 Gemini cross-check" is not planned). `Docs/judge-preregistration.md` now points to §4 for the ladder rules (that file is not registered). |
| X-5 | `scripts/figures.ts` (pure rules FIG-01..07, typed `FigureDef` registry, `main` with `--list` and `--self-test`) and `scripts/figures-cli.ts` (D-U5a-13 (a) form). Seven Vega-Lite specs in `scripts/lib/figures/thesis/`: SO4 P/R/F1 per function and per tag, with intervals where the CSV carries them; the SO5 model × spec-level heatmap (n valid / n cells) and interaction plot, both on the verdict-source AHS and on `ahsDeterministic` (ADR-020 item 7); SO2 latency against the 30 s budget, and coverage; the threshold sweep, whose caption carries "sensitivity-only, not tuning" (BR-U5b-60) and which refuses any row whose purpose is not `sensitivity-only`. Schemas come from `aggregate.ts` / `rescore.ts` headers (a test checks them against `aggregate()` output). `aggregate.ts` is not edited. `scripts/lib/figures/draw.ts` gains `renderSvgValues`; `renderSvg` delegates to it, with unchanged bytes. |
| X-6 | B&T plan bump table and glossary: P-M is the ADR-020 bump, P-2 stays the conditional cycle-strategy flip, and P-U6 is added. Committed in the main checkout as `2585b29`, local `v1.2e`, staging only that hunk (`git apply --cached`). The other uncommitted plan and audit edits in the main checkout are untouched. The main checkout's `v1.2e` is behind `origin/v1.2e` and was not pushed; the same commit is cherry-picked onto this branch (`dca1841`), so it lands through this PR. |

## Files

- New: `Docs/threats-to-validity.md`, `scripts/figures.ts`, `scripts/figures-cli.ts`, `scripts/lib/figures/thesis/*.vl.json` (7), `tests/fixtures/u6/figures/*.csv` (6), `tests/unit/scripts/u6/figures.test.ts`, `tests/unit/scripts/u6/threats-register.test.ts`, this note.
- Edited: `scripts/lib/figures/draw.ts` (`renderSvgValues`), `tests/unit/scripts/u5b/imports.test.ts` (`figures` under the U5b import whitelist), `Docs/judge-preregistration.md` (pointer line).

## Tests

+33 tests, 2 suites:
- `figures.test.ts`: 27 tests. These cover the hand-computed fixtures for FIG-01..07, header equality with `aggregate()`, registry ↔ spec files, caption wrap, `--self-test` exit 1 (`FIG_SENSITIVITY_PURPOSE`), and the tsx CLI. The CLI test draws 7 byte-identical SVGs and skips header-only and absent CSVs.
- `threats-register.test.ts`: 6 tests, REG-01..04. They check the row structure, consecutive ids, source-trace completeness and that every audit id named in the register exists.

Gates:
- T: clean.
- U: 2936 / 205, 0 failed (2939 / 205 after the resume merge).
- L: 497, and 0 errors in the new or edited `scripts/**` and test files.
- B: 80, 0 `TS2688`.
- G: 80 / 7, 0 skipped, on lane Neo4j 7697. The snapshot hashes equal `BT_SNAPSHOT_HASHES`, so there is no `CHANGES.md` line.

## Registered artefacts

No registered artefact is touched (`corpus/prereg.json` unchanged). **P-U6 must cover**:
- add `Docs/threats-to-validity.md` to `REGISTERED_ARTEFACTS` (BR-U5b-51 list and its unit test);
- optionally `Docs/judge-preregistration.md`, which is not needed now that the ladder rules live in the register.

The figure specs and `scripts/figures.ts` are derived views, so they need no registration (X-5).

## Resume (2026-10-09)

The first attempt stopped after the two lane commits. On resume: X-6 cherry-picked onto the branch; `origin/v1.2e` (P-1 merged, `a258db0`, prereg v2) merged in without conflicts; register rows TV-08, TV-09, TV-17, TV-22, the status key and the §3 SO4-floor deviation updated for P-1 (catalogue frozen at k = 2, 85 held-out instances, floor met, no shortfall). A second merge brought in PR #18 (SO5-gen) and ADR-021 item 5: TV-04, TV-29, TV-51 and TV-79 now read `in place (PR #18)`; TV-86..TV-89 map item 5 (held-out set named in the plans, count inputs registered, the binding Ch7 duties 1–9, MarvinRF and the style imbalance), with a new `P-U6` status key and the trace `ADR-021 5 → …`; REG-03 now expects ADR-021 items 1–5. Gates re-run after the merge.

## Open items

- `Docs/DiagnosticRuns/methodology-review-2026-10-08.md` (the Fable review the register traces) is on the P-M branch (`eb4a9c1`), not yet on `v1.2e`.
- TV-84: the proposal's controlled developer study (Kap7 §4, Kap8 §3) is out of v1.2E scope, and no ADR records that. This needs an author decision.
- When SO4-06 lands, its precision and F1 interval columns should be named `precision_ci_low` / `_high` and `f1_ci_low` / `_high`, so that the SO4 figures draw them. Otherwise `PRF_REQUIRED` / `optionalInterval` in `scripts/figures.ts` need the actual names.
- Row statuses `pending <finding>` and `P-M` must be updated to `in place` as those lanes merge, before P-U6 registers this file.
- `2585b29` (X-6) is still a local commit on the main checkout's `v1.2e`. Its content reaches `origin/v1.2e` through this PR (`dca1841`), so when the main checkout is next updated, `git pull --rebase` drops it as already applied; it must not be pushed separately.
