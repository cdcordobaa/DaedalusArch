# Fable adversarial review of the Study 2b pre-registration (2026-10-20)

**VERDICT: GO-WITH-FIXES.** The design (shared step 1, paired blocks, two-sided sign-flip with Holm, a fixed N before any 2b call) is sound and the N = 40 power figures reproduce exactly from the committed code. The draft cannot be dated as it stands: six blocking items would let an examiner discount the confirmatory claim or show the repository contradicting the registered text. All six are fixable before dating with zero model calls and no change to a frozen path.

**Scope and method.** Reviewed PR #316 (`docs/study2b-prereg`, head `36b6b2e8`) against the drift record, the exploratory registration and 2a report, the freeze record, the rehearsal note and runbook (merged to main in PR #317), the exposure definitions, `ops/decisions.md` (DELEG..DELEG7, GO-2B, V4-ACC; DELEG4/5 only on `v14/holdout-run-1`), the hold-out note and both prespec addenda, `scripts/v1.4/study2b-power.ts` and `level-power-sim.ts` (`pilotPower`). Nothing under `daedalus-sealed/` or `results/v1.3-meaning/mean-01-sample.*` was read. Zero model calls. One CPU-only check: both power routines re-run at N = 20, 32, 40 (seeds as registered). Results: H1 half-size 0.446 / 0.746 / 0.879, H2 1.000 at N = 40, `pilotPower` H1 0.91/0.98/0.99 and H2 0.90/0.98/0.99 at 40 blocks, identical to DELEG7's table. The "shared" correlation model, which the drift record §4 says must also be reported, gives H1 0.80/0.87/0.89 already at 24 blocks.

**Note on the brief.** The brief names "DELEG6 post-run acceptance". No DELEG6 exists in `ops/decisions.md` on `main`, `docs/study2b-prereg` or `v14/holdout-run-1`. Finding 6 treats it as undecided.

---

## Blocking

### 1. No confirmatory analysis script exists, and §4 says the opposite
- **Text.** §4 "Scoring": "The analysis script and its hash are frozen at the gate (D9). It is the same script that produced the 2a Stage C tables, applied unchanged."
- **Problem.** `stage-c-rescore.ts` computes D, Y₁, Yₖ and descriptive ratios only. It has no sign-flip test, no Holm, no within-task or task-cluster bootstrap, no equivalence test, no V4 part A or part B, no sensitivity lines. `scripts/v1.3/lib/study2-analysis.ts` is the retired slope design (arms `gate`/`none`). The 2a report §8 says part B's snapshot-clustered bootstrap "was not computed". So D9 ("analysis script run end to end on rehearsal data, every final table") is red, and the pre-registration describes a script that does not exist. An examiner can then argue every analytic choice was made after the data.
- **Fix.** Before dating: add `scripts/v1.4/study2b-analyse.ts` (additive, not a frozen-path change) that reads `rescore/runs.json` and the seeded-recall outputs and emits every §4 table: MC and exact sign-flip p per contrast, Holm over the surviving family, d̄ and RR with both bootstrap intervals, E, parts A and B, the full-distribution tables, and every sensitivity line. Unit-test it; run it on 2a Stage C data with a planted effect (D9) and show it reproduces 2a report §3. Record its sha256 in P8 and in the OSF deposit. Replace the sentence above with "the analysis script is `…`, sha256 `…`, tested on 2a data with a planted effect on <date>".

### 2. The composition-root exemption (Q25 = B) is an arm-sensitive measurement channel with no registered neutralisation
- **Text.** §7 item 9 and §1 "Composition-root placement (descriptive)".
- **Problem.** Every 2a identity was FF-S03 wiring from a presentation entry file; the same edge in `main.ts` (or `*.module.ts`, `*Container.ts`, `composition-root/`) counts 0. The shared step-1 tree fixes the entry-file name for all cells, but at steps 2–5 a treated cell can (a) rename `server.ts` to `main.ts` (ρ with `renamePolicy: continue` carries the inherited identities into an exempt file, so they vanish and are scored as repair) or (b) wire each new slice in `main.ts` (D = 0 without any structural change). The treated arms are the ones pushed toward this: the MCP `check_file`/`check_import` messages say "inject the implementation from the composition root" (`src/mcp-server/file-check.ts:82`, `fast-rules.ts:111`), and the MCP fast-hint path exempts files matching `APG2_COMPOSITION_ROOT_NAME_PATTERNS` (`main`, `bootstrap`, `composition-root`, `container`, `di`, `*.module`), a broader list than the scorer's Q25 globs (`bootstrap.ts` and `di.ts` pass the hint but count in D). In 2a, 5 of 5 undetected MO-S03 seeds sat in an exempt `main.ts`. A descriptive secondary cannot rescue the primary when the shares differ between cells.
- **Fix (pre-register all of it).**
  1. **D†, a registered sensitivity primary:** new distinct presentation→persistence import edges at steps 2–5, from any file, with no composition-root exemption, computed from the evaluated graphs (the opportunity edges `exposure-count.ts` already enumerates; an additive script, no frozen-path change). Rule: H1 or H2 is "supported" only if the Holm decision and the sign agree under D and D†; if they disagree, the result is reported as "holds under the composition-root exemption only" and the claim is scoped accordingly.
  2. **An evasion bar:** per cell, the share of composition-root wiring in exempt files, and the count of ρ-mapped renames of a non-exempt entry file to an exempt name. A difference above 0.20 between the cells of a contrast flags the contrast (reported with D† as the primary reading).
  3. **A zero-call probe before dating:** run `check_file` and `check_import` of the frozen MCP build on a presentation→persistence import in `src/presentation/main.ts` and in `server.ts`, and record in the pre-registration what each arm is told. If the MCP check path and the scorer disagree on any name pattern, list the names.
  4. Add "renamed the entry file to an exempt name" as a class in the moved-only read (s2d-01 §5.5).

### 3. DELEG7 (N = 40) is not reproducible from the repository and the draft contradicts itself
- **Text.** §3 "Resolved by DELEG7"; §10 row P3; §6 row D3; §8 table; `results/v1.4-study2b-power/`.
- **Problem.** The committed `resampling/tables.md` ends "Choice: kept H2; demoted H1; N = 20"; `STUDY2B_GRID` is `[8, 12, 16, 20, 24]`; `level-power-sim/tables.md` has only the 16-block grid; nothing at 32 or 40 is committed. §10 P3 still reads "N = 20, r = 5, 260 turns, cap 390; H1 demoted". §6 puts "GREEN (at N = 40)" in the column headed "Dashboard 2026-10-16". §3 item 3 says running step 2 at another N "would change the method. It is then a dated deviation (§8)", yet §8 has no such row. The decision itself is defensible as pre-data (dated 10:49Z, before any 2b call, N raised not lowered, no test or α changed, figures reproduce), but an examiner who opens the results folder finds the registered text contradicted.
- **Fix.** Extend `STUDY2B_GRID` to `[8, 12, 16, 20, 24, 32, 40]`, add a `--replicates` option to the `pilotPower` entry (or a tiny committed driver), re-run both, commit `power.json`/`tables.md` for both steps at every grid value (both correlation models for step 2). Add DV7: "the registered script's 4 × 4 × generators grid is extended to 4 × 10 × 1; stricter (N raised); N fixed before any 2b call". Fix the P3 and D3 rows. State in §3 that N was chosen by the coordinator under DELEG7, not by the author, and that the author's dated acknowledgement (S13) precedes the run.

### 4. The registered run order does not exist, and cell is confounded with time and lane
- **Text.** §2 "Order inside a block: … Each cell's run order within a block is drawn with the run seed (P7)"; §2 "Environment: One lane"; DELEG7 "carried by running two lanes"; runbook §5.
- **Problem.** The runbook runs all `none@L2` steps 1–5 for all 4R runs first (200 turns at N = 40), then `none@L3` and `mcp@L2` in two parallel lanes. There is no within-block cell order and no seed for one. The reference cell therefore runs in an earlier calendar window than both treated cells, across usage-limit resets and any server-side change behind the `claude-sonnet-5-5` alias, and each treated cell sits on its own lane. The pre-registration cannot describe an order the harness does not implement.
- **Fix.** Replace the P7 line with the true order (phases, lanes, `orderSeed` 20261019 for the task × replicate order within a phase). Pre-register per-turn start/end timestamps and the served model string (finding 11) as recorded covariates, and a time sensitivity: D of `none@L2` by run-index halves, and D per treated cell by lane; a sign reversal between halves is reported next to the primary. If the frozen harness allows it without a `scripts/` change, run per replicate (fill R = 1 plans ten times: l2 replicate r, then l3 r and mcp r) so the three cells of a block are hours apart, not days; say which was done.

### 5. The V4 route is unregistered, part A is vacuous, and part B forks on the exempt-site question
- **Text.** §4 "V4 consequence"; §6 "V4 and the hold-out"; P6; ADR-V14-04 §4; addendum 2 §2.
- **Problem.**
  - F-RF is cited from the unmerged branch `v14/holdout-run-1` and is "not registered" by the draft's own words. A pre-registration cannot be dated on a fallback that is not on `main` with its `sealed-hashes.md` row.
  - Part A computes m_c = Σ_f s_c(f)(1 − r_f). When one family carries every identity (2a: FF-S03 100 % in all cells), s_c(FF-S03) = 1 for every cell, so m_c is identical and |m_c − m_c′| = 0 whatever r_f is. Part A then passes by construction and cannot see the within-family differential channel of finding 2. The dev-set r_f (layered blind-primary 7/8 pooled, fewer per rule) is also far too thin to carry a 0.05 margin.
  - A cell with ΣD_c = 0 has s_c undefined, so part A "cannot be run" and §4 then makes Layered exploratory. With P(D = 0) ≈ 0.67 per block in the treated cells this is unlikely at N = 40 but not excluded, and the rule must not be chosen after the fact.
  - Part B: 2a reports MO-S03 both as 30/35 (all sites) and 30/30 (non-exempt sites). On "all sites", a cell whose agents put wiring in `main.ts` fails part B for the exemption reason, not an instrument reason. The denominator is a fork.
- **Fix.** Merge addendum 2 with its hash row before dating, then cite it. Add to §4: "Part A is uninformative when a single family carries ≥ 90 % of counted identities in every cell; it is reported, and part B carries the non-differential check." Define s_c = 0 for every family when ΣD_c = 0 and say part A passes vacuously with that noted. Register part B on non-exempt sites as the instrument check, with the exempt-site share per cell reported beside it (finding 2). State the legitimate claim in §7: Layered is confirmatory for the between-arm contrast conditional on part B; no instrument-accuracy claim; absolute D is an under-count; recall "characterised on the development set, not validated on a hold-out".

### 6. D12 (acceptance, no waiver) has no start rule and no recorded decision
- **Text.** §5 "Not counted"; §6 row D12; rehearsal finding F2; runbook §3.
- **Problem.** The rehearsal shows every acceptance record is `no-start-command` unless a task carries a start block; whether the sealed tasks do is unknown and cannot be checked blind. The decision the brief calls DELEG6 is not in the repository. Plans still have `acceptance.enabled: true`. If acceptance is run after the run, the start rule must be fixed now, because the entry file name is the agent's choice (finding 2 again).
- **Fix.** Record the decision with id and timestamp before dating. Pre-register the procedure: zero calls, on every stored step snapshot; build with the harness `tsc` into a scratch directory; entry resolution rule (e.g. `package.json` `main`, else the first existing of `src/presentation/{server,main,app,index}.ts`), port, timeout; the pass rate per cell as the s2d-01 §5.1 evasion bar (within 10 points of `none@L2`) and the D12 feature-dropping reading; never a filter on D. Say whether in-loop acceptance stays enabled (and that its `no-start-command` records are expected) or is dropped from the plans.

---

## Major

### 7. Δ = 0.55 is as large as the signal it bounds
- **Text.** §3 P4; §4 "Equivalence E".
- **Problem.** The 2a treated-cell means are 0.50 and 0.67 D per block. "Within ±0.55" therefore permits `mcp@L2` to carry about twice the drift of `none@L3` and still read "equivalent". The P4 note ("at N = 20 … half-width about 0.5") is stale: at N = 40 and SD 1.3 the 90 % half-width is about 0.34.
- **Fix.** Keep the rule-derived Δ but state its meaning in relative terms in §4; add a registered secondary Δ₂ = 0.28 (a quarter of the lower bound) reported descriptively; update the half-width note; add "E is reported as not established, whatever the interval, if the pooled treated-cell mean D is below Δ".

### 8. Statistical plan: six gaps an examiner will probe
- **Text.** §3 steps 2–3; §4 "The test", "Sensitivity", "Reading the result".
- (a) T = Σd_b is magnitude-driven; with zero-inflated integer differences one block with d = 3 (2a ice-rink r2) can decide a test. Pre-register a signed-rank or sign test as a robustness line beside the primary.
- (b) The task-level sign-flip over 4 task sums has a smallest two-sided p of 2/16 = 0.125. Say it can never reject and is descriptive.
- (c) The exact convolution p is available at any N (`exactSignFlipP`). Report it at every N and state that if the MC p and the exact p disagree at α′, the exact governs (declare as a deviation, stricter or equal).
- (d) Step 3 for H2 resamples from differences with no negative value (q = 1.00), so it is an upper bound by construction; say so, and that step 2 is the binding step. Step 2 reports only the independent model; the drift record §4 requires both. Add the shared-model rows.
- (e) "A block with Y₁ = 0 contributes 0 in every cell" is an expectation from probe 1, not a property of D. Reword, pre-register the Y₁ = 0 share, and a sensitivity dropping those blocks.
- (f) H3 in the Holm family at ≈ 0.06 power costs H1/H2 α′ (0.0167 against 0.025). State the reason (FWER over all three pairwise tests) and the cost. Note the task-cluster bootstrap has 4 clusters and takes few values.

### 9. The evasion check (M6) is referenced, not registered
- **Text.** §1 "The drift record's other secondaries: … the evasion measures (drift record §6)".
- **Problem.** The seven s2d-01 §5 items with their bars (acceptance within 10 points; literal-view gap above one identity; moved-only bar 0 in `mcp`; tool use in ≥ 80 % of `mcp` steps; concentration) are not in the pre-registration. Item 7 will trigger by construction if FF-S03 is again the only family: D without it is identically 0, RR undefined.
- **Fix.** Enumerate the seven items with bars in §4. Pre-state: "if ≥ 90 % of counted identities are FF-S03 wiring, the claim is scoped to composition-root wiring (G12), as the 2a report §14 item 4 anticipated". Add the rename class (finding 2).

### 10. Usage limits and resume are unverified for a 520-turn run
- **Text.** §4 "No stopping-rule change"; §5 "Harness failures only"; §6 rows S1, D14.
- **Problem.** The rehearsal ran 13 turns with no injected pause and no kill-and-resume; D14's live resume is still red. The harness resume discards a partial step and redraws it (`restarts.jsonl`), which is a second model sample for that step.
- **Fix.** Pre-register: a usage-limit pause resumes and is not a stop; a redraw of a partial step is logged, counted and reported per cell, and is not a "second run" of a sealed task; the pause duration between a block's cells is recorded. Before dating, run one live kill-and-resume on a practice task (≤ 2 calls) or register D14 as a dated deviation.

### 11. The generator pin pins the CLI, not the model
- **Text.** §2 "Generator"; P5.
- **Problem.** 2a step records carry only the alias (`modelId: claude-sonnet-5-5`, 43 rows). What serves the alias can change during a two-day run, and the phase order (finding 4) confounds any such change with cell.
- **Fix.** P5 records the CLI version, the alias, and the model id string the CLI's JSON result reports per turn if it exposes a dated id (otherwise state that it does not and that the alias is the pin), plus per-turn timestamps. Add the sha256 of `scripts/lib/generators/argv.ts` at X.

### 12. Q10 = D narrows the construct and is cited only in passing
- **Text.** §1 "Primary outcome"; §7.
- **Problem.** FF-P01 left Layered's blocking set on 2026-10-20 by a pre-dated G0.9 criterion after external-set data were seen. Defensible as pre-2b, but the pre-registration must own it: the blocking set, the date, the criterion, and that D cannot be recomputed with FF-P01 at the tag.
- **Fix.** One paragraph in §1 with the DELEG-Q10 reference and the suspected checker limit.

---

## Minor

13. **Environment (§2 "Customizations off").** `--no-session-persistence` is emitted by `buildGeneratorArgs` but absent from the listed flag set; list it. State that the 2a `none@L2` power inputs ran under `--safe-mode` and 2b under the explicit set, bridged by the 2-call equivalence check.
14. **P7 and seeds.** The templates already carry `orderSeed` 20261019; the "Seeds fixed now" line should name it and drop the cell-order seed (finding 4).
15. **Repair turns.** Templates set `maxRepairTurns: 0`; the "1.5 × cap covering repair turns" is a resume/redraw allowance. Say which.
16. **Disclosure.** Hold-out attempt 1 printed 34 sealed hold-out paths into the coordinator's transcript; the same coordinator runs 2b. One line in §6 saying so (different sealed set, no effect on 2b).
17. **Gemini extension.** Add that its addendum (P9) is dated before its first call and uses N = 40.
18. **Changelog/P10.** This review's findings and the responses go into the changelog before dating, as §9 step 3 says; the file's sha256 at the go commit goes in P8.

## Forking-path summary
- **DELEG7:** defensible as pre-data for 2b once committed and filed as DV7 (finding 3).
- **Q10 = D:** pre-dated criterion applied as written; owned in §1 (finding 12).
- **F-RF:** drafted after attempt 1 failed but before any recall figure existed; defensible once merged and hashed, with part A declared uninformative (finding 5).
- **Post-run acceptance ("DELEG6"):** not in the repository; must be recorded before dating (finding 6).
- **Q25 = B:** frozen, not a fork; the fork is in what is pre-registered around it (findings 2 and 5).
