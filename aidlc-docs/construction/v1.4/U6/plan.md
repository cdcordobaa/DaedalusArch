# U6 code-generation plan: detection recall fixes (C3)

**Unit:** U6, C3 detect (P3). **Cycle:** AI-DLC v1.4 "instrument alignment", minimal depth. **Design:** `aidlc-docs/construction/v1.4/U6/functional-design/design.md`. Companions: `adjudication-sheet.md` and `adr-drafts.md` in the same folder.

**Status: BUILDABLE since 2026-10-19.** Gate 0 is ticked from the author's 61 answers on the decision desk (`ops/review/2026-10-19/decision-desk/answers.json`: 56 signed by the author, 5 delegated to the coordinator, `ops/decisions.md` DELEG). This plan is the single source of truth for U6 code generation.

**Review 2026-10-18 (adversarial design review, revised in place):**
- New gate items: G0.8 (scorer alignment, design §3.3), G0.9 (refutation criteria) and G0.10 (sequencing).
- Step 1: the `isStatusQuo` guard.
- Step 4: refactor and new flags, with no jest run over the 71 cases.
- Step 7: the test file moves.
- Step 8: split into a draft now and the signature after the fresh checks (Step 11b).
- Step 10: the engine passthrough location, construct-aware tiers and the MO-H03 key.
- Part F: the one re-run is freeze runbook step 3, once for all units, on Neo4j; the interpreter run is a later cross-check.

## Hard rules for every step

- **Never read** `daedalus-sealed/`, `.env`, or any credential or config directory.
- **No calls:** no model or external API call. A clone or an `npm install` of an external repository (Steps 10 and 11) needs the author's approval.
- **Neo4j:** never start it. Use `--engine cypher-interp`, or skip the step and note it.
- **jest:** always `--maxWorkers=2`. Never compute development-set figures inside jest (71 graph extractions).
- **Machine load:** one evaluate or re-score process at a time. Pass `--graph-cache <scratch>/graphs.json` to every re-score.
- **Don't edit:** `ops/`, `aidlc-docs/audit.md`, `aidlc-docs/aidlc-state.md`, `Docs/v1.3/rule-tiers.md`, the presets, the frozen template text, any manifest or reference descriptor, the operator catalogue, or the committed `results/v1.3-reference/after-member-facts/adjudication.csv`.
- **Git:** no force-push, and nothing on the v1.3 or v1.2e branches.
- **One loop.** Apply once, preview once, then freeze, with one development re-run for the whole cycle (Part F). A figure never triggers a second change. The only exceptions are pre-declared: a fresh check that meets a G0.9 criterion sends a question back to A, or Q10 from C to D.
- **Docs:** repo-relative paths only, and no billing figures.

---

## Gate 0: author decisions (blocking; none of these is the agent's to make)

- [x] G0.1 (signed 2026-10-19 by the author via the decision desk: A, the decision sheet as written, no changes) D1: the changes to the decision sheet are written in `ops/decisions.md`. Re-read them, and re-check this plan against them.
- [x] G0.2 (signed 2026-10-19 by the author via the decision desk: P1 = A, P2 = A, and Precedence = A) P1 and P2 confirmed (`Docs/v1.3/construct-decisions.md`, Principles).
- [x] G0.3 (signed 2026-10-19 by the author via the decision desk: Q4 A, Q5 C, Q6 B with the P2 owner both FF-S01 and FF-S04, Q7 A, Q8 B, Q10 C (provisional until the G0.9 Q10 check), Q12 B, Q13 B, Q20 A; all 25 in `Docs/v1.3/construct-answers.json` and the `[Answer]:` lines) Answers:
  - Q5: D / C / A. Decide it **after** G0.8. Without scorer alignment, C is recommended.
  - Q6: B / A, plus the P2 owner.
  - Q10: C / D, provisionally C. The final choice follows Step 11.
  - Q12: B / A.
  - Q4, Q7, Q13 and Q20: recommended A, A, B, A.
  - Q8 B, confirmed by its owning unit.
  - The author fills in the matching `[Answer]:` lines of `Docs/v1.3/construct-decisions.md` (freeze-check F3).
- [x] G0.4 (signed 2026-10-19 by the author via the decision desk: all 9 rows and N1 `spec`) The 9 adjudication verdicts, plus N1 if Q6 is B, signed in `adjudication-sheet.md`.
- [x] G0.5 (signed 2026-10-19 by the author via the decision desk: A, approved, pinned commits, `--ignore-scripts`) Approval to clone and install (`--ignore-scripts`) the 5 external layered repositories (Step 11) and the real hex/ddd projects (Step 10), or "skip and note".
- [x] G0.6 (signed 2026-10-19 by the author via the decision desk: A, the author runs both) Owner named for freeze runbook step 3: the Neo4j development re-run and `ue-score.ts --blind`. These are author-run steps.
- [x] G0.7 (signed 2026-10-19 by the author via the decision desk: A, one ADR-V13-03, entered in the G14 list now) ADR form (one ADR-V13-03, or four), and entry into the G14 deviation list.
- [x] G0.8 (delegated to the coordinator 2026-10-19 (recommended answer): **(b)**, no scorer change; registered figures are reported as computed, so Q5 = C) **Scorer alignment** (design §3.3): (a) the reference, `ue-score.ts` and hold-out scorers read the answers, as a declared scoring deviation built by an approved unit before the record run; or (b) no scorer change, and the registered figures are reported as computed.
- [x] G0.9 (delegated to the coordinator 2026-10-19 (recommended answer): the four criteria below, as drafted on the signing sheet §5, dated 2026-10-19, before any fresh check ran) **Refutation criteria** for each fresh check (Steps 10 and 11), written in the ADR draft before the check runs (design §5, guard 6).
- [x] G0.10 (signed 2026-10-19 by the author via the decision desk: A, the apply commit lands after the other units' development runs; the PR that carries it is merged only then) **Sequencing:** when the apply commit (Step 6) lands relative to other units' development runs. Every v1.3 consumer of `CONSTRUCT_ANSWERS` changes behaviour at that commit (design §8, §9).

### G0.8 and G0.9 entries (2026-10-19)

**G0.8 = (b), no scorer change** (delegated to the coordinator 2026-10-19 (recommended answer)). `reference-model.ts`, `ue-score.ts` and `holdout-score.ts` are not changed. The registered figures are reported as the scorers compute them. Consequences: Q5 is C (FF-S01, scored natively); no `blind-rule-mapping.json` row for FF-S05 is needed; under Q10 C the author-manifest FF-P01 rows in layered stay misses in the author view. No scoring deviation enters the G14 list.

**G0.9 refutation criteria** (delegated to the coordinator 2026-10-19 (recommended answer); signing sheet `ops/notes/signing-sheet-2026-10-19.md` §5). Dated 2026-10-19, before any fresh check of Steps 10 and 11 ran. A met criterion may only send a question back to A, or Q10 from C to D; it never adds an option or changes a list.

| Switch | Fresh check | The result that withdraws it |
|---|---|---|
| Q5 C | MO-H03 seeds and twins (hexagonal; ddd has no seeded check); correctness read of the adapter-pair rows on the real hex/ddd projects | any MO-H03 seed missed, **or** any twin gains a blocking row, **or** any listed real-code row is judged incorrect by the C3 correctness procedure and is not also reported by FF-S01 → Q5 back to A |
| Q6 B | MO-H02 seeds with FF-S04 expected; twins | any MO-H02 seed missed, **or** any twin gains a blocking row → Q6 back to A |
| Q10 C | FF-P01 and new FF-S01 package rows on the 5 external Layered repos | any listed row judged incorrect by the C3 procedure and not also reported by FF-S01 → Q10 goes to D |
| Q12 B | adjacent-upward FF-S03 rows on the 5 external Layered repos | any adjacent-upward edge that Q12 B stops reporting under FF-S03 is not reported by FF-S01 either → Q12 back to A |

---

## Part A: pre-flight (no behaviour change)

### Step 1: Guard the tests against a non-A default
- [ ] These tests read `CONSTRUCT_ANSWERS` (checked with grep):
  - `tests/unit/construct-switches/{pipeline,pipeline-report,compile,rescore}.test.ts`
  - `tests/unit/pipeline/commands.test.ts`
  - `tests/unit/fitness-compiler/v13-fix-round.test.ts`
- [ ] Where a test *uses* the default while expecting the status quo, make it pass `STATUS_QUO_ANSWERS` explicitly (`src/shared/construct-switches.ts`).
- [ ] Leave the guard `expect(isStatusQuo(CONSTRUCT_ANSWERS)).toBe(true)` in `rescore.test.ts` as it is here. It is changed on purpose in Step 6, not here.
- [ ] Run `npx jest --maxWorkers=2 tests/unit/construct-switches tests/unit/pipeline tests/unit/fitness-compiler`. It must be green, with no behaviour change. Make this a separate commit.

### Step 2: Baseline checks
- [ ] Run `npx tsc --noEmit` and `npx tsc --noEmit -p tsconfig.scripts.json`. Both must be clean.
- [ ] Run `node --import tsx scripts/v1.3/blind-misses-rescore.ts --base results/v1.3-reference/after-member-facts --graph-cache <scratch>/graphs.json --json <scratch>/before.json > <scratch>/before.txt`. In the "corrected baseline (Q8 B)" set, it must reproduce blind 50/64 and 50/54, and author 54/54. Keep `before.txt` and `before.json` for the byte-identity check in Step 4.

---

## Part B: adjudicated reference view (new code)

### Step 3: Move the key code, then add the verdict parser and checker
- [ ] Move `canon`, `match`, `rebuildBlindKey`, `scoreBlind` and the CSV parser out of `scripts/v1.3/blind-misses-rescore.ts`, unchanged, into a new `scripts/v1.3/lib/blind-key.ts`. The entry file imports them.
- [ ] Create `tests/unit/scripts/v1.3/blind-key.test.ts` on toy rows: cycle canonicalisation, exact targets first, one-to-one matching.
- [ ] Create `scripts/v1.3/lib/adjudication-verdicts.ts`. It:
  - parses the CSV defined in design §6.2;
  - matches each verdict to a row of the **rebuilt blind-expanded key** (not `adjudication.csv` alone, because N1 is an agreed row), by style, variant, rule and the `canon` file pair;
  - enforces BR-U6-C1: it refuses split verdicts within one question group that have no `verdict_note`, and flags a `blind` verdict whose answer does not recover the row;
  - returns the key minus the rows ruled `spec`.
- [ ] Create `tests/unit/scripts/v1.3/adjudication-verdicts.test.ts`. It covers:
  - parsing;
  - an unknown row, which is an error;
  - N1 matched against an agreed key row;
  - a split Q4 group, which is refused;
  - a split Q7 group with a note, which is accepted;
  - a `blind` verdict under Q4 A, which is flagged;
  - a missing file, which means "no view";
  - adjudicated counts on a toy key of 3 styles.

### Step 4: New options of the re-score
- [ ] Add `--verdicts <csv>` to `scripts/v1.3/blind-misses-rescore.ts`. It adds an `adjudicated` column group and a JSON `adjudicated` object to every set printed (design §6.3).
- [ ] Add `--answers <json>`, which appends one set, "answers file", read with `parseAnswersDocument`. Q8 B is added if the file does not set it. Do not edit `SETS`.
- [ ] Add `--as-run` and `--key-base <dir>`. Under `--as-run`, the tool rows are the base's `raw/` as written (no `rescore()`), and the key renames follow the switch file's answers. The key and its `scores.json` check come from `--key-base`.
- [ ] Byte identity: without the new flags, run the Step 2 command again and `diff` the output against `before.txt` and `before.json`. Both must be identical.
- [ ] Run `npx jest --maxWorkers=2 tests/unit/scripts/v1.3 tests/unit/construct-switches`.

---

## Part C: apply the answers (after Gate 0, and in the order G0.10 sets)

### Step 5: The answers file
- [ ] Create `Docs/v1.3/construct-answers.json`, holding the author's G0.3 answers with notes. If another unit already made it, merge U6's entries into it. U6 owns Q4, Q5, Q6, Q7, Q10, Q12, Q13 and Q20 only. Q8 B is confirmed with its owning unit, and is not written by U6.
- [ ] Transcribe the signed verdicts to `results/v1.3-reference/after-member-facts/adjudication-verdicts.csv` (design §6.2). Its first data row's `verdict_note`, or the run note, says that it is an author-made file, not a run output.

### Step 6: Dry run, then apply
- [ ] Run the external status-quo evaluations of Step 11 first, while the switch block is still at A. Or, after this step, run them in a worktree at the commit before the apply.
- [ ] Run `node --import tsx scripts/v1.3/apply-construct-answers.ts Docs/v1.3/construct-answers.json --dry-run`. Save the printed ADR sign-off lines and action items for Step 8.
- [ ] Run it again without `--dry-run`. This rewrites only the generated block of `src/shared/construct-switches.ts`. Never edit that block by hand.
- [ ] In the same commit, change the guard in `tests/unit/construct-switches/rescore.test.ts` from `isStatusQuo(CONSTRUCT_ANSWERS)` to an assertion that the switch block equals `renderSwitchBlock` of the answers file (freeze-check F2). (Its status-quo byte-identity cases already take `STATUS_QUO_ANSWERS` from Step 1.)
- [ ] Run `npx jest --maxWorkers=2 tests/unit/construct-switches/switch-file.test.ts tests/unit/construct-switches/rescore.test.ts tests/unit/construct-switches/answers-combinations.test.ts`.

### Step 7: A combination test for the chosen set
- [ ] In `tests/unit/construct-switches/interactions.test.ts`, add a case on a hand-built fixture (rows and tiers only; no development-set effect) for exactly the chosen answers. It must assert:
  - the adapter pair moves to FF-S05 (or to FF-S01 under C) and is blocking in hexagonal;
  - the application → adapter FF-S04 row is added and the domain → application FF-S04 row is dropped;
  - the express import becomes FF-S01 and FF-P01 is not applicable in layered;
  - the adjacent upward FF-S03 row is dropped;
  - no switch undoes another.
- [ ] Write the expected rows before running the test.

---

## Part D: ADR text (draft now; sign after the fresh checks)

### Step 8: Draft
- [ ] Create `Docs/v1.3/adr-v13-03-draft.md` from `aidlc-docs/construction/v1.4/U6/functional-design/adr-drafts.md`, keeping only the chosen options. Add:
  - the Step 6 sign-off lines;
  - the G0.9 refutation criteria;
  - the G0.8 choice (with the scoring-deviation entry under (a));
  - the FF-S05 row for `blind-rule-mapping.json` if Q5 is D (`Docs/v1.3/freeze-runbook.md`, step 3);
  - the Q13 action item (the ADR-V13-02 / NestJS preset contradiction).
- [ ] Do **not** sign yet. The design says the fresh checks come before the signature (design §4.1, §9).

---

## Part E: offline preview and fresh checks

### Step 9: Offline preview
- [ ] Before running, copy the expected figures of design §4.5 into the run note's "expected" table, with Q5 D or C and Q10 C or D as chosen.
- [ ] Run `node --import tsx scripts/v1.3/construct-rescore.ts --base results/v1.3-reference/after-member-facts --answers Docs/v1.3/construct-answers.json --graph-cache <scratch>/graphs.json --out <scratch>/preview`.
- [ ] Run `node --import tsx scripts/v1.3/blind-misses-rescore.ts --base results/v1.3-reference/after-member-facts --answers Docs/v1.3/construct-answers.json --verdicts results/v1.3-reference/after-member-facts/adjudication-verdicts.csv --graph-cache <scratch>/graphs.json --json <scratch>/preview/adjudicated.json`.
- [ ] Count any Q6 B FF-S04 rows whose target is a composition layer (design BR-U6-06 note).
- [ ] Compare with the expected table. Any difference is **reported, not fixed**.
- [ ] These are offline figures. Under G0.8 (b), the run note also states that the registered scorers will not show the Q5 D gain, nor the FF-P01 scope change (design §3.3).

### Step 10: MO-H03 and MO-H02 seeds (Q5, Q6)
- [ ] Add an optional `engine` parameter to `cliEvaluate` in `scripts/lib/freeze-gate-main.ts`, defaulting to `neo4j` so every other caller is unchanged. It hard-codes `--engine neo4j` today. Under `cypher-interp`, the child environment has `NEO4J_URI` blank, as in `ue-baseline-live.ts`. Add `--engine` to `scripts/v1.3/operators-hexddd-run.ts`, plus a small argument test.
- [ ] In `operators-hexddd-run.ts:336`, replace `ruleTier` with `constructRuleTier(…, CONSTRUCT_ANSWERS)`. At the status quo the two are equal; add a test that shows this.
- [ ] Add run options, recorded in `run.json` and in the notes:
  - MO-H03's expected key moves from `layer-skip-graph` to FF-S05 under Q5 D (FF-S01 under C);
  - FF-S04 is added to MO-H02's expected keys under Q6 B.
  - The operator catalogue is not edited.
- [ ] Run MO-H03, MO-H03n, MO-H02 and MO-H02n on the reference bases, with the switch file applied and `--engine cypher-interp`, one base at a time. MO-H03 is hexagonal only, so record that ddd has no seeded Q5 check.
- [ ] On the real bases, cloning (`--prepare`) needs the G0.5 approval. If there is no approval, skip and note.
- [ ] List the baseline FF-S03 adapter-pair rows on the unmodified real hex and ddd projects. These are the rows that FF-S05 makes blocking, and they go to a correctness read.
- [ ] Apply the G0.9 criteria as written. Do not reinterpret them.

### Step 11: External layered repositories (Q10, Q12)
- [ ] With the G0.5 approval, clone the 5 layered repositories at the SHAs pinned in `Docs/DiagnosticRuns/v1.3-external-set-3-2026-10-16.md:54-58`, and install with `--ignore-scripts`. Clones go into scratch and are never committed.
- [ ] Run `bin/firewall.ts evaluate --engine cypher-interp --symbolic-only`, one repository at a time: at the status quo (before Step 6, or in a worktree at the pre-apply commit) and with the answers. Count only:
  - the FF-P01 rows removed;
  - the adjacent-upward FF-S03 rows removed;
  - the new FF-S01 package-layer rows, with the file and the package (no source text).
- [ ] Join the counts to the external correctness labels, and apply the G0.9 criteria. Report to the author **before** Q10 is final. If the criteria send Q10 to D, re-apply once (Step 6) and repeat Step 9 once. This is the only result-driven choice the plan allows, and it is pre-declared in the ADR.

### Step 11b: Sign
- [ ] The author signs. Then move the text to `Docs/v1.3/adr-v13.md` §ADR-V13-03 (freeze-check F4).
- [ ] In `src/construct-switches/tiers.ts`, change the override reason strings from "(ADR-V13-03, unsigned)" to "(ADR-V13-03)" for the chosen options, and remove the matching `TODO(ADR-V13-03, Qn)` comments. Today they appear only in `tiers.ts`.
- [ ] Run `npx jest --maxWorkers=2 tests/unit/construct-switches/tiers.test.ts`. Update a test only where it asserts the reason string.

---

## Part F: the one development re-run (freeze runbook step 3, once for the whole cycle)

### Step 12: Hand-over (agent)
- [ ] U6 does **not** start its own development re-run. The re-run is freeze runbook step 3, run once after **every** unit's construct answers are applied, ADR-V13-03 is signed and, under G0.8 (a), the scorer alignment is merged.
- [ ] Hand the orchestrator the inputs for that step:
  - the answers file;
  - the FF-S05 `blind-rule-mapping.json` row if Q5 is D (the runbook copies `after-member-facts/blind-rule-mapping.json`, and `ue-score.ts` stops on an unmapped blind rule name);
  - the verdicts file.

### Step 13: The record run (author, per G0.6)
- [ ] The author runs runbook step 3 on Neo4j 5.26 (the reference engine), into `results/v1.3-reference/after-construct-answers/` (`DEV_RERUN_DIR`). That covers `ue-baseline-live.ts --keep-cli`, `ue-graph.ts` and `ue-score.ts --blind <sealed>`, plus the commit.
- [ ] After that commit, the agent scores the three views with `node --import tsx scripts/v1.3/blind-misses-rescore.ts --base results/v1.3-reference/after-construct-answers --as-run --key-base results/v1.3-reference/after-construct-answers --verdicts results/v1.3-reference/after-member-facts/adjudication-verdicts.csv --graph-cache <scratch>/graphs-after.json --json <scratch>/record.json`. The agent never runs `ue-score.ts --blind`.
- [ ] Engine cross-check, after the record run is committed: run `ue-baseline-live.ts --engine cypher-interp --keep-cli` into `results/v1.3-reference/after-construct-answers-crosscheck-cypher-interp/`, headed "ENGINE CROSS-CHECK (cypher-interp)". `diff -r` its `raw/` against the record run's, then use `scripts/v1.3/cypher-interp-compare-runs.ts`. A difference is a defect recorded in the ADR. The Neo4j figures stand.

### Step 14: Regression checks
- [ ] `npx tsc --noEmit`; `-p tsconfig.scripts.json`.
- [ ] `npx jest --maxWorkers=2 tests/unit/construct-switches tests/unit/scripts/v1.3 tests/unit/apg-extractor/v12e-byte-identity.test.ts tests/unit/fitness-compiler tests/unit/pipeline`.
- [ ] Skip and note any suite that needs Neo4j.
- [ ] Confirm that the v1.2E compile and extraction are byte-identical (the switch is not read under v1.2E).

---

## Part G: report (no figure is changed after this point)

### Step 15: Run note
- [ ] Write `Docs/DiagnosticRuns/v1.4-u6-recall-fixes-<date>.md`. It covers:
  - the answers and verdicts used, and the G0.8 choice;
  - per style, the author, blind and adjudicated views, with Wilson intervals. Give both the offline preview (Step 9) and the registered record-run figures (Step 13), and say which is which;
  - that the adjudicated figure comes from the tool author's own verdicts, so it is a construct-consistency figure, not an independent recall estimate (design §4.5);
  - the fresh-check results against the G0.9 criteria;
  - any differences from the expected table, reported, not fixed;
  - the overfitting statement (design §5);
  - that Q6 B adds no edge;
  - that none of this changes the hold-out procedure, except a G0.8 (a) scoring deviation, which is named;
  - the switch-block hash, so that other units can tell which of their runs came before the apply.
  - Header: "DEVELOPMENT-SET NUMBERS".

### Step 16: Unit summary
- [ ] Write `aidlc-docs/construction/v1.4/U6/code/summary.md`: the files changed, the tests added, the checks run, and the steps skipped with their reasons.
- [ ] Hand the orchestrator two things it logs or applies itself, without editing `ops/` or the audit:
  - the G14 deviation entries (Q5 C or D, Q6 B, Q10 C or D, Q12 B, plus the scoring deviation under G0.8 (a));
  - the C3 status line for `ops/03-build-list.md`.

### Step 17: PR
- [ ] Open one PR targeting `main` from a unit branch. Do not merge it. The author's PR review is the code-approval gate.

---

## Traceability

| Design item | Steps |
|---|---|
| BR-U6-05 (Q5 C or D) | 5, 6, 7, 8, 10, 11b |
| BR-U6-06 (Q6 B, P2 owner) | 5, 6, 7, 8, 9, 10, 11b |
| BR-U6-10 (Q10 C or D) | 5, 6, 7, 8, 11, 11b |
| BR-U6-12 (Q12 B) | 5, 6, 7, 8, 11, 11b |
| BR-U6-C1 and the adjudicated view (design §6.2, §6.3) | 3, 4, 5, 9, 13 |
| Scorer alignment (design §3.3) | G0.8; 8, 9, 15 (not built by U6) |
| Guards (design §5, 1–7) | every step; G0.9, 9, 11, 12, 15 |

## Scope

17 steps, plus 11b. They cover:
- two new library files: the key code moved unchanged, and the verdict filter;
- three test files, plus one interaction case;
- four script options on the re-score (`--verdicts`, `--answers`, `--as-run`, `--key-base`);
- an engine parameter on `cliEvaluate`, and construct-aware tiers in the operator run;
- data files (the answers and the verdicts);
- ADR text;
- the run notes.

There is no new detection logic. The four fixes are already in `src/construct-switches/`. The scorer alignment of G0.8 (a) is scoring code. It is outside this unit unless the author approves it.
