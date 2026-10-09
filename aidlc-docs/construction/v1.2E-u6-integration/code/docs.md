# U6 lane Docs — threats register, thesis figures, bump naming (ADR-021)

**Dates**: first attempt 2026-10-08; resumes and follow-up 2026-10-09. **Branches**: `v1.2e-u6-docs` (PR #19, merged
`684e3df`) and the follow-up `v1.2e-u6-docs-followup` (worktree `DaedalusArch-wt-docs`, from `origin/v1.2e` `684e3df`).
**Findings closed**: THR-9, X-5, X-6. **Live LLM calls**: 0. No experiment run.

This header, the Findings table, Files and Tests give the final state (after Resume 2 and the follow-up). The Resume
sections below are the history; where they disagree with an earlier draft of this header, the header is current.

## Findings

| Finding | What closes it |
|---|---|
| THR-9 | `Docs/threats-to-validity.md`: 95 rows (TV-01..TV-95). Each maps a threat to a mitigation (`M:`) or a reporting duty (`D:`), with its output file, a status (`in place`, `in place (P-M, prereg v3)`, `in place (PR #n); registered by P-U6`, `pending <finding>`, `P-U6`, `P-3` / `P-4`, `residual`, `open`) and its Kap7–9 section. Also: §3, the registered home of the BR-U5b-50 / ADR-015 item 2 deviation entries, plus the declared pre-run deviations; §4, the judge degradation-ladder governing rules (steps, trigger, timing, scope, record); §5, a source trace that covers U1 §8, U3 §11, U4 §11, B&T summary §8, ADR-018..021, the generator protocol §1–§11 (with BR-U5a-41..44), Fable A1–B7 and every THR-* finding. TV-35 restates the U4 §11 self-preference mitigation. TV-36 is the judge canary residual and TV-95 the E1 generator isolation residual (both halves of the THR-9 "generator and judge canary residuals"). `Docs/judge-preregistration.md` points to §4 for the ladder rules. |
| X-5 | `scripts/figures.ts` (pure rules FIG-01..08, typed `FigureDef` registry, `main` with `--list` and `--self-test`) and `scripts/figures-cli.ts` (D-U5a-13 (a) form). Eight Vega-Lite specs in `scripts/lib/figures/thesis/`: SO4 P/R/F1 per function and per tag (recall with the cell interval solid, the project cluster interval dashed and the "if independent" instance Wilson bound faint, TV-22); SO4 precision (FIG-08, `precision_figure.csv`); the SO5 model × spec-level heatmap and interaction plot, both on the verdict-source AHS and on `ahsDeterministic`; SO2 latency from the so2-metrics `latency.csv` against the 30 s budget, and coverage; the threshold sweep ("sensitivity-only, not tuning", BR-U5b-60). `aggregate.ts` is not edited. `scripts/lib/figures/draw.ts` gains `renderSvgValues`. |
| X-6 | B&T plan bump table and glossary: P-M is the ADR-020 bump, P-2 stays the conditional cycle-strategy flip, and P-U6 is added. The content is on `origin/v1.2e` (B&T plan lines 79–82). |

## Files

- New (PR #19): `Docs/threats-to-validity.md`, `scripts/figures.ts`, `scripts/figures-cli.ts`, `scripts/lib/figures/thesis/*.vl.json` (8), `tests/fixtures/u6/figures/*.csv` (6) and `tests/fixtures/u6/figures/so2/latency.csv`, `tests/unit/scripts/u6/figures.test.ts`, `tests/unit/scripts/u6/threats-register.test.ts`, this note.
- Edited (PR #19): `scripts/lib/figures/draw.ts` (`renderSvgValues`), `tests/unit/scripts/u5b/imports.test.ts` (`figures` under the U5b import whitelist), `Docs/judge-preregistration.md` (pointer line).
- Follow-up: `Docs/threats-to-validity.md` (TV-95; TV-22, TV-36, TV-50, TV-61; §5 trace), `scripts/figures.ts` and `so4-prf-by-{function,tag}.vl.json` (the independent bound), `tests/fixtures/u6/figures/prf_by_{function,tag}.csv` (distinct cell and independent intervals), both U6 test files, this note.

## Tests

- `figures.test.ts`: 30 tests on hand-computed fixtures for FIG-01..08 (the FF-S01 recall row carries the cell Wilson on 4 cells [0.300642, 0.954413] and the instance Wilson 6 / 8 [0.409275, 0.928521], arithmetic in the test), header equality with `aggregate()`, registry ↔ spec files, the three FIG-02 interval layers, caption wrap, `--self-test` exit 1 (`FIG_SENSITIVITY_PURPOSE`), and the tsx CLI (8 byte-identical SVGs; header-only and absent CSVs skipped).
- `threats-register.test.ts`: 7 tests, REG-01..04: row structure, consecutive ids, source-trace completeness (now also the generator protocol §1–§11 and BR-U5a-41..44), the generator isolation row's content, and that every audit id named in the register exists. A mutation check (the `Generator protocol` trace line removed) fails 2 tests.

Gates (final, follow-up head): see "Follow-up" below. Earlier gates: G 80 / 7 on the shared `daedalus-neo4j-bt` 7693 (Resume 2).

## Registered artefacts

No registered artefact is touched (`corpus/prereg.json` unchanged). **P-U6 must cover**:
- add `Docs/threats-to-validity.md` to `REGISTERED_ARTEFACTS` (BR-U5b-51 list and its unit test), after turning the remaining `pending <finding>` statuses into their final state; TV-95 must be in the hashed version;
- optionally `Docs/judge-preregistration.md`, which is not needed now that the ladder rules live in the register.

The figure specs and `scripts/figures.ts` are derived views, so they need no registration (X-5).

## Resume (2026-10-09)

The first attempt stopped after the two lane commits. On resume: X-6 cherry-picked onto the branch; `origin/v1.2e` (P-1 merged, `a258db0`, prereg v2) merged in without conflicts; register rows TV-08, TV-09, TV-17, TV-22, the status key and the §3 SO4-floor deviation updated for P-1 (catalogue frozen at k = 2, 85 held-out instances, floor met, no shortfall). A second merge brought in PR #18 (SO5-gen) and ADR-021 item 5: TV-04, TV-29, TV-51 and TV-79 now read `in place (PR #18)`; TV-86..TV-89 map item 5 (held-out set named in the plans, count inputs registered, the binding Ch7 duties 1–9, MarvinRF and the style imbalance), with a new `P-U6` status key and the trace `ADR-021 5 → …`; REG-03 now expects ADR-021 items 1–5. Gates re-run after the merge.

## Resume 2 (2026-10-09, after P-M, the SO2 follow-up, SO5-gen follow-up and Labels merged)

- Merged `origin/v1.2e` twice (PR #22–#26). Conflicts: the B&T plan (kept v1.2e's P-M gate-state paragraph under the glossary) and `imports.test.ts` (kept both `figures` and `build-label-plan`).
- X-5 against the P-M CSV schemas (`aggregate.ts` not edited): FIG-02 requires the `ci_project_*` columns, draws the recall cell interval solid and the project cluster interval dashed with its `ci_project_descriptive` flag, and adds the per-function `precision_baseline` beside the seeded differential precision. The guessed `precision_ci_*` / `f1_ci_*` columns are dropped. New FIG-08 `so4-precision` reads `precision_figure.csv` (seeded differential FP-labelled / FP-strict beside the baseline precision, each with its interval; unknown measure or scope is `FIG_VALUE_INVALID`).
- FIG-05 now reads the `so2-metrics tables` `latency.csv` (`LATENCY_COLUMNS` of `scripts/lib/so2.ts`; every run, rejected included) from a new `--so2-dir`, one row per run and cycle query, `exceeds` = timeout or over `budget_ms`, `@ast-only` arms left out. The aggregate's `latency.csv` is never drawn (ADR-021 item 8: accepted-only, summed `cycle_query_ms`, non-registered `gate_result`). Without `--so2-dir` the figure is skipped. `FigureDef.source` names the directory.
- THR-9 register (94 rows): P-M rows read `in place (P-M, prereg v3)`; rows closed by PR #23/#24 (SO2-1..5, X-2, X-4) and PR #26 (SO3-5, THR-3, THR-6) read `in place (PR #n); registered by P-U6`; TV-22 records the small-cluster decision (cell interval sole primary, project bootstrap descriptive with 7 projects); TV-23 names `precision_figure.csv`; TV-75 the item 8 allow-list; new TV-90 (item 6 labelling budget), TV-91 (item 7 refused gate and CI step), TV-92 (item 8 measured graph and gate source). §5 trace and REG-03 cover ADR-021 items 1–8.
- A third merge brought PR #27 (SO1): TV-20 reads `in place (SO1-B, PR #27); pending SO1-C`, and new TV-93 maps SO1-D, SO1-E and X-7. A fourth merge brought the ADR-021 label-size corrections (the second item 8, Fable review of PR #26): new TV-94 records them and the labeller–judge context asymmetry that item asks the register to state; TV-90 points to it.
- Tests now: `figures.test.ts` 29, `threats-register.test.ts` 6.
- Gates (head before the lane commit): T clean (five tsconfigs); U 3149 / 226, 0 failed (3139 / 225 in the full run plus `neural-result-rows.test.ts` 10 / 1 re-run alone after the known Jest-worker `SIGSEGV`, TV-85); after the PR #27 merge U 3173 / 228, 0 failed, and G holds (that merge changes no `src/` file and no snapshot); L 496 errors (ratchet 497), 0 in the new or edited `scripts/**` (under `tsconfig.scripts.json`) and test files; B 80, 0 `TS2688`; G 80 / 7, 0 skipped, on the shared `daedalus-neo4j-bt` 7693 under `~/.daedalus-7693.lock`, no snapshot change, no `CHANGES.md` line. `figures-cli --self-test` exit 1 (`FIG_SENSITIVITY_PURPOSE`).

## Follow-up (2026-10-09, branch `v1.2e-u6-docs-followup`, after PR #19)

- TV-95 (E1 generator isolation, generator protocol trace, REG-03 coverage); TV-61 names the so2-metrics gate source (item 8).
- FIG-02 draws the `ci_independent` recall bound as a faint third interval (TV-22), then, after PR #28 (SO4-06), the precision and F1 intervals on the plotted basis. TV-16, TV-17, TV-20, TV-23 updated in place after PR #28; the TV-89 defect fixed; ADR-021 item 9 traced.
- Merged `origin/v1.2e` up to `cc02c0e` (PR #29 SO2 arms, PR #30 SO5-gen fix) without conflicts; TV-75 now names the per-base `so2-metrics arms` check (PR #29).
- Gates (follow-up head, after that merge): T clean (five tsconfigs); U 3215 / 231, 0 failed; L 496 errors (ratchet 497), 0 in the lane's `scripts/**` and test files; B 80, 0 `TS2688`; G 80 / 7, 0 skipped, on the shared `daedalus-neo4j-bt` 7693 under `~/.daedalus-7693.lock`, no snapshot change, no `CHANGES.md` line.

## Open items

- TV-84: the proposal's controlled developer study (Kap7 §4, Kap8 §3) is out of v1.2E scope, and no ADR records that. This needs an author decision.
- SO4-06: closed by PR #28; FIG-02 reads its precision and F1 interval columns (follow-up).
- ADR-021 item 8 leaves the aggregate's `latency.csv` (`cycle_query_ms`, `gate_result`, the double-counted sub-stage row) to P-U6 or P-M; FIG-05 no longer depends on it.
- Row statuses `pending <finding>` and `P-M` must be updated to `in place` as those lanes merge, before P-U6 registers this file.
- The main checkout's local `v1.2e` is 8 commits behind `origin/v1.2e`, with the author's own uncommitted plan and audit edits; `2585b29` is no longer on its branch (the glossary is on `origin/v1.2e`). Nothing to push from there.
