# v1.5 Hexagonal study pre-registration: combined delivery of the admitted Hexagonal families (Claude Sonnet)

**Status: DRAFT, NOT REGISTERED (written 2026-10-30 UTC; revised the same day after an adversarial review).**
Nothing in this file is in force, and no call of this study (pilot or study) runs before registration.

**Order of events (registered as part of this file):**

1. **Registration.** A commit merges this file to `main` once every item of §10 marked *before registration* is
   closed and every slot of §9.1 is filled. It registers the hypothesis, the outcome, the tests, the gates, the r rule
   of §3 and the provisional r = 8.
2. **Agent pilot** (§5.1), run after registration under the registered gates. Its report is published, under
   `Docs/DiagnosticRuns/`, whatever the gates say.
3. **Pre-data addendum.** A dated section (§9.2), written before the first study call: the final r from the §3 rule,
   its achieved power, the gate exits, the dress rehearsal exit (§5.2) and the judge-call cap. It may only fill §9.2's
   slots by the registered rules; any other change is a deviation (§6).
4. **Study**, then scoring once, then analysis once.

This is a separate study, under its own registration. It is not a change to the first v1.5 study
(`Docs/v1.5/final-study-preregistration.md`, "the first study"), whose H2 stands as registered there.

Sources: `Docs/v1.5/final-study-preregistration.md` (§1–§9, DEV-2, DEV-3), `Docs/DiagnosticRuns/v15-final-study-2026-10-29.md`,
`Docs/DiagnosticRuns/v15-hcal03-admission-2026-10-28.md`, `Docs/DiagnosticRuns/v15-hcal04-admission-2026-10-28.md`,
`Docs/DiagnosticRuns/v15-hcal06-admission-2026-10-30.md`, `Docs/DiagnosticRuns/v15-hcal07-admission-2026-10-30.md`,
`Docs/DiagnosticRuns/traprate-01-2026-10-28.md`, `Docs/DiagnosticRuns/v15-pilot-ladder-2026-10-30.md`,
`experiments/hx-rules-v3-dev/README.md` (regression), `experiments/trap-pilot-v2/README.md` (levers),
`src/v15-instrument/rule-set.ts`, `experiments/hcal-07/SEAL.root`. The test, identity rule and reporting rules of the
first study (and through it of `Docs/v1.4/study2b-preregistration.md`) are reused unless stated.

## 0. Why this study exists

The first study's H2 (Hexagonal) is not evidence about delivering the Hexagonal admitted families. As run, the hub's
push and pull checks ran only R-D4, R-XCTX and the layer rules FF-S01 to FF-S03, and 12 of the 16 `none` identities
and all 12 `combined` identities of H2 were R-AXA, which was never delivered (first study, DEV-3). The registration's
pre-run checks never compared the delivered rules with the scored rules. Since then:

- the hub delivers every scored rule, admitted and exploratory (PR 434, merged `9e2f020a1`; `scoredRules` in
  `src/v15-instrument/rule-set.ts`, held by `tests/unit/v15-instrument/delivery-rule-set.test.ts`);
- the hub and the scorers pass the task seed as the baseline (PR 437, merged `4d6b74ef7`; instrument v1.5.3);
- instrument v1.5.5 (`v1.5.5-hx-rules-v3`, PR 446, merged `e10b8916f`) closed the HCAL-06 gaps in R-MIRROR2, R-AXA and
  R-TRANSPORT, and HCAL-07 scored the changed rows blind at it;
- delivered = scored is now **recorded at study time, per hub check**, and checked by the scorer (PR 452; §5.1 (a)).

## 1. Hypothesis

D is a count of new violations, so lower is better.

**Population.** The 13 tasks of §2, from each task's fixed seed, with Claude Sonnet through Claude Code. The tasks were
built and chosen so that the model, alone (arm `none`), falls into their traps (pilot ladder; TRAPRATE-01). The result
speaks to **tasks the `none`-arm model traps on**, not to Hexagonal work at large, and not to tasks where the model
already keeps the vendor out of the core.

| Id | Style | Contrast | Predicted direction | Test |
|---|---|---|---|---|
| **H-HX** | Hexagonal (13 tasks) | `combined` vs `none` | D(combined) **<** D(none) | two-sided (§4) |

- **Supported** only if all hold: (a) the block-level exact two-sided sign-flip gives p ≤ 0.05; (b) the estimate has
  the predicted sign (T < 0); (c) the task-level sign check holds: the exact two-sided sign test over the tasks whose
  sum of differences is nonzero gives p ≤ 0.05, with more negative than positive sums. Its smallest possible p is
  2/2^n, so (c) needs **n ≥ 6** tasks with a nonzero sum (2/2^5 = 0.0625). If (a) and (b) hold and (c) does not, the
  result is reported as "carried by a subset of tasks", with n stated.
- **Joint reading (evasion guard).** A "supported" H-HX is reported as **"supported, qualified: rule findings reduced,
  trap rate not"** unless secondary 1's paired exact sign test on trap failure moves with it: p ≤ 0.05 with more blocks
  losing the trap under `combined` than gaining it. Always reported beside it: the per-block table of (D fell, `combined`
  trap persisted) — D fell and trap persisted / D fell and trap gone / D did not fall and trap persisted / D did not
  fall and trap gone (`jointTable`, `scripts/v1.5/lib/hx-study-analyse.ts`). A cell in "D fell, trap persisted" is a
  candidate for findings hidden rather than fixed, and is hand-read (§4).
- One confirmatory hypothesis, so no multiplicity correction.
- **What H-HX tests.** "Delivering the declared spec's findings of every scored Hexagonal rule to the agent, on request
  (pull) and after every file edit (push), through one delivery hub, reduces new violations of the admitted Hexagonal
  families." As in the first study, the tool, the hooks and one disclosure sentence come together; which channel did
  the work is descriptive (secondary 4).

### Primary outcome: D_hx

> **D_hx** per cell: distinct violation identities of the **counted rules** (below) present at step j (1 ≤ j ≤ 3) and
> absent from the task seed and from every earlier step of that cell, summed over the steps. Identity: rule + file +
> subject, under Study 2b's rename rule (ρ from `git diff -M50%`). The seed is the baseline (instrument v1.5.3). Every
> snapshot is scored (ITT). Scored by `score-study.ts --counted hx-i` (or `hx-ii`, §10 decision box D1)
> `--require-delivery-audit`.

Instrument: `v1.5.5-hx-rules-v3`, with the rules-frozen root of HCAL-07: `experiments/hcal-07/RULES-FROZEN.sha256`,
root `098d67bd4fdc97c5` (45 files: every tracked non-test `.ts` and `.cypher` under `src/v15-instrument` plus
`experiments/cal-01/score.ts`). Checked on `origin/main` `3011ce082`: all 45 files OK. PR 452 changes no file under
the root (its audit wraps the hub's test seams from the driver), so no re-freeze is needed.

**Admitted Hexagonal rows (confirmatory family), by rule ID.** Rule IDs per row from `HEX_ROW_RULES`
(`src/v15-instrument/rule-set.ts`); FF-S03 and FF-P02 are struck out of the count (below).

| Row | Construct | Counted rule IDs | Admission evidence | Failed at / why changed |
|---|---|---|---|---|
| H01 | domain depends outward | FF-S01, FF-S04, FF-P01 | HCAL-03 4/4, 0/6 | never failed; perRow identical at v1.5.5 (hx-rules-v3 regression) |
| H02 | use case imports an adapter | FF-S01, R-INJ *(FF-S03, FF-P02 advisory)* | HCAL-03 4/4, 0/6 | never failed; identical at v1.5.5 |
| H03 | adapter imports another adapter | FF-S01, FF-P03, R-AXA *(FF-S03 advisory)* | **HCAL-07 4/4, 0/6** at v1.5.5 (HCAL-03 4/4, 0/6 at the earlier R-AXA) | **Failed HCAL-06** (FP 1/6: pharmacy-refills H03-twin2, two driven adapters importing `adapters/out/shared`); the first study's f19 R-AXA identities were the same pattern on the driving side (DEV-3.3). **v1.5.5 rewrote R-AXA** (`sideShared`: the shared helper folder of either side is exempt). HCAL-07 is the only blind evidence for the rewritten rule |
| H04 | vendor or handle type in an out-port | R-H5 | HCAL-03 4/4, 0/6 | never failed; identical at v1.5.5 |
| H05 | use case constructs an adapter | R-INJ *(FF-P02 advisory)* | HCAL-03 4/4, 0/6 | never failed; identical at v1.5.5 |
| H07 | transport concepts in the core | FF-P01, FF-S01, R-TRANSPORT | **HCAL-07 3/3, 0/4** at v1.5.5 (HCAL-03 4/4, 0/6 at the earlier R-TRANSPORT) | **Fired on a field name alone**: HCAL-06 customs-brokerage H11-pos1 (`statusCode: string`, an FP outside H07's row) and HCAL-03 solar-coop H07-pos2 line 6. **v1.5.5 rewrote R-TRANSPORT** (HTTP evidence needed; a status-named field alone no longer fires). HCAL-07 is the only blind evidence for the rewritten rule |
| H08 | service locator outside the composition root | R-LOCATOR | HCAL-04 4/4, 0/6 | HCAL-03 3/4 (not admitted there; the helper path, `experiments/hx-rules-v3-dev/README.md` §H08 trace); identical at v1.5.5 |
| H09 | I/O without a port in the core | R-COREIO | HCAL-03 4/4, 0/6 | never failed; identical at v1.5.5 |
| H10 | entity as an inbound adapter's transport shape | R-ENTITY-OUT | HCAL-03 4/4, 0/6 | never failed; identical at v1.5.5 |
| H11-a | vendor literal codes (regression) | R-MIRROR2 `[literal]` | HCAL-07 **2/2, 0/2** | HCAL-05 R-MIRROR 3/4 (plain-string comparisons missed); R-MIRROR2 added v1.5.2 |
| H11-b | vendor error vocabulary | R-MIRROR2 `[error]` | HCAL-07 6/6, 0/4 | HCAL-06 2/4 (class-name copy and key tables missed); v1.5.5 added the `decl` and `key` readings |
| H11-c | field renamed to a vendor field (regression) | R-MIRROR2 `[field]`, **only under option (ii)** (D1) | HCAL-07 **2/2, 0/2** | — |

"Identical at v1.5.5": `experiments/hx-rules-v3-dev/README.md` §Regression scored CAL-03, HCAL-03, HCAL-04 and HCAL-05
at the v1.5.5 branch with zero calls; perRow identical, no clean case changed. **H11-a and H11-c each rest on 2
positives and 2 clean cases** (HCAL-07, regression rows); H11-b on 6 and 4. The sub-shape letters are HCAL-07's
(HCAL-06 worded c and d differently; this registration uses HCAL-07's only).

**Counted rule IDs** (`HX_COUNTED_RULES`, a literal constant in `experiments/v15-study/score-study.ts`, outside the
frozen root; PR 452, pinned by `tests/unit/v15-study/delivery-audit.test.ts`): **FF-P01, FF-P03, FF-S01, FF-S04, R-AXA,
R-COREIO, R-ENTITY-OUT, R-H5, R-INJ, R-LOCATOR, R-TRANSPORT**, plus **R-MIRROR2 by its shape word**
(`HX_MIRROR2_SHAPES`): under option (i) `[literal]` and `[error]` only; under option (ii) every shape. The choice is
the author's (§10, D1).

**Not counted, never in D_hx.**

| Row or sub-shape | Rule IDs | Why | Where it is reported |
|---|---|---|---|
| H11-d, vendor field names in the core | R-MIRROR2 `[field-set]`, `[field-list]` (and `[field]`, `[decl]` under option (i)) | HCAL-07 4/6, bar not met | exploratory, per arm (option (ii) counts them as a registered exception) |
| H11, R-MIRROR | R-MIRROR | no shape word; at HCAL-07 its 3 hits on positives are all d cases (D3) | exploratory, per arm |
| H06, business rule in an adapter | R-ADAPTER-RULE | HCAL-03 0/4, HCAL-04 0/4 | exploratory, per arm |
| H11-SEM, renamed one-to-one vendor value set | R-MIRROR-SEM | registered secondary 8, not counted (option A, **pending author confirmation**) | secondary 8 |

**Advisory, never counted:** FF-S03 (`layer-skip-graph`) and FF-P02 (`port-dependency-inversion`), advisory in the frozen
Hexagonal preset (`Docs/v1.3-hexagonal-notes.md`, rule table). They run, the hub delivers them, and their findings are
reported per arm. The first study counted them; this one does not.

**How non-counted findings are kept out.** D_hx is computed only from hits that `hxCounted(hit, option)` keeps
(`score-study.ts`): a rule ID on `HX_COUNTED_RULES`, or R-MIRROR2 with a counted shape word. The scorer reads the shape
word from the finding's evidence (`mirror2Shape`; the word is the first token, `r-mirror2-vendor-lexicon.cypher` last
line); it is not part of the identity. A zero-call re-run of HCAL-07's 25 H11 positives at v1.5.5 gave: `[literal]`
only on a positives, `[error]` only on b, `[field-set]` and `[field-list]` only on d, and `[field]` on both c
positives and on both declared-field d positives (kennel-boarding and locksmith-dispatch H11-pos3). `[decl]` (a
non-error declaration name) appeared on HCAL-04's two H11-pos2 cases (hx-rules-v3 regression) and has no HCAL-07
sub-shape. So under option (i) no d-shaped finding is counted, and c is not counted either.

### Secondary outcomes (no confirmatory claim)

1. **Trap rate:** share of cells whose final step fails a trap sub-goal of the task oracle, per arm, Wilson intervals;
   paired exact sign test over blocks (it governs the joint reading of §1).
2. **Functional acceptance:** the task tests pass at the final step, per arm.
3. **Repair:** findings pushed or pulled and absent at a later step; edits from finding to fix.
4. **Attribution (combined arm):** for each finding that disappears, the channel that reported it first, from the hub's
   one ledger.
5. **Not-counted and advisory rows:** per-row counts per arm of H11-d, R-MIRROR, H06, FF-S03 and FF-P02.
6. **Cost:** turns, calls (generator and judge), wall time, tool calls and hook events per cell.
7. **Per-shape view of H11:** new identities per arm by R-MIRROR2 shape word.
8. **R-MIRROR-SEM (H11-SEM), registered secondary (option A, pending author confirmation).** D_sem: new R-MIRROR-SEM
   identities against the seed, per cell, defined as D_hx. Same block-level exact sign-flip, reported with its p and no
   decision weight, never added to D_hx. **Both arms are judged the same way at scoring time:** the scorer runs with
   `DAEDALUS_MIRROR_SEM=live` and `DAEDALUS_MIRROR_SEM_CACHE` set to a **fresh, empty** cache directory, so every
   candidate of both arms is asked once by the same judge (`claude-opus-5-5`, Claude CLI route), and the hub's in-session
   answers (which only the `combined` arm has) are not reused. Ledger kept; call cap in §9.2. Under option (i) the two
   renamed-copy tasks (hxpb1, hxpb2: a copy of the vendor's value set, the H11-SEM shape) are measured only here.

## 2. Design

| Item | Value |
|---|---|
| Arms | `none`: the HEXDDD-01 frame and the frozen argv, byte-identical to TRAPRATE-01 and the first study. `combined`: `experiments/v15-delivery/hint-audit/frame-combined.txt` (the first study's frame), the frozen argv plus the edit-gate `--settings` and the MCP config, push and pull through **one DeliveryHub** per session, wrapped by the delivery audit (PR 452). The hub runs every scored Hexagonal rule (`scoredRules('hexagonal')`); its R-MIRROR-SEM judge is live during the session |
| Tasks | 13: `experiments/hx-study-set/` part A (PR 449: hxa1-chimney-sweeps, hxa2-canal-boats, hxa3-balloon-flights: vendor literals, p1 L2 template; hxb1-bakery-flour, hxb2-costume-hire: error codes, p4 L2) and part B (PR 450: hxpb1-pottery-kiln, hxpb2-translation-portal: renamed copy, p3 L3; hxpb3-observatory-evenings, hxpb4-chess-entries: HTTP detail, p6 L2), plus f14-hex-geocoding, f16-hex-fx-rates, f24-hex-laundry-lockers and a fourth f-task (D4: f2-hex-vendor-port recommended; the brief named f13, which is DDD) |
| Seal | the 13 task folders sealed before registration (§9.1) |
| Start state | each task's seed, pinned by tree sha256 |
| Steps | 3 per task (all 9 new tasks' `levels.json`; the f-tasks' `tasks.json`), verbatim, one step per turn, 0 repair turns |
| Replicates | r per task and arm, from §3 |
| Block | task × replicate: one `none` cell and one `combined` cell from the same seed |
| Order | mulberry32 shuffle, seed `20261030`, interleaved by replicate round |
| Generator | `claude-sonnet-5-5`; CLI version read before every turn; a change is a stop |
| Isolation | the first study's (generator uid, root-only clone and records, listing check, fingerprint sweep with a positive control, the one READ probe; the scripted S4 checks). No escape or tamper prompt to any model |
| Driver | `experiments/v15-study/run-study.ts`, sessions run **detached** (`nohup … &`, RUNBOOK §4), because the launching tool ends a command after 2 h (first study, DEV-2.1) |
| Records | every session's step trees kept and committed with the results (first study, DEV-2.2); per-turn and per-call `*.jsonl` committed (needs a `.gitignore` exception; §10 B8); `session.json` carries `deliveryAudit` |

## 3. Sample size

**Definitions.** From TRAPRATE-01: a run **failed a trap** ("trap failed") when an oracle sub-goal fails at its final
step; it was **trapped** when, in addition, all task tests pass. In the model below:

- **p** (per task) = the probability that a cell's final tree **fails a trap sub-goal** (trap failed);
- **q** = the probability that the counted rules flag a cell that failed a trap. Its only agent-data source is
  TRAPRATE-01's share of **trapped** Hexagonal runs flagged by the then-admitted rules, 2 of 5 (a trapped run is a
  trap-failed run whose tests pass, so this is a proxy); q = 1 is the upper bound.

| Figure | Value | Source |
|---|---|---|
| TRAPRATE-01 Hexagonal runs that failed a trap | 8 of 26 (0.31 [0.17, 0.50]) | `Docs/DiagnosticRuns/traprate-01-2026-10-28.md`, Results |
| TRAPRATE-01 tasks that failed a trap | f2, f14, f16, f24 (2/2 each); 9 of 13 never | `results/v1.5-traprate-01/scores/summary.md` |
| TRAPRATE-01 trapped Hexagonal runs flagged by the admitted rules | 2 of 5 (0.40) | TRAPRATE-01, graph-against-imports table |
| TRAPRATE-01 trap failures the then-admitted rules missed | 4 of 8 (f2, f14; vocabulary), all fired by the R-MIRROR development checks | TRAPRATE-01, hand-read section |
| Pilot ladder trap-failed rate, L2 / L3 (6 pilot tasks) | 4/12 = 0.33 / 7/12 = 0.58 | `Docs/DiagnosticRuns/v15-pilot-ladder-2026-10-30.md` §4 |

**Model.** A cell fails a trap with probability p_t; a cell that failed is flagged with probability q; a flagged
`none` cell has one new counted identity; in a `combined` cell each identity is kept with probability RR. 400 planted
data sets per row, the §1 decision rule in full. Code: `plantedHx`, `powerHx` (`scripts/v1.5/lib/hx-study-analyse.ts`);
run `npx tsx scripts/v1.5/hx-study-analyse.ts --power --draws 400 --out results/v1.5-hx-prereg/power` (zero calls).

**The table is illustrative.** It shows the range the design faces before any data on these tasks exist. It does not
fix r: the r rule below does, on the agent pilot's `none` cells, which absorb p, q and identities per cell into one
observed rate of D_hx > 0.

Scenarios: **A** all 13 tasks at p = 0.31 (TRAPRATE-01); **B** 8 tasks at 0.33 (ladder L2), 5 at 0, the floor that
pilot gate (c) admits; **C** 8 tasks at 0.58 (ladder L3), 5 at 0. Turns = 13 × r × 2 × 3.

| Scenario | q | r | Turns | Power RR 0.5 | Power RR 0.25 | Null: false "supported" | Median tasks with nonzero sum (RR 0.25) |
|---|---|---|---|---|---|---|---|
| A | 0.4 | 4 | 312 | 0.05 | 0.17 | 0.000 | 6 |
| A | 0.4 | 6 | 468 | 0.07 | 0.26 | 0.000 | 7 |
| A | 0.4 | 8 | 624 | 0.15 | 0.42 | 0.013 | 8 |
| A | 0.4 | 10 | 780 | 0.16 | 0.56 | 0.000 | 9 |
| A | 1 | 4 | 312 | 0.22 | 0.59 | 0.003 | 10 |
| A | 1 | 6 | 468 | 0.30 | 0.85 | 0.010 | 11 |
| A | 1 | 8 | 624 | 0.42 | 0.92 | 0.007 | 11 |
| A | 1 | 10 | 780 | 0.54 | 0.95 | 0.005 | 12 |
| B | 0.4 | 4 | 312 | 0.01 | 0.03 | 0.005 | 4 |
| B | 0.4 | 6 | 468 | 0.04 | 0.10 | 0.005 | 5 |
| B | 0.4 | 8 | 624 | 0.07 | 0.18 | 0.000 | 5 |
| B | 0.4 | 10 | 780 | 0.06 | 0.23 | 0.003 | 6 |
| B | 1 | 4 | 312 | 0.11 | 0.29 | 0.003 | 6 |
| B | 1 | 6 | 468 | 0.14 | 0.48 | 0.003 | 7 |
| B | 1 | 8 | 624 | 0.15 | 0.56 | 0.000 | 7 |
| B | 1 | 10 | 780 | 0.23 | 0.69 | 0.003 | 7 |
| C | 0.4 | 4 | 312 | 0.04 | 0.14 | 0.010 | 5 |
| C | 0.4 | 6 | 468 | 0.08 | 0.28 | 0.013 | 6 |
| C | 0.4 | 8 | 624 | 0.12 | 0.43 | 0.000 | 7 |
| C | 0.4 | 10 | 780 | 0.14 | 0.54 | 0.003 | 7 |
| C | 1 | 4 | 312 | 0.31 | 0.72 | 0.003 | 7 |
| C | 1 | 6 | 468 | 0.41 | 0.83 | 0.003 | 8 |
| C | 1 | 8 | 624 | 0.53 | 0.92 | 0.005 | 8 |
| C | 1 | 10 | 780 | 0.65 | 0.94 | 0.005 | 8 |

Reading: a strong effect (RR ≈ 0.25) is detectable only if most trap failures are flagged by the counted rules and
more than the 8-task floor fails a trap; a halving (RR 0.5) is out of reach at every r here. With 8 trapping tasks,
condition (c) needs nearly all of them to point the same way.

**Registered r rule** (`sizeFromPilot`, same lib), applied once to the agent pilot's `none` cells: each task's chance of
a `none` cell with D_hx > 0 is the Jeffreys posterior mean (k + 0.5)/(n + 1) of its 2 pilot runs; identities per
flagged cell = the mean D_hx of the pilot's `none` cells with D_hx > 0, rounded, at least 1; q = 1 (detection is
inside D_hx). r is the smallest of {6, 8, 10} with power ≥ 0.80 at RR 0.25 (400 draws); if none reaches it, r = 10
and the achieved power is stated. **Provisional r = 8** (624 study turns) holds until the addendum. The result goes in
the pre-data addendum (§9.2) before the first study call. The pilot is not study data and is never pooled with it.

**No task is dropped** after the pilot on `none`-arm data (as in the first study, §3), except by the one re-levering
round of §5.1.

## 4. Analysis plan

Scoring once, at the frozen root, by `experiments/v15-study/score-study.ts --counted hx-i|hx-ii
--require-delivery-audit` (option per D1; sha256 §9.1). Analysis once, by `scripts/v1.5/hx-study-analyse.ts` with its
lib, tested on planted data before registration (§9.1).

- **No interim look.** No per-arm aggregate (sum, mean, rate, contrast or p) of any outcome is computed before all
  cells are scored. Integrity and record checks that do not compare arms (driver logs, delivery audit, tree hashes) may
  run during the study.
- **Test.** d_b = D_b(combined) − D_b(none); T = Σ d_b; paired two-sided sign-flip, exact p over all 2^N patterns
  (`exactSignFlipP`), Monte Carlo with 99,999 draws, seed `20261030`, beside it. α = 0.05. Exact-p decisions govern.
- **Task level (§1 (c)).** Exact two-sided sign test over the nonzero task sums; n stated.
- **Joint reading (§1).** The qualification rule and the (D fell, trap persisted) table, always printed. Every block in
  "D fell, trap persisted" is hand-read for findings hidden rather than fixed (an evasion candidate, a file or a name
  moved out of a rule's reach), and the count is reported; the hand-reading changes no number.
- **Robustness lines (no decision changes):** exact Wilcoxon signed-rank; exact sign test over blocks; run-order halves;
  drop flagged blocks (integrity or delivery audit); **drop tasks with no oracle trap failure in any cell of either
  arm**. The last replaces the first study's "drop blocks whose `none` cell had no trap", which conditions on one arm's
  outcome. On a planted null (scenario C, r = 8, trap and D perfectly coupled, a worst case) that line reads "supported"
  at p 2.4 × 10⁻⁷ while the primary and the symmetric line read p 0.26; the unit test holds it over 100 null draws. It
  is still printed, labelled biased (note added to the first study's report, PR 453).
- **Effect sizes.** RR = ΣD(combined)/ΣD(none) and d̄, with 95 % within-task and task-cluster bootstrap intervals
  (10,000 resamples, seed `20261030`). Full per-block tables and P(D = 0) per arm with Wilson intervals, always.
- **Reading.** Not rejected means "no difference detected at the stated MDE", never "no effect".

## 5. Gates before the run (pre-written pass criteria)

### 5.1 Agent pilot (after registration)

All 13 sealed tasks × 2 runs × both arms, from the seeds, with the study's driver, frames, hub, audit and isolation;
scored by the study scorer. 13 × 2 × 2 × 3 = 156 turns. Pilot data is not study data. Its report is published whatever
the gates say. Every criterion must pass; a failure is a stop and a report.

| Gate | Pass criterion |
|---|---|
| (a) delivered = scored | **Rule lists:** in every `combined` pilot session, every hub check's record in `session.json` (`deliveryAudit`) ran exactly `cypherRules('hexagonal')` (Cypher check) or `frozenRules('hexagonal')` (frozen check), and every counted rule ID appears in some check of its kind: `auditVerdict` flags 0 sessions. **Findings, symbolic rules only, on the tree the hub last saw:** for every `combined` step snapshot whose tree digest equals a hub check's digest, the hub's Cypher findings and the scorer's, within that check's file scope, are the same `rule|file|line` set (`findingsAgreement`): 0 differences, and at least one comparable snapshot per session that made an edit |
| (b) ledger completeness | Every identity the scorer finds on a `combined` step snapshot is in the hub ledger by the next push (or that turn's stop listing): 0 missing |
| (c) the `none` arm traps | At least 8 of the 13 tasks fail an oracle trap sub-goal in at least 1 of their 2 `none` runs |
| (d) the agent repairs | Of the counted-rule keys first exposed in the `combined` pilot sessions (push or pull), at least half are resolved by the session's end, pooled; fewer than 6 exposed keys fails the gate |
| (e) acceptance holds | Tasks whose final tree passes the task tests in at least 1 of 2 runs: count under `combined` ≥ count under `none` − 1 |

**Known differences between the hub and the scorer, and how each is handled in gate (a):**

- *Evasion files.* The scorer undoes every spec, overlay, allow or settings file the agent created or edited
  (`EVASION_PATTERNS`, `neutralise`) before scoring; the hub does not (it is only blind to `detect02.allow.yaml`, through
  `overlayBlindCheck`). A step snapshot with an evasion candidate is therefore **not comparable** and is left out of
  the findings check; the count of such steps and their paths are reported, and they are hand-read.
- *R-MIRROR-SEM.* Live in the hub (in-session answers), replay or a fresh live cache in the scorer (§1, secondary 8):
  **left out of gate (a)**. It is not counted in D_hx.
- *Frozen rules.* The hub runs the frozen `check_diff` on the changed files against the seed copy; the scorer runs it on
  the whole tree against the frozen spec. Their findings are keyed differently, so gate (a) checks the frozen **rule
  list** only; frozen findings are covered by gate (b) (every scorer identity in the ledger).
- *Cache hits.* The hub runs no check on a tree digest it has already checked; the audit has one record per real check,
  and the findings check matches by digest, so a cached answer is compared through its original record.

**Re-levering, at most one round.** If gate (c) fails, the tasks that never failed a trap may be re-levered **once**
(a stronger lever set, as the pilot ladder did), sealed again, hint-audited again, and the whole pilot repeated once.
The round, its changes and both pilot results are reported. A second failure of any gate is a stop and a report; no
further round.

### 5.2 Dress rehearsal (after the pilot passes)

2 tasks × 1 replicate × 2 arms (12 turns; cap 13 turns, 16 calls, as the first study's Stage 1), run exactly as the
study: driver **detached**, **session trees kept**, **per-turn jsonl committed**. Pass: the driver is started detached by
the RUNBOOK command and survives past 2 h of the launching tool, or the run ends sooner with the driver still
detached; every session folder holds its step trees and they rebuild to the recorded tree hashes; the jsonl files and
`session.json` with `deliveryAudit` are in the results commit (`git ls-files`); the scorer runs on the committed
records alone with `--require-delivery-audit` and flags nothing.

## 6. Exclusions and deviations

- A session is redrawn whole only on an infrastructure state (harness error, envelope unreadable, model mismatch,
  container or coordinator restart, CLI version change, hub socket loss flagged by the integrity monitor). Agent
  behaviour is never grounds for a redraw. Caps are fixed in the input and never raised.
- Integrity: a `combined` session with fail-open above 5 % of edits, or edit count ≠ hook count, **or a delivery-audit
  flag** (a check that ran another rule list, a counted rule never delivered, or no audit), is kept (ITT) and flagged;
  a registered sensitivity drops flagged blocks.
- A block enters the contrast only if both cells have every step scored.
- Every change after registration is dated in this file before the data it would affect is seen. The pre-data
  addendum (§9.2) is not a deviation when it only fills its slots by the registered rules.

*(No deviations: not registered.)*

## 7. Limitations, stated before the run

- One vendor (Claude Code); no placebo arm; seeded start (as the first study, §7).
- Population: tasks the `none`-arm model traps on (§1).
- Small admission sets: H11-a and H11-c rest on 2 positives and 2 clean cases each (HCAL-07); H03 and H07 were rewritten
  in v1.5.5 and HCAL-07 is their only blind evidence at the rewritten rules (4 and 3 positives).
- The rule author curated the task set. Nine tasks are new; f14, f16, f24 and the fourth f-task were run in TRAPRATE-01
  and in the first study's lane B, so their `none` behaviour at the earlier instrument is known. f16 was functional in
  0 of 2 TRAPRATE-01 runs.
- Lever (e) in two tasks (hxpb1, hxpb2) makes the tests assert vendor words (D2).
- R-MIRROR-SEM is a model fact (`claude-opus-5-5`) and shares a vendor with the generator.

## 8. What each result feeds (no dual submission)

| Result | Owner |
|---|---|
| H-HX and secondaries 1–7 | **AgentArch @ ICSA 2027 (proposed, pending author confirmation)**; thesis Kap9, SO5 |
| Secondary 8 (R-MIRROR-SEM) | **AgentArch (proposed, pending author confirmation)**; NEMI is the alternative owner; one paper only |
| TRAPRATE-01, pilot ladder, agent pilot (not this study) | as already owned (TRAPRATE-01: AGENT @ ICSE 2027) |
| First study H1, H2 | unchanged (first study, §8) |

## 9. Slots

### 9.1 Filled before registration

| Item | Value |
|---|---|
| Task seal (13 task folders) | **slot** (after PRs 449 and 450 merge and D2, D4 are settled) |
| Hint audit, step texts (registered run) | **slot**: `node Docs/v1.3/study2-task-design/hint-audit.mjs --preset presets/hexagonal.yaml <13 tasks.json>` on `main` once the tasks are merged. *Preview on the PR 449/450 branch copies and the four f-tasks (f2 as the fourth), 2026-10-30, zero calls: 0 FAIL in 39 units (13 × 3 steps); WARN in 11 units, all "ordinary word that can hint" ("client" 16 hits, "service" 2, "translation" 2)* |
| Hint audit, combined frame at L3 | `hint-audit.mjs --preset presets/hexagonal.yaml --frame experiments/v15-delivery/hint-audit/frame-combined.txt --frame-rung L3`: 0 FAIL in 1 unit (WARN "file" ×2), 2026-10-30; re-run with the registration |
| Steps per task | 3 (all 13) |
| r rule and provisional r | §3; provisional r = 8 |
| Caps, agent pilot | 156 turns, cap 166; calls cap 169 (2 smoke + 1 READ probe, RUNBOOK §2.3) |
| Caps, dress rehearsal | 12 turns, cap 13; calls cap 16 |
| Caps, study (rule) | turns × 1.06, rounded up (infrastructure redraws only); calls = turns cap + 3. At provisional r = 8: 624 turns, cap 662; calls 665 |
| Judge-call cap rule (R-MIRROR-SEM: hub in `combined`; scorer fresh cache, both arms) | 1.5 × the pilot's judge calls per session (hub and scorer counted apart) × study sessions, rounded up |
| CLI version pin | **slot** |
| Script sha256 (first 16 hex) | `scripts/v1.5/hx-study-analyse.ts` b67eb963f7bcc3e7; lib `scripts/v1.5/lib/hx-study-analyse.ts` a8250129c21ad230 (this draft); `score-study.ts`, `run-study.ts`, `lib/delivery-audit.ts`, `make-input.ts`: **slot** (after PR 452 merges and B9) |
| Planted-effect test (zero calls) | effect, scenario C, q = 1, 2 identities per flagged cell, r = 8, RR 0.25: 104 blocks, ΣD 84 → 17, RR 0.20 [0.11, 0.32], exact p 1.35 × 10⁻⁸, task sign 8 − / 0 +: **supported**; joint reading **"supported, qualified: rule findings reduced, trap rate not"** (the planted model thins identities and leaves the trap rate as it is; trap sign 23 − / 15 +, p 0.26), as it should. Null (RR 1): exact p 0.26, task sign 5 − / 2 +: **not rejected**. Records `results/v1.5-hx-prereg/planted-effect/`, `planted-null/`; unit tests `tests/unit/scripts/v1.5/hx-study-analyse.test.ts` (7) |

### 9.2 Pre-data addendum (after the agent pilot, before the first study call; dated)

| Item | Value |
|---|---|
| Agent pilot report | **slot** (published whatever the gates say) |
| Gate exits (a)–(e), re-levering round used or not | **slot** |
| Final r and its achieved power at RR 0.25 (`sizeFromPilot` output) | **slot** |
| Study caps at the final r | **slot** (by the §9.1 rule) |
| Judge-call cap | **slot** (by the §9.1 rule) |
| Dress rehearsal exit (§5.2) | **slot** |

## 10. Open items

### Decision box (for the author; both options with their consequences)

| Id | Decision | Option 1 | Option 2 |
|---|---|---|---|
| **D1** | H11 counting | **(i), recommended by the review:** count R-MIRROR2 only for evidence starting `[literal]` or `[error]` (sub-shapes a and b). No d-shaped finding counts. H11-c is not counted either (its `[field]` word also fires on d). The renamed-copy tasks (hxpb1, hxpb2) are measured only through R-MIRROR-SEM (secondary 8). Implemented as the default (`--counted hx-i`) | **(ii):** count every R-MIRROR2 shape, as a registered exception: 0 FP on the clean cases of HCAL-06 and HCAL-07, but d recall below the bar (HCAL-07 4/6). D_hx then includes H11-c and H11-d findings; the report must state the exception beside every H-HX figure. `--counted hx-ii` |
| **D2** | Lever (e) (tests assert vendor literals) | **Exclude it before the seal**: rewrite the asserted status words of hxpb1-pottery-kiln (`COMPLETE`) and hxpb2-translation-portal (`DELIVERED`, `PROOFREADING`) so none equals a vendor word. Consequence: the two tasks change after their builder's checks; re-verify, re-seal, re-audit | **Keep it and strip the oracle items the tests require**: the oracle no longer fails a tree for writing the asked-for vendor word in the core. Consequence: those trees count as trap-free on that word; the oracle is narrower there, and the change is listed with the seal |
| **D3** | R-MIRROR | **Not counted (recommended)**: no shape word; at HCAL-07 its 3 hits on positives are all d cases | Counted: d-shaped findings enter D_hx through it |
| **D4** | Fourth f-task | **f2-hex-vendor-port (recommended)**: the brief's f13 is `f13-ddd-bike-repairs` (DDD); f2 is the fourth Hexagonal task that failed a trap in TRAPRATE-01 | another Hexagonal f-task, named by the author |
| **D5** | Admissions | Record in the decision register: H11-a, H11-b (and H11-c if D1 = (ii)) admitted on HCAL-07; H03 and H07 re-admitted at v1.5.5 (`ADMITTED_HEX_ROWS` is unchanged; this study counts through `HX_COUNTED_RULES`, so the code list does not need to change) | — |
| **D6** | R-MIRROR-SEM role and paper | Option A: registered secondary, not counted; owner AgentArch | NEMI as owner of secondary 8 |

Lever (e) was checked on all 9 new tasks (`levels.json`, branches of PRs 449 and 450): only **hxpb1-pottery-kiln** and
**hxpb2-translation-portal** use it (p3 L3 lever set: a–f). The other seven use levers a and b only (p1 L2, p4 L2,
p6 L2).

### Blocking items

| Id | Item | Closes it | When |
|---|---|---|---|
| **B1** | H11 sub-shapes in scoring | **Mechanism in PR 452** (`mirror2Shape`, `hxCounted`, both options); D1 picks one | before registration (D1) |
| **B2** | Counted list | **PR 452** (`HX_COUNTED_RULES` in `score-study.ts`, outside the root, pinned by a test) | merged on green |
| **B5** | `experiments/hx-study-set/` not on `main` | PRs 449, 450; then seal and the registered hint audit | before registration |
| **B6** | D_sem scoring | fresh cache, both arms (§1, secondary 8); cap rule in §9.1, value in §9.2 | rule: done in this draft |
| **B7** | Delivered = scored at study time | **PR 452** (audit records in `session.json`, scorer flag, findings check) | merged on green |
| **B8** | Records | a `.gitignore` exception for this study's results (`*.jsonl` is ignored, line 60) and a RUNBOOK change that keeps trees (§2.6 copies "no trees") | before the pilot |
| **B9** | Scorer task root | `score-study.ts` reads tasks from `experiments/trap-families` only (`FAM`); the nine new tasks live under `experiments/hx-study-set/part-*` | before the pilot |
| **B10** | Gate (b) check | no script yet compares scorer identities with the hub ledger per push; write it (zero calls) with a unit test | before the pilot |

Pending author confirmation besides D1–D6: provisional r = 8 (§3).

## Changelog

- 2026-10-30: revised after an adversarial review: order of events (register, pilot, pre-data addendum); delivered =
  scored per hub check (PR 452); joint reading and (D fell, trap persisted) table; population limit; admission table
  with failure history; p and q defined, power table illustrative; D_sem on a fresh cache for both arms; no interim
  look; one re-levering round; hint audit preview; lever (e) checked; decision box. Not registered.
- 2026-10-30: draft written; not registered. Analysis script adapted and tested on planted data, zero model calls.
