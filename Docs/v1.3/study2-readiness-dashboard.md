# Study 2 readiness dashboard: can we run Study 2?

**Answer at 2026-10-16T12:00Z: NO.** Of the 42 gate lines, 1 is GREEN, 11 are AMBER and 30 are RED. Of the 12 other readiness items, 0 are GREEN. The dress rehearsal has not run, and it cannot start until most of the REDs below are closed.

**Update 2026-10-16 (after 13:50 UTC).** The author delegated AD1 and AD5 and the protocol questions behind them. They are recorded as a declared deviation in `Docs/v1.3/study2-deviation-2026-10-16.md`, and the rows below that depend on them are amended (AD1, AD5; §1 steps 2–4, 8 and 10; D1, D3, D10, D11, R-01–R-03). The protocol: primary outcome Y (distinct blocking edges at step k = 4), arms `none` and `daedalus-mcp`, generators Sonnet 5.5 and the Codex pin, no new waivers, and **Study 2 does not run** if no stratum passes the validation pilot. The 12:00Z counts above are not re-taken.

<!-- study2-protocol: primary=Y-distinct-blocking-edges-at-step-k; k=4; arms=none,daedalus-mcp; unit=distinct-edge; fallback=do-not-run; order=freeze,hold-out,dress-rehearsal,pre-registration,gate,run; generators=claude-sonnet-5-5,codex-pin -->

**Evidence base.**
- Statuses were taken on `origin/v1.3` at `890a570c`, after merge train MT5 (11:20 to 11:48 UTC).
- `Docs/v1.3/merge-train-mt5.md` does not exist. The MT5 contents were read from the GitHub PR list. Merged: #226, #218, #130, #230, #136, #146, #147, #187, #192, #194, #195, #227, #201, #169, #172, #177, #178, #149, #190, #154, #131, #155, #160 (and #219 at 11:04).
- MT5 kept merging after the snapshot: #162, #165, #168, #175 and #179 landed by 12:00 (tip `a9773a46`). Only #175 moves a line (V11, still AMBER). 47 PRs into `v1.3` are still open.
- Commands re-run for this dashboard at `890a570c` (cloud container, no model, no Neo4j):
  - `sha256sum` of the two sealed docs: both match;
  - `npx jest tests/unit/scripts/loop`: 4 suites, 53 tests, all passed;
  - the pilot plan dry run: exit 0;
  - `grep '[Answer]: [A-Z]'` on the construct sheet and on the triage sheet: 0 answered.
- Every other status is read from the cited file. No sealed directory, `.env` or secret was read.

**This is a dashboard, not the gate.** The binding rules are in `Docs/v1.3/study2-readiness-gate.md` §0:
- criteria are fixed and may only be tightened;
- a line is green only when it is re-verified at the run commit;
- only lines marked [W] may be waived, by a dated author note;
- the author alone signs the go.

This file never declares a go. It is not a pre-registration.

**Legend.**
- **GREEN**: the line's pass criterion holds on `v1.3` now. It still has to be re-verified at the run commit.
- **AMBER**: partly met, met only on an open PR, or met but not yet exercised live. It is not green.
- **RED**: unmet, or blocked on a decision.
- **Merged?** says whether the evidence is on `v1.3` (**v1.3**), only on an open PR (**open #n**), or does not exist (**none**).
- **Owner**: **agent** is a cloud routine with no logins, keys or sealed material. **author** covers decisions, local runs that need logins, Neo4j at home, or the sealed list, and the go.

**ID namespaces.** The same letters mean different things in different documents. This dashboard uses:
- **V1–V11, S1–S15, D1–D16**: the 42 lines of the readiness gate (#146, merged).
- **F1–F14**: the freeze-check preconditions of the freeze runbook (#164, open).
- **Pilot T1**: the DDD freezer defect found by the loop pilot (#170). It is not backlog job T1.
- **Backlog job IDs** in `night-backlog-2026-10-16.md` reuse the letters. Job S1 is the fault drills (#180), S2 the pins and isolation (#171), S3 the MCP call log (#196), S4 the stub replay (#206). D1 is the snapshot measures (#197) and D2 the acceptance runner (#200). T1 is the tunables manifest (#173), T2 the unsealer (#174), G1 the held-out-rule mechanism (#210). They are mapped to gate lines in §4.
- **G1–G8**: the distinction-readiness goals (`Docs/v1.3/research/distinction-readiness.md:433-561`).
- **R-xx**: the readiness items outside the 42 lines (§3).

---

## 1. Critical path to the single run (blocking REDs, in order)

Each step needs the one before it, except where a step says it can run in parallel. The order follows gate rule 5: pilot, then freeze and hold-out, then dress rehearsal, then pre-registration, then gate, then Study 2.

| # | Blocking RED | Why it blocks | Next action | Owner |
|---|---|---|---|---|
| 1 | **Author decisions AD1–AD8 (§2)** | Every later step depends on at least one of them. Two of them (V5, V10(a)) concern gate lines that have no waiver. | Answer §2 | author |
| 2 | **R-02 Pilot T1 / D15, the DDD construct** (#170 hold) | Both DDD pilot runs are unscored: `BR-SPEC-10 FF-DT01/FF-DT02: aggregates` on all 8 snapshots. Floor probe 3 hit the same defect on its DDD task (#227, merged). | After AD2: fix the freezer on the development set; re-freeze from the **same** recorded step-1 commits; score the 8 kept snapshots; no model call | agent fix; scoring by agent if Neo4j runs in the cloud, else author |
| 3 | **R-01 Pilot memo §5 branch recorded (gate D1)** | The offline re-score on #229 gives the **zero branch** under every T1 option that scores the DDD snapshots (recorded in the deviation record §4). It is final after step 2's fix and a Neo4j re-score on `v1.3`. The primary outcome is Y by the deviation, so the branch now decides only what is reported as a secondary. | Re-score on `v1.3` after step 2; confirm or re-record the branch by a dated note. | agent (mechanical) + author (sign) |
| 4 | **R-03 SO5 floor effect** | No greenfield agent measurement has escaped the floor in Clean or Hexagonal. Loop pilot: 0/8 scored steps. Floor probe 3: 0/8, even with tasks designed to escape it. Probe 2: 1/24. Precedent probe: 0/8 vs 0/8. Under the zero branch, power is ≤ 0.08. | AD1 answered: the deviation record is written. Next: repair the layered preset (§3.6), then run the validation pilot (§4: Layered and DDD base rates, k = 4 fixture variants) under its pre-committed go/no-go rule. If neither style passes, **Study 2 does not run** (G4; the honest-null route). | agent (amendment draft, preset ADR, frame code) + author (approve, run pilot) |
| 5 | **V1 / R-04 Construct sheet and freeze (F1–F14)** | 0/25 answered. The freeze dry run found 9 of 14 checks unmet (#164, open). Can run in parallel with steps 2–4. | AD3, then ADR-V13-03, the development-set re-score, and merge #164 | author (answers) → agent (ADR, #164) → author (freeze) |
| 6 | **V3 → V4 Sealed hold-out once** | The only source of validity figures. V4 has no waiver. With fewer than about 35 expected blocking findings per style, its lower-bound check cannot pass. | Run it once at freeze commit X, with Neo4j as the engine of record | author |
| 7 | **V5 + V6 Independent rater, one κ** | V5 has no waiver, and it conflicts with the constraint "validity rests on non-human evidence". There are three κ definitions. | AD4. Then write one κ definition, dated before any label. | author (AD4) → agent (κ text) |
| 8 | **V10(a) Non-Claude generator** | No waiver for (a). The Codex pin is unavailable until about 2026-11-09. There is no Gemini loop adapter. | AD5 answered B: Sonnet 5.5 plus the Codex pin; the run waits for the pin and its S4 probe | author |
| 9 | **Instrument and harness lines** (S2, S3, S4, S10, S11, V9, D6, D12, D13, D16, R-06 #143) | The rehearsal's entry conditions (`study2-dress-rehearsal.md` §1.2) require all of them | AD7 and AD8, then merge the PRs listed per line in §3. S4 needs a local confinement probe with the MCP server attached. | agent (merges, fixes) + author (S4 probe, local) |
| 10 | **D3 Power** | The level simulation (#234) powers H1–H3 at RR 0.25 only, at 24 blocks (4 tasks × 3 replicates × 2 generators). | Re-run it with the validation pilot's mean and θ per stratum; demote any contrast below 0.80 to secondary before D10 (deviation record §5) | agent |
| 11 | **R-07 Dress rehearsal** | Turns about 18 lines green (rehearsal §7). It must run at the candidate run commit. Any later frozen-code change re-reddens those lines. | Run once all entry conditions hold | author (local, real agents) |
| 12 | **D10 / S10 / S11 Pre-registration** | None exists, by the author's decision | Draft it, hash it, and put the CI check on the Study 2 base | agent draft + author sign |
| 13 | **Gate re-verify and go** | Rule 3: green only at the run commit | Write `results/v1.3-study2-gate/<id>.txt` for every line. The author signs. | author |

**Shortest honest reading.** Steps 2 and 3 cost no model call and can be finished in half a day after AD2. Step 4 decides whether Study 2 has a measurable primary outcome at all. Steps 6–8 cannot be shortened by any cloud job.

---

## 2. Author decisions (answer A, B or C after `[Answer]:`)

These eight questions take the blocking items from `Docs/v1.3/floor-escape-design-2026-10-16.md` §6 (FE-n), `Docs/v1.3/hold-queue-triage-2026-10-16.md` §2 (HQ-Qn) and `Docs/v1.3/gap-closing-plan.md` §3 (GP-n). An answer here also answers the cited items, and the agent copies it into those sheets. The recommendations are those of the source documents unless stated otherwise.

**AD1. Primary outcome and governance order (FE-1; gate D1; R-01, R-03).**
A) Keep the memo §5 slope outcome and run Study 2 on whichever branch the DDD score gives.
B) Score the 8 kept DDD pilot snapshots after AD2, record the §5 branch, then issue a dated amendment to a level outcome at horizon k (spec-rung × arm factorial, floor-escape §3). The slope stays a registered secondary, and the validation pilot (floor-escape §4) runs before any confirmatory task is written.
C) Issue the amendment now, without scoring the DDD snapshots.
Rec: **B**. It costs no model call and keeps the pre-committed rule intact. C invites the objection that "the rule was abandoned before its result was read".
Caveat (gate rule 1): B is a change after pilot data. It cannot use rule 1's "addendum written before the data" exception, so it must be declared as a deviation.
[Answer]: B, as a formally declared, dated deviation (author, 2026-10-16 13:50 UTC; `Docs/v1.3/study2-deviation-2026-10-16.md`). The DDD snapshots were scored first (#229, zero branch).

**AD2. Pilot T1 and the DDD construct (FE-2, HQ-Q5, GP-4; gate D15, S7).**
A) Fix the freezer on the development set so that an empty aggregate list is a recorded N/A for FF-DT01/02. Re-freeze the pilot's DDD runs from the same step-1 commits and score them. For Study 2, DDD uses a static spec with aggregates the author declares per task, hint-audited and usable at L4 and by the MCP server.
B) The same re-score, but Study 2 keeps ISE-from-step-1 freezing. DDD is then excluded from the L4 and `daedalus-mcp` cells and cannot be a confirmatory stratum.
C) Revise the memo so the pilot stands on two tasks, and drop DDD from Study 2.
Rec: **A**.
[Answer]:

**AD3. Construct sheet, Q1–Q25 (GP-1; gate V1; F1–F4).**
A) Answer all 25 by hand.
B) Answer the 7 high-stakes questions by hand (Q3, Q5, Q10, Q2, Q8+Q14, Q6, Q13) and accept the listed safe defaults for the rest.
C) Defer. This blocks the freeze, the hold-out and Study 2.
Rec: **B**.
[Answer]:

**AD4. Independent human rater (gate V5 and V8 adjudication, no waiver) versus "validity rests on non-human evidence" (GP-3).**
A) Recruit one paid independent TypeScript developer who meets protocol §5, and keep V5 as written.
B) Write a dated addendum, before the freeze, that replaces V5's rater with mechanical oracles for M7 (`tsc`, dependency-cruiser) and the multi-vendor model panel for "meaningful". This relaxes a criterion. Gate rule 1 allows that only by a dated addendum written before the data, and examiners may call it a deviation.
C) Both: B now, plus a paid rater on a 30-item subset if the budget allows.
Rec: **C**. The panel run in B and C needs a new Gemini key (night-plan decision 7).
[Answer]:

**AD5. Same-vendor threat, gate V10(a), no waiver (FE-3).**
A) *(Removed 2026-10-16: Sonnet 5.5 only needs a V10(a) waiver, and V10(a) has none. Not an available option.)*
B) Sonnet 5.5 plus the registered Codex pin, scheduling the run after Codex credits return (about 2026-11-09).
C) Build a Gemini loop adapter and confinement-probe it. This is new code and a new S4 probe.
Rec: **B**. The build, pilot and gate path lands near that date anyway.
[Answer]: B (author, 2026-10-16). No waiver: if the Codex pin is unavailable or fails S4 at the run commit, Study 2 does not start.

**AD6. SO3 judge in Study 2 (gate V7 [W]; GP-2; HQ-Q9).**
A) v1 stays the frozen judge as a secondary outcome. The #191 NOT CANDIDATE result counts as the decisive CHECK-2 run: merge #141, then #191, both opt-in. SO3 is reported as below target (0.76 < 0.80) and complementary to the symbolic arm.
B) Drop the judge from Study 2 entirely, closing V7 by a written [W] waiver.
C) Build v2.3 with a CHECK-3 split.
Rec: **A**. C spends a third split and invites a forking-paths critique.
[Answer]:

**AD7. #143 `hints` on the default MCP tools, already on `v1.3` (HQ-Q1; R-06).**
A) Keep both the parameter and the FROZEN-schema field as a reviewed amendment.
B) Gate the parameter behind `--hints` / `DAEDALUS_HINTS=1` and keep the optional schema field.
C) Revert #143.
Rec: **B**. An agent-settable parameter on the default tool surface is a contamination risk for the Study 2 arms.
[Answer]:

**AD8. The pre-freeze instrument bundle (HQ-Q2, Q3, Q4, Q8, Q10, Q11, Q12; GP-8).**
A) Take the triage sheet's recommendations as a block:
  - Q2 A: the `advisoryFilter` amendment, with no filter on by default;
  - Q3 A: the #159 defect fixes before the freeze;
  - Q4 A: the 30 s interpreter timeout, merging #151 before #159;
  - Q8 A: the #180 and #206 harness bug fixes;
  - Q10 A: the #164 edits to the prespec draft;
  - Q11: B for #174, A for #204 and #171;
  - Q12 A: #188 defaulting to the Neo4j engine, with the memory guard opt-in;
  - APG v2 and type flow OFF at the freeze.
B) Answer each question separately in the triage sheet.
C) Freeze the instrument as it is now and park every pending default change until after Study 2.
Rec: **A**. It releases the harness PRs that the rehearsal's entry list needs. C leaves known defects in the frozen instrument (the #159 and #180 classes).
[Answer]:

Not asked here, because they do not block the run:
- HQ-Q6 (#133 family order), HQ-Q7 (sealed-list domain check for #189 and #201);
- FE-4 (ORM lever), FE-5 (brownfield sub-study);
- GP-10 (publication).

---

## 3. Every gate and readiness item

### 3.1 V: validity prerequisites

| Id | Requires | Evidence | Status | Merged? | Next action (owner) |
|---|---|---|---|---|---|
| V1 | Q1–Q25 answered by the author, applied through `construct-switches`, ADR-V13-03 merged before freeze commit X | `Docs/v1.3/construct-decisions.md`; `construct-decisions-answer-sheet.md` (#129); F1–F4 (#164) | **RED**: 0/25 `[Answer]:` lines filled; no `construct-answers.json` | v1.3 (sheet); open #164 (checker) | AD3 (author) → ADR-V13-03 and switches (agent) |
| V2 | `rule-tiers.md` and `style-rule-sources.md` at their sealed hashes | `Docs/v1.3/sealed-hashes.md:8-9` | **GREEN**: `290794e0…f27a` and `7ce49c63…5c28` re-checked at `890a570c` | v1.3 | Re-verify at the run commit (agent) |
| V3 | Prespec frozen; hold-out run once at X; outputs committed before any label | `Docs/v1.3/holdout-prespec.md`; runbook steps 5–9 (#164) | **RED**: prespec "Status: draft, to be frozen"; no `results/v1.3-holdout` | v1.3 (prespec); open #164 | After step 5 of §1: freeze, then run (author) |
| V4 | FR-V11 report; M1, M3 ≥ 0.90 and M7 ≥ 0.95 for every Study 2 style; no waiver | `holdout-prespec.md:59-81` | **RED**: needs V3, V5 and V8. With n < 35 per style the lower bound cannot pass (`:73`). | none | Fill `<N_PER_STYLE>` at the freeze; report as it comes (author) |
| V5 | Independent second rater (not the author, not the director) has labelled the hold-out; no waiver | `Docs/v1.3/human-labelling-protocol.md:44,52` | **RED**: no rater named; "nothing labelled yet" | v1.3 (protocol) | AD4 (author) |
| V6 | One κ definition, dated before any label | `validation-protocol.md:32`, `labelling.md:142`, `human-labelling-protocol.md:61` | **RED**: still three definitions | v1.3 | After AD4, write the definition into the prespec and point all three docs to it (agent) |
| V7 [W] | CHECK-2 decision committed; Study 2 judge version, pin, model and effort frozen; judge secondary | #141 (prep), #191 (run: v2.2 NOT CANDIDATE, D1 fails 7/21 vs ≤ 1) | **RED**: no `results/v1.3-judge-v22` on `v1.3` | open #141, #191 | AD6 (author) → merge #141, then #191 (agent) |
| V8 | Per-snapshot coverage ≥ 0.95 for the view of record, pooled ≥ 0.98; import-kind counts per step; adjudication complete | #149 (default views 1.000/1.000 vs tsc on 15 repos), #131 (adjudication prep: 2,135 rows, `human_verdict` empty) | **RED**: no fidelity run on any loop snapshot; adjudication empty | v1.3 (#149, #131) | Rehearsal stage V8 (author); adjudication oracle per AD4 |
| V9 | `check_file` / `check_diff` agree 100 % with the full evaluation on blocking findings, per Study 2 style | `Docs/v1.3/loop-replay.md:135-139` (gap); #176 (interp parity, hexagonal and DDD) | **RED**: the hexagonal and DDD rules are still missing from the MCP tools on `v1.3` | open #176 | Fix #176's 6 vs 7 row count, merge, run `mcp-consistency.ts` (agent) |
| V10 [W for (b)] | (a) a non-Claude generator passes S4; (b) the external set labelled as its own arm; (c) the task writer does not run or score | #133 (external set), #204 (non-Claude manifest harness, no run) | **RED**: (a) has no adapter until Codex returns (about 11-09); (b) unlabelled; (c) no role matrix | open #133, #204 | AD5 (author); role matrix in the go commit (agent draft) |
| V11 | Zero answer-bearing terms in every model- or rater-facing input; unsealer signs "clean" | #175 (leakage census, scrubbed copy); #174 (unsealer) | **AMBER**: the census and scrubbed-copy generator are on `v1.3` (#175, merged after MT5); the sealed tasks are not checkable from the repo | v1.3 (#175); open #174 | Run the scrubbed copy on rehearsal inputs (agent); unsealer scan (author) |

### 3.2 S: Study 1 incident controls

| Id | Requires | Evidence | Status | Merged? | Next action (owner) |
|---|---|---|---|---|---|
| S1 | Usage limit at every call site classified, paused and resumed; pause duration recorded | `scripts/lib/generators/retry.ts`; #180 fault drills (11/13 resume byte-identical) | **RED**: pause duration is not in the turn record; never exercised with a real CLI | v1.3 (classifier); open #180 | AD8 → fix #180 R1–R4 to 13/13 and add the pause field (agent); rehearsal drill 4.3 (author) |
| S2 | Claude and Codex CLI versions pinned and refused on mismatch; auto-update off | `scripts/lib/loop/agents.ts:206-209` (Claude: `--version` answers, no pin) | **RED**: Claude CLI unpinned in the loop | open #171 | AD8 → merge #171 (agent); verify auto-update off on the run machine (author) |
| S3 | Dedicated config dir and HOME, env allow-list, canary probe | #171 | **RED**: the Claude path is unchanged since TV-95 | open #171 | Settle the Linux `.credentials.json` allow-list, merge (agent) |
| S4 | Confinement probes pass per CLI × arm with `daedalus-mcp` attached | `Docs/v1.3/mcp-smoke.md:40` ("cannot be done in the cloud") | **RED**: never run | none | Run the probes locally per arm (author) |
| S5 | Decision on a no-layout-hint arm | Probe 2 (#182): C2 0/8, below the pre-stated ≥ 3/8 | **RED**: no written decision | open #182 | Dated note: keep the layout frame, record "no-spec" as not tested (GP-6 rec; author signs) |
| S6 | `advisoryByRule` on every step record; FF-CV05 excluded from the advisory outcome | #142 adds `advisoryByRule` (`scripts/lib/loop/evaluator.ts`) | **AMBER**: on `v1.3`, but not yet checked on live step records | v1.3 | Rehearsal check `jq …advisoryByRule` (author) |
| S7 | 0 `evaluationError` on real-agent snapshots, except a decided DDD freeze failure | Pilot (#170) and probe 3 (#227): Clean and Hexagonal score; DDD fails BR-SPEC-10 on every snapshot | **RED**: live DDD snapshots fail; D15 undecided | v1.3 (#142 tsconfig fix, #227); open #170 | Step 2 of §1 (agent) |
| S8 | Every Study 2 model completes a full rehearsal run; type-check failure rate known | Pilot: Sonnet 5.5 only | **RED**: model list not fixed (AD5); other tiers never live | open #170 | AD5 → rehearsal (author) |
| S9 [W] | One harness root per lane, or strictly sequential | Floor-escape §3.7: "one lane the machine allows" | **AMBER**: one lane is planned but not committed in writing | v1.3 | Dated [W] note "one sequential lane" (author) |
| S10 | CI runs `--check-prereg` for PRs into the Study 2 base | `.github/workflows/ci.yml:127` (`base_ref == 'v1.2e'` only) | **RED** | v1.3 | Add the Study 2 base to the condition, plus a broken-artefact test PR (agent) |
| S11 | Every frozen tunable hashed in the pre-registration; `planCallBudget` matches | #173 (tunables manifest, verifier; backlog job T1) | **RED**: no manifest on `v1.3`; pilot memo §7 placeholders on `v1.3` | open #173 | Merge #173 (agent); final table at pre-registration (agent + author) |
| S12 | Out-roots archived, hashed, path-free; secret scan passes | — | **RED**: no archive step is defined for the loop | none | Add an archive and path-scrub step to the harness (agent) |
| S13 | Every sealing, registration and go decision carries the author's own dated words | `holdout-prespec.md:23`, `sealed-hashes.md:30,32` | **RED**: the hold-out enlargement already fails this and must be declared | v1.3 | Dated declaration of the hold-out history; each later artefact gets an author entry (author) |
| S14 | Sealed list hash `82a2f512…169c` verified by the unsealer; tasks outside the repo and every agent cwd | `sealed-hashes.md:7`; #174 (unsealer, backlog job T2) | **AMBER**: hash recorded; check is author-only; #174 open. Floor-escape §3.1 proposes retiring this list unread (see AD1). | v1.3 (hash); open #174 | AD8 → merge #174 with `--i-am-the-author` (agent); run it (author) |
| S15 | Any model labeller or judge route: tools off, quota confirmed | Memo §3: primary labelling is the deterministic `check-correct.ts` | **AMBER**: passes if no model labeller is used; the panel (AD4) would need a probe and a quota statement | v1.3 | Tools-off probe and quota per panel route, if AD4 is B or C (author) |

### 3.3 D: Study 2 design requirements

| Id | Requires | Evidence | Status | Merged? | Next action (owner) |
|---|---|---|---|---|---|
| D1 | Pilot complete; §5 decision recorded; restated 2026-10-16: validation pilot run, ≥ 1 confirmatory stratum passes, Y mean and θ per stratum reported | #170 (pilot); #229 (DDD offline re-score: zero branch) | **RED**: branch zero on #229, not yet on `v1.3`; validation pilot not run | open #170, #229 | §1 steps 2–4 (agent + author) |
| D2 | No banned term in any task step; frames identical across arms | `Docs/v1.3/study2-task-design/hint-audit.mjs` and the design guide (#201, merged); frames unit-tested | **AMBER**: procedure on `v1.3`; sealed tasks not audited (unsealer) | v1.3 (#201) | Unsealer audit (author) |
| D3 | Power ≥ 0.80 per confirmatory contrast at the registered N; budget ≥ 1.1 × N | `Docs/v1.3/level-power-sim-2026-10-16.md` (#234): at 24 blocks, H1/H2/H3 1.00/1.00/0.92 at RR 0.25, 0.88/0.88/0.70 at RR 0.5 (Layered as measured) | **RED**: no pilot dispersion for the confirmatory strata | v1.3 | Re-run with validation-pilot mean and θ; demote contrasts below 0.80 before D10 (agent) |
| D4 | Measured cost per turn; projected total ≤ budget with 20 % margin; stop rule | Pilot 6.34 USD for 24 turns; probe 3 3.16 USD for 12 turns; forecaster #205 | **AMBER**: cost measured on Sonnet only; no approved budget; no stop rule | v1.3 (#227); open #170, #205 | Merge #205 (agent); approve budget and stop rule (author) |
| D5 | MCP p95 ≤ 1 s per call; tool time ≤ 5 % of step wall time, live | `Docs/v1.3/mcp-v2.md:183-199` (bench p95 15.7 / 45.2 ms) | **AMBER**: bench green; no live MCP loop run | v1.3 | Rehearsal (author) |
| D6 | Telemetry completeness checker exits 0; MCP call log outside the cwd | #196 (call log, per-step metrics; triage FIX-FIRST) | **RED**: no checker; no call log on `v1.3` | open #196 | Fix #196's named defect, merge; write the D6 checker (agent) |
| D7 | Pins in provenance; byte-identical re-score; replay passes | Replay #142 (merged); Neo4j version independence #207 (73/73) | **RED**: Claude CLI unpinned (S2) | v1.3 (#142); open #207 | Merge #207 and #171 (agent) |
| D8 | Neo4j 5.26.24 (pinned digest) is the engine of record; interpreter parity on rehearsal snapshots if it is used | `scripts/lib/loop/evaluator.ts:6` (scratch Neo4j); `src/cli/engine-default.ts` (the CLI falls back to `cypher-interp` when `NEO4J_URI` is unset); #199 (engine tee) | **AMBER**: the loop uses Neo4j, but the CLI default is now the interpreter, so every Study 2 script must pass `--engine neo4j` | v1.3; open #199 | Merge #199; assert the engine in step provenance (agent) |
| D9 | One script produces every final table from an out-root; planted effect recovered; script hash frozen | `Docs/v1.3/study2-analysis-rehearsal.md` (#160, merged 11:48): 30/30 assertions on synthetic telemetry | **AMBER**: synthetic data only; determinism pack #203 FIX-FIRST (mislabelled Holm column) | v1.3 (#160); open #203 | Fix #203 (agent); run on rehearsal data (author) |
| D10 | Pre-registration complete (hypotheses, outcome Y per the deviation record, memo §5 outcomes as secondaries, arms, tasks by hash, pins, N, analysis, stop rule, tunables, go commit) | `Docs/v1.3/study2-outline-v2.md` (#194): "NOT A PRE-REGISTRATION"; `study2-deviation-2026-10-16.md` | **RED**: none exists, by the author's decision | v1.3 (outline) | Draft after the rehearsal (agent); sign (author) |
| D11 | Arm set decided: placebo, gate under the advisory branch, per-task MCP spec, S5 | Deviation record §2: arms `none` and `daedalus-mcp`; `gate` and the placebo dropped; attention sentence in every arm | **RED**: (a) and (b) decided 2026-10-16; (c) `taskProfiles` plans refuse a per-task MCP spec (`loop-pilot-readiness.md:73`); (d) S5 open | v1.3 (decision) | `plan.ts` change (agent); S5 (author) |
| D12 [W] | Sealed per-step acceptance checks run on every snapshot | #200 (acceptance runner) | **RED**: no runner on `v1.3`; the start convention is undecided | open #200 | Merge #200 and decide the start convention, or a [W] note (author) |
| D13 | Layer-coverage share, skeleton integrity, LOC, and `import()` / `require()` / barrel counts per step | #197 (snapshot measures, gaming guards) | **RED**: the import-kind counts are not in the `v1.3` step record | open #197 | Merge #197 (agent) |
| D14 | Loop unit tests, dry run, live kill-and-resume | Re-run at `890a570c`: jest loop 53/53; dry run exit 0. #180: resume 11/13. | **AMBER**: 2 of 3 parts green; live resume never exercised | v1.3; open #180 | Fix #180 to 13/13 (agent); live resume in the rehearsal (author) |
| D15 | Written decision for a DDD tree with no inferable aggregates | Pilot T1 (#170 §"Tool defect T1"); probe 3 §3.2 | **RED** | open #170 | AD2 (author) |
| D16 | Held-out rules and dependency-cruiser violations per snapshot; held-out list hashed | #210 (held-out-rule mechanism, backlog G1); #197 | **RED**: not in the loop on `v1.3` | open #210, #197 | Merge both (agent); hash the list in S11 (agent) |

### 3.4 Readiness items outside the 42 lines

| Id | Item (source) | Requires | Evidence | Status | Merged? | Next action (owner) |
|---|---|---|---|---|---|---|
| R-01 | Pilot memo §5 branch (pilot memo; night plan §3) | Branch recorded mechanically from the DDD `none` score | #229 offline re-score: **zero branch** under options a, c, d (deviation record §4). The memo now carries a dated amendment (§8) recording the branch and the deviation. | **AMBER** | open #170, #229 | Re-score on `v1.3` with Neo4j after the T1 fix; confirm the branch (agent) |
| R-02 | Pilot T1, DDD freezer (#170) | Freezer handles an empty aggregate list; pilot DDD re-scored with no new generation | #170; probe 3 (#227); #229 adds opt-in options (unmerged). Floor-escape §3.1 has been corrected 2026-10-16 to mark T1 open: #142 only rejects the spec cleanly at freeze, and probe 3 hit T1 after #142. | **RED** | open #170, #229 | AD2 → merge the chosen #229 option with an ADR and a development-set check (agent) |
| R-03 | SO5 floor effect (gap plan SO5; floor-escape §1; G4) | A measurable primary outcome: since 2026-10-16 the level Y at step 4, with ≥ 1 confirmatory stratum passing the validation pilot's go rule (floor-escape §4) | E1 0/65; pilot 0/8; probe 1: Hexagonal 0/14 steps, Layered set at step 1; probe 2 1/24; precedent 0/8; probe 3 0/8 | **RED**: task design alone did not lift it (#227) | v1.3 (#161, #201, #226, #227); open #170, #182, #189 | Validation pilot under its pre-committed rule; if no stratum passes, Study 2 does not run (agent + author) |
| R-04 | Freeze F1–F14 (freeze runbook #164) | `freeze-check.ts` 14/14 OK | #164 dry run: 9/14 unmet (F1–F4, F8–F12) | **RED** | open #164 | AD8 (Q10) → merge #164 (agent); freeze (author) |
| R-05 | Merge queue for gate-bearing PRs (hold-queue triage) | Every PR named in §3.1–§3.3 merged or rejected before the candidate run commit | 47 open; FIX-FIRST: #133, #188, #196, #203 | **RED** | — | AD8 → merge in the triage §4 order (agent) |
| R-06 | #143 `hints` on the default MCP tools (night plan §6.8; HQ-Q1) | No agent-settable parameter on the default arm surface | Merged `dffb1db8` before its HOLD | **RED** | v1.3 | AD7 (author) → gate or revert (agent) |
| R-07 | Dress rehearsal (`study2-dress-rehearsal.md`, #146) | Stages 1–23 pass at the candidate run commit; report `v1.3-study2-rehearsal-<date>.md` | Plan only; entry conditions §1.2 mostly unmet | **RED** | v1.3 (plan) | After §1 steps 1–10 (author) |
| R-08 | Validation pilot (floor-escape §4) | Per style: mean distinct blocking edges at step 4 ≥ 1.5, ≥ 2/3 runs with Y ≥ 1, unmapped ≤ 10 %, 0 evaluation errors | Not run; prerequisites include a layered preset slot, a layered frame, L3/L4 slots and the attention sentence | **RED** | v1.3 (design) | If AD1 = B: agent builds the prerequisites, author runs 36 turns |
| R-09 | Model panel / "meaningful" label (gap plan 3.3, 4.9; night-plan decision 7) | Real panel run under `panel-authority-v1` | `Docs/v1.3/model-panel.md:3`: "No real model has been called"; no Gemini key | **RED** | v1.3 (harness #153) | New Gemini key (author); run (author, local) |
| R-10 | Replication smoke on `v1.3` (#215; triage §1) | `replication/smoke.sh` exits 0 at the run commit | #215 reports exit 1 at the `v1.3` head; not re-checked here | **AMBER** | open #215 | Re-run and fix on `v1.3` (agent) |
| R-11 | G4 framing written before the run (distinction readiness) | Floor and null outcomes pre-declared as interpretable; "no green gate, no run" in writing | Floor-escape §5 drafts the fallback claims | **AMBER**: draft exists; not signed | v1.3 | Sign with the AD1 amendment (author) |
| R-12 | Reproducibility release (G5) and private/public visibility (night-plan decision 6) | Tag, DOI, path scrub before the thesis is filed | Artifact evaluation pack #223 (open) | **RED** (not on the Study 2 path, but binding for the defence) | open #223 | After the hold-out (author decision; agent pack) |

---

## 4. PR → gate map (open PRs that move a line)

| PR | Backlog job | Lines | Triage class |
|---|---|---|---|
| #170 pilot run | — | D1, D15, S7, S8, D4, R-01, R-02 | AUTHOR-DECISION (HQ-Q5) |
| #164 freeze runbook | — | V1, V3, F1–F14, R-04 | AUTHOR-DECISION (HQ-Q10) |
| #141, #191 judge v2.2 | X4 | V7 | MERGE-NOW / AUTHOR-DECISION (HQ-Q9) |
| #133, #167, #181 external set | X1 | V8, V10(b) | FIX-FIRST / HQ-Q6 |
| #171 isolation and pins | S2 | S2, S3, D7 | HQ-Q11 |
| #180 fault drills | S1 | S1, D14 | HQ-Q8 |
| #176 MCP interp parity | V1 (job) | V9 | MERGE-NOW |
| #173 tunables manifest | T1 | S11 | MERGE-NOW |
| #174 unsealer | T2 | S14, V11, D2 | HQ-Q11 |
| #196 MCP call log | S3 | D6 | FIX-FIRST |
| #197 snapshot measures | D1 (job) | D13, D16 | MERGE-NOW |
| #200 acceptance runner | D2 (job) | D12 | MERGE-NOW |
| #199 engine tee | E1 | D8 | MERGE-NOW |
| #203 determinism pack | A1 | D9 | FIX-FIRST |
| #204 third manifest | H1 | V10(a) role split | HQ-Q11 |
| #205 forecaster | C1 | D4 | MERGE-NOW |
| #206 stub replay | S4 (job) | D14, S9 | HQ-Q8 |
| #207 Neo4j versions | P1 | D7, D8 | MERGE-NOW |
| #210 held-out rules | G1 | D16 | MERGE-NOW |
| #143 (merged) | J2 | R-06 | HQ-Q1 |
| #159, #151, #188 | — | instrument before the freeze (R-04, R-05) | HQ-Q3, Q4, Q12 |

Merged in MT5 and now evidence on `v1.3`:
- #146: gate and rehearsal plan;
- #160: D9 on synthetic data;
- #201: D2 procedure;
- #227: R-03, probe 3;
- #226: floor-escape design;
- #218: triage sheet;
- #192: gap plan;
- #194: outline v2;
- #149 and #131: V8 inputs;
- #130: threats register.

## 5. Discrepancies found while building this

1. **Merge train report missing.** `Docs/v1.3/merge-train-mt5.md` does not exist. The MT5 list above comes from the GitHub PR list.
2. **Floor-escape T1 claim (corrected 2026-10-16).** Floor-escape §3.1 said the T1 freezer fix is merged via #142. It is not: #142 rejects the spec cleanly at freeze, and DDD stays unscored (probe 3, #227, after #142).
3. **Gate status baseline.** The gate's own status table was taken at `4339bad5`, before #142, #160 and #201. This dashboard re-baselines it: S6, D9 and D2 move to AMBER, and D8 moves from UNKNOWN to AMBER because the CLI now defaults to `cypher-interp` without `NEO4J_URI` (#135, npx mode).
4. **Pilot memo state.** On `v1.3` the pilot memo still says "no pilot run has started", with its §7 placeholders unfilled. The freeze record lives on the #170 branch.
5. **ID collisions.** Backlog job IDs (S1–S4, D1, D2, T1, G1) collide with gate line IDs, and "T1" means both the pilot defect and the tunables job. Cite gate lines as "gate S2" and jobs as "job S2".
6. **Night plan vs merges.** The night plan lists #131, #146, #147, #192, #194 and #195 as author do-not-merge holds. MT5 merged them. Their hold reasons (wording and overclaims) were reported fixed on their heads by the triage, but the "author review" part of those holds was not recorded as an author decision (gate S13 only covers sealed and registered artefacts, so this is noted, not gated).
