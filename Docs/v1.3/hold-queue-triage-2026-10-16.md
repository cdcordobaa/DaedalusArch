# v1.3 hold-queue triage and author decision sheet (2026-10-16)

This triage covers the 63 open PRs into `v1.3` at tip `f66564ef`: 62 titled `[hold]`, plus #215, which was opened after the overnight review and is held only by its body. It starts from `Docs/v1.3/overnight-pr-review.md` and re-checks every finding against each PR's **current head**. Most branches received fix commits between 08:00 and 09:45 UTC, after that review.

It is documentation only. No PR was merged, closed, edited, labelled or commented on, and nothing was pushed to any PR branch. No `.env` file, sealed directory or credential was read.

---

## 1. One-page summary

| Class | Count | What you do |
|---|---|---|
| **MERGE-NOW** | **40** | Merge in the order in §4. You do not need to read them. Every overnight finding on them is fixed on the current head, and every new behaviour is off by default. |
| **AUTHOR-DECISION** | **18** | Answer the 12 questions in §2. Each answer releases one or more PRs. |
| **FIX-FIRST** | **4** | #133, #188, #196, #203. Each has one named defect (§3). Hand each back to its branch. |
| **PARK** | **1** | #156. Its `src/` change is superseded on v1.3, and its transcripts and machine paths are still not fixed. |

**What changed since the overnight review.** Of the overnight review's 64 HOLDs, about two-thirds were held only because the PR was marked do-not-merge. Of the substantive findings, these are now fixed on the current heads:

- every wrong number except #133's graph wording: #147, #165, #168, #176, #186, #188, #190, #201, and #133's 11/4 count;
- every overclaim except #188's title;
- #145's ungated MCP tool;
- #162's frozen `types.ts` edit and its missing third-party licence note;
- #164's widened `--expect-sha256`;
- #154's missing transcript.

What is still open is mostly ungated default changes and frozen-schema amendments. Those are your decisions, not defects.

**Two things on v1.3 itself need you, whatever you do with the queue:**

1. **#143 is already merged** (`dffb1db8`, at 07:52, before its HOLD). It adds an agent-settable `hints` parameter to the default MCP tools and amends the FROZEN report schema (`fixHints`). This is question **Q1**.
2. #215 reports that `replication/smoke.sh` exits 1 at the current v1.3 head. That failure is on v1.3, not in any PR.

**Secrets scan.** All 63 diffs were grepped for these key shapes:

- `sk-`, `sk-ant-`, `ghp_`, `github_pat_`, `AKIA`, `AIza`, `xox?-`;
- `PRIVATE KEY`;
- `.env` files;
- `password`, `token` and `API_KEY` reads.

There are **no real secret values and no `.env` files.** The two `sk-` hits are the text `task-management`. The literal `sk-ant-secret` and `ghp_secret` strings are fake values in #171's test. The env reads are:

- `NEO4J_*` for the local database, which is the existing convention and is not counted below;
- opt-in API keys in #204 (Q11);
- a scrub list of key names in #215, which removes them from child processes;
- generated sample-app code in #170 and #182, which reads env vars of fictional services.

**The `audit.md` conflict.** 23 PRs conflict with v1.3 only in the append-only `aidlc-docs/audit.md`. When it conflicts, keep both entries. If you merge locally, `echo "aidlc-docs/audit.md merge=union" >> .git/info/attributes` makes git do this for you.

**How this was checked:**

- `git log origin/v1.3..origin/<head>` overlap for stacking;
- pairwise changed-file overlap;
- a `git merge --no-commit` trial of every head against v1.3;
- a sequential trial of the full MERGE-NOW order (§4) in a scratch clone.

The trials are textual only: tsc, jest and the byte gate were not run on the combined tree. Six read-only agents re-verified each overnight finding on the current head by reading the files, not only the commit messages.

---

## 2. Author decision sheet (12 questions)

Answer by writing a letter after `[Answer]:`. **Rec** is the recommended option, with the reason.

**Q1 — #143 (already on v1.3): the `hints` MCP parameter and the `fixHints` field in the FROZEN schema.**
Should the agent-settable `hints` parameter and the schema amendment stay on v1.3 as merged?
A) Keep both, and record them as a reviewed U3 amendment.
B) Gate it: the tools ignore the per-call `hints` unless the server was started with `--hints` / `DAEDALUS_HINTS=1`, and the schema field stays.
C) Revert #143.
Rec: **B**. The schema field is optional and absent by default, so it is harmless. An agent-settable parameter on the default tool surface is a Study 2 arm-contamination risk.
[Answer]:

**Q2 — #139, #213, #212: the `advisoryFilter` field in the FROZEN report schema, and which filters are on by default at the freeze.**
A) Accept the additive `advisoryFilter` amendment, with **no** filter on by default. Merge #139, then rebase #213 and #212.
B) Accept the amendment and make the `proposed` filter set the default at the freeze.
C) Reject the amendment, keep the filters offline-only, and park #212 and #213.
Rec: **A**. Default reports are unchanged, and in 156 set × repo cells no blocking row moved. The removed warnings are unlabelled, though, so making a filter the default (B) is not yet supported.
[Answer]:

**Q3 — #159 (fixes R01–R31): accept its ungated default changes and its FROZEN-schema amendment R04?**
The ungated changes are R03, R05/R06, R12, the collation change, R15/R16/R18 and R01.
A) Accept them all as defect fixes before the freeze. Re-merge v1.3 after #151. Set the FE script default to `--bare-lines longest` so the committed figures reproduce. Then rebase #170 to results only.
B) Accept the additive schema change, but put R03, R05/R06 and R12 behind opt-in flags.
C) Land only the docs and opt-in items now, and park the default changes until after the freeze.
Rec: **A**. These are confirmed defects, and they must be in the instrument before it is frozen. In any case, never land #159 through #170, which carries 31 of its commits.
[Answer]:

**Q4 — #151: the 30 s default read timeout for the interpreter, and the merge order with #159.**
A) Accept the 30 s timeout and merge #151 before #159. #159 then resolves `functions.ts` on top of it.
B) Keep the interpreter unbounded by default (`queryTimeoutMs: 0`), then follow A's order.
C) Merge #159 first, and #151 re-merges and re-runs parity.
Rec: **A**. It matches Neo4jRepository's existing 30 s bound. The byte gate is 73/73 and parity is 72,388 statements with 0 differences. #151 also adds a root MIT `LICENSE` and `NOTICE`, so confirm that too.
[Answer]:

**Q5 — #170, pilot T1: how should the frozen DDD spec handle a tree where the ISE finds no aggregates?**
FF-DT01/02 with an empty list fails BR-SPEC-10, and the 8 kept DDD snapshots are unscored.
A) Fix the freezer on the development set. Re-freeze from the same recorded step-1 commits and score the 8 kept snapshots. This needs no model call.
B) Fix the freezer and re-run both DDD runs on a fresh out-root, after a memo revision.
C) Revise the memo so the pilot stands on two tasks.
Rec: **A**. It is deterministic, costs no model call, and is enough to reach the §5 decision. Rebase #170 to results only after #159.
[Answer]:

**Q6 — #167, #181, #198: these read #133's external-set data, which is not yet on v1.3. Should they land before #133?**
A) Fix #133 first (§3), merge it, then merge #167 and #181. Re-run #198's `analyse --external-ref origin/v1.3` and merge it.
B) Merge them now, citing `origin/v1.3-external-set@b8492a7a` as the data source.
C) Park all three until the external set is labelled.
Rec: **A**. #133's fix is a wording errata, and after it the pooled and known-groups numbers reproduce from v1.3. The thesis should not cite data that is not on v1.3. #149, #186 and #209 are in MERGE-NOW because their results reproduce from their own committed files. Regenerating them from specs still needs #133.
[Answer]:

**Q7 — Sealed-list domain check, which only you can do.**
Do any of these domains appear on the sealed Study 2 task list?
- #189: bike-repair, choir-rehearsals, kayak-rentals, tool-library;
- #201: repair café, school bus, vineyard harvest, ice rink;
- #206: the six demo-task domains.

A) None overlap: merge #189 and #201 as they are, and #206 subject to Q8.
B) Some overlap: those PRs swap the domains (and #189 re-runs those cells) before merging.
C) Some overlap: park the affected PRs.
Rec: **A** if your check is clean. This check is the only blocker left on #189 and #201.
[Answer]: B for #206 only (2026-10-19, F23): two of its six demo domains overlap and were replaced (tide-tables, stamp-catalogue). #189 and #201: no overlap (six borderline, kept). Detail: `Docs/DiagnosticRuns/v1.3-f23-and-v4-count-2026-10-18.md` Part 3.

**Q8 — Ungated bug fixes in the harness: #180 and #206.**
- #180: the gate arm stops on an unscored snapshot (`LOOP_GATE_UNSCORED`), and resume moves stale records to `discarded/restart-<n>/`.
- #206: the cypher-interp `evaluate_project` honours `tsconfigPath`.

Should these ship without a flag?
A) Accept both as bug fixes.
B) Put both behind flags that default ON.
C) Split each fix into its own PR and merge the rest now.
Rec: **A**. The old behaviours silently turn gate runs into `none` runs, the blocking R01-class failure. They also make every interpreter loop snapshot fail on "No tsconfig.json found". The clean replay digest is unchanged, and #206's fix has a test.
[Answer]:

**Q9 — #191: do the NOT CANDIDATE results for judge v2.2 count as the decisive CHECK-2 run?**
They were judged on the v2.2 prompts from before the re-harvest (sha `1b1d2665…`). #141 later re-harvested them (`27dcd514…`) and says the old file "was never judged".
A) Accept them. Fix #141's plan text to name the judged file, and commit `1b1d2665` beside the results.
B) Re-run v2.2 only (414 calls) on the `27dcd514` prompts.
C) Merge #191 as exploratory and record no decisive v2.2 run.
Rec: **A**. The 19 changed prompts only add clone flags, and D1 fails at 7/21 against a limit of ≤ 1, so a re-run is very unlikely to reverse the verdict. #141 merges first in either case (it is in MERGE-NOW).
[Answer]:

**Q10 — #164: accept the two edits to the hold-out pre-specification draft (`holdout-prespec.md` §2.2 and §2.4)?**
The edits add an engine rule (Neo4j of record, with an interpreter cross-check) and rename the provenance file to `holdout-run-provenance.json`.
A) Accept both.
B) Accept only the rename.
C) Revert both, and change the runner instead.
Rec: **A**. The draft is not sealed, and the edits only make it describe what the runbook does.
[Answer]:

**Q11 — Author-run tools that touch sealed files or credentials: #174, #204, #171.**
- #174 is an unsealer for the sealed task file.
- #204's gemini and openai adapters read API keys from `--env-file` or the process env.
- #171's generator isolation allow-lists config-dir files, and the Linux `.credentials.json` case is open.

A) Merge all three as they are. All are opt-in, author-run, and wired into nothing.
B) Merge with guards: #174 refuses without `--i-am-the-author` or the pre-registration hash, #204 drops `--env-file`, and #171 settles the Linux allow-list.
C) Park all three until you run them yourself.
Rec: **B for #174** (one flag, a cheap guard against an agent running it), and **A for #204 and #171**. In #204, keys are read only with `--adapter gemini|openai`, one line is read, and the key is scrubbed from output. #171's default path is covered by its test.
[Answer]:

**Q12 — #188: should the accelerated query engine and the memory guard be on by default?**
They are 3–8× faster, but they flip 3 large-repo verdicts from pass to hard-block, and the guard sets `--expose-gc` at runtime.
A) After the rebase (§3), default to `--query-engine neo4j` and make the guard opt-in.
B) Accept the accelerated default as part of the frozen instrument.
C) Park until after the Study 2 freeze.
Rec: **A**. The speed-up is real, but a change to default verdicts does not belong in a pre-freeze instrument without a flag. The branch also predates cypher-interp, which is now the default engine.
[Answer]:

---

## 3. Full table

**Risk:** L = low, M = medium, H = high.

**Merge-order markers:**
- `*` = you resolve the conflict by keeping both sides;
- `**` = the branch must re-merge v1.3.

Where only `aidlc-docs/audit.md` conflicts, keep both entries.

### MERGE-NOW (40)

| PR | Reason | Depends-on | Risk |
|---|---|---|---|
| #130 | Docs: threats register, role-separation and seed-floor plans. No findings. | — | L |
| #136 | Docs: source-row supplement. The sealed `style-rule-sources.md` and `rule-tiers.md` are untouched. | — | L |
| #146 | Docs: readiness gate (NO-GO, stated honestly). Line statuses are a snapshot at `4339bad5`. | — | L |
| #147 | Docs: validity memo. The 2,668 vs 2,669 count is fixed (`95ebcfbd`). | — | L |
| #169 | Docs: research gaps. "SO1 met" and "no benchmark exists" are now scoped (`a66f9547`). | — | L |
| #172 | Docs: tool landscape. The MCP tool count is fixed to 11. | — | L |
| #177 | Docs: Notion ideas triage. The 597-row counts match. | — | L |
| #178 | Docs: distinction readiness. Acuerdo 034/2023 is marked UNVERIFIED. | — | L |
| #187 | Docs: user guide. `docs/guide/README.md:35` and `03-reading-a-report.md:92` still say #143 is "in a PR"; add one line after Q1. | — | L |
| #192 | Docs: gap plan. All findings fixed (`6f6c975c`, `64ab48e2`). | — | L |
| #194 | Docs: Study 2 outline v2. It calls #201 "pending" (stale but harmless). | — | L |
| #195 | Docs: validity summary. "Reliable" scoped and grades hedged (`d3a24ea3`). | — | L |
| #131 | Fidelity adjudication prep, labelled PROPOSED. Overclaim and NOTICE fixed (`fbe826b1`). Its `v12e-hashes.json` change auto-merges with #144's. | — | L |
| #149 | Default-view coverage: 3,717/3,717 edges match tsc. It also supplies the errata #133 needs. | soft: #133 (regeneration only) | L |
| #154 | SDD demo. The transcript is now committed (`0611ef69`). | — | L |
| #155 | Dogfood self-application. The wording is fixed (`40915bef`). | — | L |
| #160 `*` | Synthetic analysis rehearsal. "Proven" removed. On the night-plan tracker row, take v1.3's version. | — | L |
| #162 | Hex/DDD mutation operators. Frozen `types.ts` restored (sha `b505a52a…`), and the third-party notices added. | — | L |
| #165 | Judge selective prediction (null result). The v2.1 sentence is fixed. | — | L |
| #168 | Fixes mined from 36 histories (null result). The 8,319/536 count is fixed. Public commit authors' names and messages are committed in `pairs.json.gz`. | — | L |
| #175 | Fixture-comment leakage census. The scrubber is off by default and refuses sealed paths. | — | L |
| #179 | Complementarity matrix. De-duplicated, and the overclaim dropped (`a8e095e9`). | — | L |
| #182 | Floor probe 2 (null result). `.pyc` removed and `__pycache__/` ignored. | — | L |
| #186 | K2 spec-author reliability. A fails 11/15 is fixed (`00fd5545`). | soft: #133 (regeneration only) | L |
| #190 | Rule mutation. 116/273 is fixed. Mutants live in memory only, and no template is edited. | — | L |
| #197 | Snapshot measures. All counts recompute. | — | L |
| #205 | Study 2 forecaster. Both figures fixed (`e98c9c2a`). | — | L |
| #207 | Neo4j version parity. Header and scope fixed. The report's H1 still says "version independence" (cosmetic). | — | L |
| #209 | Human erosion. "Therefore" removed, and the child env is allow-listed. | soft: #133 (specs pinned by sha) | L |
| #215 `*` | Replication part 2. It was never reviewed overnight. Additive, it edits no existing doc, and it only names sealed paths. On `package.json`, keep both scripts. | — | L |
| #141 | Judge v2.2 prep. `--judge-version v2.2` is opt-in, and the v1/v2.1 prompt hashes are pinned by a test. Merge it before deciding Q9. | — | M |
| #144 | Rule-gap catalogue. A separate opt-in map, and no template text changed (verified). | — | L |
| #145 | Rule mining. `propose_rules` is now opt-in (`291a5b03`) and "held out" wording is fixed. About 4.6 MB of raw trees could be gzipped (optional). | — | M |
| #176 `*` | MCP parity through the interpreter, behind `--fast-rules-engine` (OFF by default). On `context.ts`, keep `hints`, `ruleMining` and `fastRulesEngine`. | — | M |
| #185 | Metamorphic testing. `resolvedEdgesInLiteralView` defaults to false (verified). Merge it before #188's rebase. | — | L |
| #208 | Judge steering prep. `--strip-comments` is OFF by default, and the default prompts are pinned by a test. | — | L |
| #199 | Loop engine tee, behind opt-in `--engine`. Merge it first in the loop cluster. | — | M |
| #173 | Tunables manifest and R23 check (opt-in). It duplicates #159's always-on R23. If #159 lands, keep one. | — | L |
| #200 `*` | Acceptance-check runner (`acceptance.enabled`, off by default). Keep both imports and fields in `plan.ts`, and both ignores in `eslint.config.mjs`. | after #199, #208 | M |
| #210 `**` | `gate.shownRules` (opt-in). After #199 and #200 it conflicts in 5 hunks of `loop.ts`. The branch should re-merge v1.3 and re-run loop-replay identity. | after #199, #200 | M |

### AUTHOR-DECISION (18)

| PR | Question | Depends-on | Risk |
|---|---|---|---|
| #139 | Q2: frozen-schema `advisoryFilter`. The filter is off by default. | — | M |
| #212 | Q2: filter defaults at the freeze. It bundles #133 (old 10/5 head), #139 and #149, so rebase after those. | #133, #139, #149 | M |
| #213 | Q2: exists only if #139 is accepted. It carries 6 of #212's commits. | #133, #139 | M |
| #159 | Q3: ungated defaults and the R04 frozen-schema change. Conflicts with v1.3 in 4 files. | after #151 (Q4) | H |
| #170 | Q5: DDD freezer T1. It carries #159, so rebase to results only after #159. | #159 | H |
| #151 | Q4: the 30 s default timeout, the root LICENSE and NOTICE, and the order vs #159. | — | M |
| #167 | Q6: 283/283 correct, but on #133's data. | #133 | L |
| #181 | Q6: the pooled 35-project numbers need #133. | #133 | L |
| #198 | Q6: re-run against v1.3 after #133. | #133 | L |
| #189 | Q7: sealed-list domain check. | — | L |
| #201 | Q7: sealed-list domain check. | — | L |
| #206 | Q7 (demo domains) and Q8 (ungated `tsconfigPath` fix). | — | M |
| #180 | Q8: ungated changes to gate-arm stop and resume. Two drills still fail (stated). | — | M |
| #191 | Q9: which v2.2 prompts were judged. It carries 3 of #141's commits. | #141 | M |
| #164 | Q10: edits to the prespec draft. The `--expect-sha256` widening is reverted (`4067285d`). | — | M |
| #174 | Q11: unsealer guard. | — | M |
| #204 | Q11: opt-in reading of API keys. | — | L |
| #171 | Q11: the Linux credentials allow-list. The default path is otherwise unchanged (`ffd4f192`). Merges after #173, with keep-both resolution in `plan.ts`. | — | L |

### FIX-FIRST (4)

| PR | Defect | Depends-on | Risk |
|---|---|---|---|
| #133 | `Docs/DiagnosticRuns/v1.3-external-set-2026-10-16.md:157`, `:178` and `:181`, and the PR body, say `evaluate` uses the `apg-v12e-default` routed graph. It actually uses `V13_DEFAULT_OPTIONS` (the literal view). Apply #149 §9 errata 1–2. The 11/4 count and the barrel range are already fixed (`49c7e6c7`). Keeping or dropping `conduit` (Copilot-era) is your call. | — | M (5 PRs build on it) |
| #188 | The branch is cut from `2c64d1d5` (135 commits behind) and conflicts in 5 `src/` files. It predates cypher-interp as the default. Rebase it, re-target or justify the accelerator, re-run the byte gate, apply Q12, and drop "(outputs byte-identical)" from the title. | after #185 | H |
| #196 | `src/mcp-server/context.ts` conflicts with v1.3, because #143 added `--hints` to the same lines. Rebase it, keep both flags, and re-run `call-log.test.ts`. | after #199/#200 (loop files) | M |
| #203 | Stacked on #160's old commits, so it no longer merges onto #160's head. Land #160, then rebase so that only the A1 commits remain. | #160 | M |

### PARK (1)

| PR | Reason | Risk |
|---|---|---|
| #156 | Its `src/mcp-server` change is superseded: v1.3 already has `resolveEngine` (#135) and a per-call `tsconfigPath` (#142), and the branch would override v1.3's engine default. The transcripts are still not committed, `run-task.sh:4` and `firewall-cli.cjs:2` hard-code your local paths with your username, and the title says "proof" for an N=1 illustration. Salvage the example later as an illustration, without the `src/` change. | M |

---

## 4. Merge order for MERGE-NOW

In a scratch clone, this whole sequence was merged with `git merge --no-ff` onto `origin/v1.3` (`f66564ef`), in order. Apart from `audit.md`, which is handled by keeping both entries, only the 5 steps marked `*`/`**` conflicted. Each is listed with its exact resolution.

**Wave 1: docs only (12).** You do not need to read them.
`#130 → #136 → #146 → #147 → #169 → #172 → #177 → #178 → #187 → #192 → #194 → #195`

**Wave 2: results and standalone scripts, no `src/` (18).**
`#131 → #149 → #154 → #155 → #160* → #162 → #165 → #168 → #175 → #179 → #182 → #186 → #190 → #197 → #205 → #207 → #209 → #215*`
- #160: in the night-plan tracker, 1 hunk of 11 lines. Take v1.3's row; the 10:30 tracker update is newer.
- #215: in `package.json`, keep both `demo:sdd` and `replicate:v1.3`, separated by a comma.

**Wave 3: opt-in code (10).** Run `tsc`, `jest --maxWorkers=2` and the 71-reference byte gate once after this wave.
`#141 → #144 → #145 → #176* → #185 → #208 → #199 → #173 → #200* → #210**`
- #176: in `context.ts`, 1 hunk. Union the three flags (`hints`, `ruleMining`, `fastRulesEngine`) in the doc comment and the `out` type.
- #200: in `plan.ts`, 2 hunks. Keep both imports (`parseLoopEngine`/`LoopEngine` and `TaskAcceptance`) and both fields (`specSha256`, `acceptance`). In `eslint.config.mjs`, keep both ignores.
- #210: after #199 and #200 it conflicts in `loop.ts` (5 hunks, 56 lines), `main.ts`, `plan.ts` and `types.ts`. Do not resolve this by hand. Ask the branch to re-merge v1.3 and re-run loop-replay identity, then merge it.

**After your answers in §2:**
- #133 (once fixed) → #167 → #181 → #198 (re-run) → #139 (Q2) → rebase #213 and #212.
- #151 (Q4) → #159 (Q3) → #170 rebased to results only (Q5).
- #141 is already in wave 3, then #191 (Q9).
- #160 is already in wave 2, then #203 rebased.
- #185 is already in wave 3, then #188 rebased (Q12).
- #199 and #200 are already in wave 3, then #196 rebased, and #171 (Q11) with keep-both resolution in `plan.ts` after #173.
- #180 and #206 (Q8), #189 and #201 (Q7), #164 (Q10), #174 and #204 (Q11) touch no shared files. Merge each once its question is answered.

---

## 5. Ledger of claims the thesis may make (from the night's results)

Each claim is stated at the strength its data supports, and each comes with the limit the thesis must state next to it. "Dev" means the development set the tool was built on. A claim whose PR has not merged must not be cited until it does. Unless marked otherwise, the claims below are on MERGE-NOW PRs.

| # | Claim (number, data) | Limit that must be stated | PR |
|---|---|---|---|
| C1 | **Engine parity.** The in-process interpreter has 0 content differences from Neo4j 5.26.24+APOC on 72,388 statements over 81 projects, and the full CLI result is identical on 71/71 reference variants. | Dev data. Float drift up to 16 ULP is tolerated on 2 templates. 19 templates have fewer than 50 non-empty comparisons. Neo4j stays the reference. | #151 (Q4) |
| C2 | **Version stability.** Reference results are byte-identical on Neo4j 5.26.24 and 2025.12.1. The parity sweep has 0 differences over 70,560 statements. | Two versions, Community edition, Cypher 5 mode, the reference set only. This is stability, not independence. | #207 |
| C3 | **Extraction fidelity.** The graph `evaluate` reads matches tsc on 3,717/3,717 edges of 15 external projects. | tsc is a second extractor, not ground truth. 15 small projects, no `node_modules`. | #149 |
| C4 | **Deterministic correctness on human code.** 283/283 blocking findings are correct, Wilson 95% [0.987, 1.000], and a negative control of 500 falsified findings was labelled incorrect 500/500. | Correctness, not meaningfulness or recall. One spec author. The interval ignores clustering: 3 repos give 214 of the findings. | #167 (Q6) |
| C5 | **Human code fails the rules.** 11 of 15 pre-2023 human-written TypeScript backends fail the blocking verdict. Pooled with wave 2, 30 of 35 fail. | The findings are unlabelled, so this is not precision. One Claude-family spec author. Template-heavy repos. | #133 (fix), #181 (Q6) |
| C6 | **Reliability across spec authors is NOT shown.** With a blind second author, file-to-layer κ is 0.77 but verdict κ is 0.21 (5/15 verdicts flip). The pre-stated criterion was not met. | n=15, and both authors are from the same vendor. Agreement does not show which spec is right. | #186 |
| C7 | **Metamorphic invariance.** Blocking findings are invariant in 637/655 semantics-preserving transformation cases. One tool defect was found (MT-B1). | Dev set, with transformations the author chose. Untested on a hold-out. | #185 |
| C8 | **Mutation recall.** Hex/DDD blocking recall is 431/441 = 0.977 [0.959, 0.988], with 0/297 near-miss false fires. | The operator author also wrote the specs, and nothing was pre-registered. The intervals are too narrow because sites are not independent. | #162 |
| C9 | **The rule set is weakly tested by its own tests.** 90/273 measurable rule mutants are killed strictly, and the unit tests kill 116/273, all syntactically. | Most survivors are equivalent mutants. Dev set. | #190 |
| C10 | **Rule mining.** The miner recovers the allowed dependency graph at 100% precision and 79% recall, and flags 44/45 dependency-shaped plants. | Dev set. The probes are transforms of the same 5 projects, not held-out data. Non-dependency rules score 0. | #145 |
| C11 | **Symbolic and neural checks complement each other.** The rules flag 9/35 planted seeds. The judge catches 22/26 of the rest and false-fails 2/48 clean units. | Dev set, judge v1 only. "Missed by the rules" means as configured for that spec. | #179 |
| C12 | **Judge confidence is NOT available.** 3-run unanimity misses the pre-stated rule (Wilson lower bound 0.778 for v1 and 0.7985 for v2.1). | Dev set, 3 runs, and the items are correlated. | #165 |
| C13 | **Judge v2.2 is NOT CANDIDATE.** It fails D1 with 7/21 false fails on layered clean units, so v1 stays the default. | Dev CHECK-2, one vendor. Run on the v2.2 prompts from before the re-harvest. | #191 (Q9) |
| C14 | **Developers do not preferentially fix flagged edges.** RR 0.93 (0.61–1.43) over 36 histories (8,319 snapshot evaluations, 14 distinct fix commits). Only FF-S02 cycles show a signal (2.7×). | The pooled signal comes from one commit. The specs were written by the tool's agent. The method cannot tell wrong findings from tolerated debt. | #168 |
| C15 | **No known-groups separation.** Cliff's δ = −0.18, p = 0.81. | n=15, keyword-defined groups, and the CI spans 0. A null result does not show the instrument cannot separate groups. | #198 (Q6) |
| C16 | **Erosion direction.** The blocking-per-KLOC slope is positive in 5/6 repos (sign test p = 0.219, not significant). | Unlabelled counts, no hexagonal repo, and spec drift over history. | #209 |
| C17 | **The floor is not lifted by frame wording.** The style-only and spec-only frames give 0/8 steps with a correct blocking finding, and style+layout gives 1/8. | One session, no replicate. The agent knew the instrument. Part of the zero is invisibility (19/28 files unmapped). | #182 |
| C18 | **No precedent propagation.** A planted shortcut was copied in 0/8 cells vs 0/8 controls. | One agent, which also wrote the hypothesis. Tiny n. | #189 (Q7) |
| C19 | **The pilot floor.** The Clean and Hexagonal tasks had 0 blocking findings at all 16 scored steps in both arms. | n=1 per cell. DDD is unscored (T1). This is a pilot, not Study 2. | #170 (Q5) |
| C20 | **The harness is robust.** 11/13 injected faults resume byte-identical. A stub replay at Study 2 scale completes 162/162 runs with no lost turns. | Scripted or stub agents only. 2 drills still fail. The live CLI was not drilled. | #180 (Q8), #206 (Q8) |
| C21 | **The analysis pipeline recovers planted effects.** 30/30 checks pass, and null rejection is 0.04. Power at the planned N is 0.54 for gate and 0.17 for mcp. | Synthetic data from the same model as the power simulation. The mcp decision flips on 3/8 seeds. | #160, #203 |
| C22 | **Advisory noise can be reduced out of sample without touching blocking rows.** The `proposed` filter set removes 0.45 of external warnings and 0.33 of wild-set warnings, and 0 blocking rows change. | The removed rows are unlabelled, so this does not show they were noise. | #213 (Q2) |
| C23 | **Doc numbers reproduce.** 4,587 of 5,154 registered numbers reproduce exactly and 58 differ, none changing a conclusion. | 509 were not checkable offline. Covers docs up to `a6723c34`. | #215 |
| C24 | **Self-application.** On its own `src/`, 49 findings were triaged as 29 real debt, 20 spec-too-strict and 0 tool false positives. | One rater, who also wrote the spec. This is not a precision figure. | #155 |

**Limits the thesis must state overall:**

1. **Same vendor.** Every spec, judge and generator so far is Claude-family. The non-Claude third manifest (#204) has a harness but no run.
2. **No human labels.** The external blocking and advisory findings are unlabelled. C4 is correctness, not relevance. There is no human inter-rater reliability.
3. **One spec author, and spec-author reliability fails at the verdict level** (C6). Every external-set verdict carries that caveat.
4. **Most validity evidence is on the development set** the tool was built on. The hold-out has not been run (it runs once, in Study 2).
5. **The floor.** In every greenfield-agent probe so far, the blocking count is at or near 0 (C17, C19). Study 2's effect size θ is unknown, and the planned power is low (C21).
6. **Synthetic-only rehearsal.** The analysis pipeline is validated on data from its own power model.
7. **Uncited data.** Claims whose PR is not merged, or whose inputs live on an unmerged branch (#133's family), must not be cited until they are on v1.3.

---

*Produced by a scheduled triage routine. Sources:*
- *the open-PR list into v1.3 and the PRs' review comments;*
- *`Docs/v1.3/overnight-pr-review.md`;*
- *git stacking, file-overlap and merge trials against `origin/v1.3` at `f66564ef`;*
- *six read-only verification agents.*

*Nothing in the queue was changed.*
