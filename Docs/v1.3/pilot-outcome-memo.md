# v1.3 loop pilot: outcome memo (written before any run)

**2026-10-15. Status: defined; no pilot run has started.** This memo fixes what the exploratory loop pilot measures and what each result will mean, before any data exist. It is **not** a pre-registration and is not listed in `corpus/prereg.json`. It does commit the decision in §5 in advance, so that the pilot cannot be read after the fact to suit Study 2. Before the first run, the memo's sha256 goes into `Docs/v1.3/sealed-hashes.md` in the same commit as the frozen pilot inputs (§7).

Related: `Docs/v1.3/study2-outline.md` (design and harness), `Docs/v1.3/pilot-tasks.md` (the tasks), `Docs/v1.3/rule-tiers.md` (blocking set).

## 1. Purpose

The pilot answers one question before Study 2 is designed in detail: **does a coding agent erode the architecture over successive feature steps at all, when nothing checks it?** Study 2 asks whether firewall feedback slows erosion. If there is no blocking-tier erosion to slow, its primary outcome would measure nothing. The pilot also gives rough figures for cost, time and the gate's repair rate. It never estimates an arm effect. Per `study2-outline.md` §6, Study 2's R, k and model count are set from spread and cost, never from arm differences.

## 2. Design

| Item | Value |
|---|---|
| Harness | `scripts/loop-harness-cli.ts` (`scripts/lib/loop/`), resumable, symbolic-only firewall evaluator (v1.3 scoring) |
| Tasks | 3, from `Docs/v1.3/pilot-tasks.md`: `market-vendors` (Clean), `shelter-adoptions` (Hexagonal), `relief-volunteers` (DDD) |
| Steps | k = 4 per task |
| Arms | `none` and `gate`. `daedalus-mcp` is added only under the condition below. |
| Generator | Claude Sonnet through the existing generator adapter: `adapterId` `claude-code-cli`, `modelId` `claude-sonnet-5-5` (the E1 pin), with the E1 confinement and retry policy |
| Vendor | **Single vendor, declared.** Nothing in the pilot speaks to other model families. |
| Replicates | 1 per (task, arm) cell |
| Runs | 3 tasks × 2 arms = 6 runs, 24 step turns, plus at most 12 gate repair turns. With `daedalus-mcp`: 9 runs, 36 step turns. |
| Order | Arms interleaved within task by the plan's `orderSeed` (set at freeze, §7) |

**`daedalus-mcp` "if cheap".** The arm is included only if, at freeze time, (a) the E1 confinement probes pass for the Claude CLI with the MCP server attached, and (b) the MCP call log runs outside the cwd (Study 2 prerequisites 4 and 5). It must need no new engineering beyond those two checks. Whether the arm is in or out is written into §7 before the first run, and cannot change afterwards.

**What the agent sees.** Each step uses the harness's fixed step frame, with the task's style sentence (see `pilot-tasks.md` §3). In `gate`, after a step with blocking findings, the agent gets them (at most 40) in one repair turn. In `none`, the agent sees nothing.

## 3. Primary outcome

**Erosion exists if the `none` arm shows at least one new blocking finding after step 1, in at least one of the 3 tasks.**

- A **blocking finding** is a finding of a rule that is blocking in `Docs/v1.3/rule-tiers.md` for the task's style, in the step's final snapshot (`steps/step-NN.json`, `blockingFindings`). FF-P06 FLOWS_TO rows are N/A, as in the tier table.
- It is **new** at step s (s = 2, 3 or 4) if no snapshot from an earlier step of the same run holds a finding with the same identity. Identity is the rule id, the template, the file and the target; for a cycle, it is the set of files. Line numbers are ignored, because they move between steps.
- A new finding counts only if `scripts/v1.3/check-correct.ts` labels it `correct`. A `not-checkable` finding counts only if the author confirms from the code that the condition holds, recorded with a one-line reason. An `incorrect` finding is a tool defect, which is logged and does not count.
- If a file is renamed and keeps the violation, its finding counts as new. This is an accepted bias toward finding erosion, and every such case is listed.
- The result is reported as a count per task (new blocking findings at steps 2–4) and as the yes/no verdict above. With 3 runs, there is no test and no interval.

## 4. Secondary outcomes (descriptive only)

| Outcome | Definition |
|---|---|
| **Advisory slope per KLOC** | Per run, the OLS slope over steps 1–4 of advisory findings per KLOC (LOC = non-blank `src/**/*.ts` lines). It is also reported without FF-CV05, which dominates advisory counts (1184 of 1423 symbolic findings in the committed E1 reports, `labelling.md` §2). |
| **REIMPLEMENTS candidates** | Places where a later step re-implements logic an earlier step already wrote (the agent-provenance relation of the v1.3 cheap batch 2). Reported only if that extractor is on `origin/v1.3` at the freeze commit; otherwise reported as N/A. Candidates are listed, not scored. |
| **Judge dimensions** | FF-N01 (integrity) and FF-N02 (intent), scored offline on each step snapshot with the frozen judge prompts, after all runs. They are reported per step and never block (`rule-tiers.md`). |
| **Gate repair success** | For `gate`, the share of failing steps whose repair turn cleared every blocking finding (`repair.cleared`), the mean of blocking-before minus blocking-after, and the new findings the repair introduced. |
| **Cost and time** | Per step and per run: input, output and cache tokens, `total_cost_usd` (API-equivalent), agent turns, and wall time. Repair turns and usage-limit pauses are shown separately. |
| Guards | Type-check errors per step, skeleton integrity, files and LOC per step, and the share of files that match no layer or context glob. |

**Cost guess.** At about 2–6 USD API-equivalent per turn (`study2-outline.md` §6), the two-arm pilot comes to about 70–220 USD, and about 100–290 USD with `daedalus-mcp`. It runs under the subscription login. This is within pilot size (NFR-V4).

## 5. Pre-committed decision

**If the primary outcome is zero** (no new blocking finding in the `none` arm in any of the 3 tasks), **Study 2's primary outcome moves to the advisory-tier erosion rate.** This is the per-run slope of advisory findings per KLOC over the steps, with FF-CV05 excluded, as defined in §4.

**Why the advisory rate and not the judge dimensions:**
1. It is deterministic. It comes from the same symbolic evaluator and the same stored step records, needs no model call, and is reproducible byte for byte (NFR-V3).
2. It adds no new validity question. The judge dimensions are LLM judgements whose validity is measured separately (FR-V8, FR-V9), and using an LLM to score LLM-written code would put a model inside the outcome.
3. It is the tier where Study 1's differences lived. Under the v1.3 tiers, every E1 finding is advisory (`Docs/v1.3/labelling.md` §2; `study1-addenda.md` A1).
4. FF-CV05 is excluded because test-file pairing measures test habits, not structure, and its counts swamp every other advisory rule.

**What this costs, stated now:**
- Advisory rules are metrics, proxies and conventions (`rule-tiers.md`). A Study 2 effect on them would be a claim about design quality signals, not about defining constraints of the style, and the thesis would say so.
- The `gate` arm reacts only to blocking findings, so with no blocking erosion it would rarely fire. Under this branch, the Study 2 design must either give `gate` the same advisory subset, or drop `gate` and keep `daedalus-mcp` against `none`. That choice belongs to the Study 2 pre-registration, but it must be made there explicitly.
- The judge dimensions stay a secondary outcome in either case.

**If the primary outcome is positive**, Study 2 keeps blocking violations per step and their slope as the primary outcome (`study2-outline.md` §4), and the advisory rate is secondary.

No other pilot result may change Study 2's primary outcome. In particular, nothing in the `gate` arm, or in any difference between arms, can.

## 6. Leakage controls

- **Hashed tasks.** The pilot tasks are hashed (§7) before any run. Changing a task after that means a new hash, a new memo revision, and discarding every run made with the old text.
- **Excluded from Study 2.** The pilot tasks, their domains and any task derived from them can never be Study 2 tasks. The sealed Study 2 list (`sealed-hashes.md`) was written before this memo and is not read by it. The author checks, without disclosing the list, that no pilot domain matches a sealed domain (`pilot-tasks.md` §1).
- **No arm effect is estimated.** Pilot figures feed only the decision in §5 (which uses the `none` arm alone) and the planning of R, k and the model count from spread and cost.
- **No tuning.** No rule, tier, template, preset or prompt is changed because of a pilot result before Study 2 is registered, unless an ADR gives a construct reason (`rule-tiers.md`). Tool defects the pilot finds are logged, and any fix is checked on the development set, not on pilot data.
- **The pilot outputs stay outside the agent's cwd** (the harness snapshot store), as in E1.

## 7. Frozen inputs (filled at freeze, before the first run)

| Input | Value |
|---|---|
| Tasks block of `Docs/v1.3/pilot-tasks.md` §2 (sha256) | `5b72d1182c5a6ededd8fcf1ce5715c960ac14e2105631ee6e67f72053fdce22f` |
| Task `market-vendors` "Farmers' market vendors" (sha256 of `JSON.stringify(task)`) | `009c672b4dee2a566da4fc9ad4d6d084df317763cbfce1508f53c6196d012c89` |
| Task `shelter-adoptions` "Animal shelter adoptions" | `acc8a145f5c884653dfec92bd98315b4cd272d24bdce3c3253d0f52e6d4ff49c` |
| Task `relief-volunteers` "Disaster-relief volunteer coordination" | `0a6f2531c56e09f4bd69d739bfa16c20e058a14224f70d1263b5964fd5c52315` |
| Tool commit | `419e29067e6eebcf8358d2fd6d0eb3181e2a2fe9` (`origin/v1.3` with `origin/v1.3-review-fixes-2` merged, a fast-forward; R01 fix included) |
| Step and repair frames (`promptSha256` of each) | `STYLED_FIRST_STEP_TEMPLATE` `54e815ddf472515b55b1c839a4ee417f711ee5817222ea5e23d758814c5b0911`; `STYLED_NEXT_STEP_TEMPLATE` `93161c32c3cebcb6a1b2cebc5fc6d7de253282b0becfe59de7e5389bb6818626`; `REPAIR_TEMPLATE` `2a06bf712219964ff682e77d827620d0a7db3d62fbc457bb3de94367660acec0` (templates before the slots are filled; each instantiated prompt's `promptSha256` is in its turn record) |
| Pilot specs (Hexagonal, DDD) and `specs/clean-arch.yaml` (sha256 each) | `specs/clean-arch.yaml` `91bd152e0ae58dcc28a35f2ebc6fe264bf9ff7cd11a2fa6a8094ef54fcd6f6a8`; `presets/hexagonal.yaml` `d085d6b9badca2e79ade19b12fcfff96d1317df139d646772871266f0ed20ab7`; `presets/ddd.yaml` `ce28a78582a92571c5c8ff2c9144eb2161c580e140db3af880d451737b6260f7` (base of the DDD specs frozen per run after step 1; each frozen spec's sha256 is in its run's `spec/spec.json`) |
| `daedalus-mcp` included? | **NO.** Check (a) cannot be passed without new engineering: no live confinement probe exists for the Claude CLI with the MCP server attached in the loop wiring (`scripts/lib/loop/agents.ts`, header: "has NOT been through a live confinement probe yet"), and the plan loader refuses `daedalus-mcp` together with per-task specs (`scripts/lib/loop/plan.ts`, `taskProfiles cannot be combined with the daedalus-mcp arm`). Check (b) was therefore not reached. Per §2 the arm needs no engineering beyond the two checks, so it is out. |
| `orderSeed` | `20261015` (as in `experiments/loop-pilot/plan.json`, sha256 `4104919ee0c02937b6b639b5d20b71d3757d8e1cca2c8757536f6c64bb7f6d83`) |
| CLI version and model id | `2.1.301 (Claude Code)`, `claude-sonnet-5-5` |

The commands that reproduce the task hashes are in `pilot-tasks.md` §5.

<!-- protocol-check: historical-above -->

## 8. Amendment, 2026-10-16: declared deviation from §5 (appended; the text above is unchanged)

<!-- study2-protocol: primary=Y-distinct-blocking-edges-at-step-k; k=4; arms=none,daedalus-mcp; unit=distinct-edge; fallback=do-not-run; order=freeze,hold-out,dress-rehearsal,pre-registration,gate,run; generators=claude-sonnet-5-5,codex-pin -->

Sections 1–7 above are the memo as written on 2026-10-15, before any pilot run. Their sha256 before this amendment was appended is `46d94136febeb308139f5224c974ecc879123855e7842891494b23bbfa63c9ca` (the whole file at `origin/v1.3` `38f199fd`). Nothing above this section was edited.

1. **§5 branch.** The 8 kept DDD snapshots were scored offline under §3 and §5 on PR #229 (`v1.3-pilot-t1-options:Docs/DiagnosticRuns/v1.3-pilot-t1-options-2026-10-16.md`). Under every T1 option that scores them (a, c, d), DDD `none` has 1 blocking finding at each step and **0 new** at steps 2–4. With Clean and Hexagonal at 0 (PR #170), **§5 lands on the zero branch.** It is final once the author's T1 option is merged and the snapshots are re-scored on `v1.3` with Neo4j, the engine of record; #229 used `cypher-interp`. The zero rests on 5 of DDD's 7 blocking rules, because FF-DT01 and FF-DT02 cannot fire on these trees.
2. **Deviation.** The author did **not** apply §5's consequence. Study 2's primary outcome is instead the level outcome Y (distinct blocking violating edges at step k = 4), decided 2026-10-16 13:50 UTC and recorded in `Docs/v1.3/study2-deviation-2026-10-16.md`. This breaks the commitment in §5 that "no other pilot result may change Study 2's primary outcome". The thesis reports it as a deviation, with the rationale and the timeline given there. Briefly: the floor was seen only on development and rehearsal tasks, never on sealed Study 2 tasks; Study 2 was not pre-registered; and the zero branch's advisory outcome is blocked by gate D1.
3. **What stays.** The §3 primary outcome and the §5 outcomes (new blocking identities at steps ≥ 2, the per-run slope, and the advisory slope per KLOC without FF-CV05) are **registered secondary outcomes** of Study 2, computed exactly as this memo defines them. The §5 branch result is reported beside the Study 2 primary.
4. **The `gate` question in §5** is settled: `gate` is dropped, and Study 2 compares `none` and `daedalus-mcp`.
5. **§6 leakage controls still hold.** The pilot tasks and their domains never become Study 2 tasks, and no pilot figure estimates an arm effect.
