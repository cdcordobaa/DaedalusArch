# Track 2: the instrument at scale (SO4, SO5)

**As of 2026-10-18, main @ `612b3727`.** No new measurement. The sources are the same as in track 1, plus:
- the Study 2 deviation, `Docs/v1.3/study2-deviation-2026-10-16.md`;
- the readiness dashboard;
- the adversarially reviewed decision sheet (Notion, not yet confirmed).

**On the split.** In the repo, SO4 is "validity of the findings". Part of that is the instrument working on a few projects, and track 1 C covers that part. This track keeps the questions that only scale can answer:
- Does the instrument hold on code it was never tuned on?
- Do its findings line up with what developers actually do?
- Does it change what agents build?

---

## Bottom line

> **SO4.** Correctness transfers to human code (283/283). Two things do not exist yet: a held-out estimate, and any human-grounded sign that the findings *matter*. All three criterion designs based on developer behaviour are **null** for the blocking tier (N128). The independent rater was the planned answer, and paying one is now off the table. So **the rater question is the main SO4 blocker**, and it is yours to decide.
>
> **SO5.** Study 1 is done and registered, and its effect runs the "wrong" way. Study 2 is **designed, not run**. Its main risk is the **floor effect**: in greenfield code agents rarely break the defining rules, so there is little erosion for the tool to prevent. **DDD reaching the pilot bar is roughly a coin flip.** Study 2 runs once, earliest about **Nov 18–22**.

---

## SO4: validity at scale. Overall: **RED (not run, or null), with one GREEN**

| Question | Evidence | Status |
|---|---|---|
| Correct on human code? | 283/283 blocking findings correct on 15 external repos, with a 500/500 negative control. Clustered: 11/11 repos fully correct, repo-level Wilson [0.741, 1] | **GREEN** (external) |
| Held-out performance (M1, M3 ≥ 0.90, M7 ≥ 0.95 per style) | **not run**. The hold-out has 207 cases. The agent that enlarged it had seen the contested-construct list, so we will never call it an "independent hold-out" (decision sheet S13) | RED |
| Agrees with other tools at scale? | κ 0.913–1.000 on external and wild sets, but low per rule: FF-C04 0.218 external, FF-S02 vs ArchUnitTS 0.382 (N130) | GREEN pooled, AMBER per rule |
| Do developers fix what it flags? (predictive) | fix mining 2.65×, but that rests on one commit; 0.93 without it (N120). Direction rules are removed *less* often than baseline (N122) | RED (null) |
| Do "good" repos score better? (known groups) | showcase repos are not less dense in findings (δ = −0.18, p = 0.811) (N118) | RED (null) |
| Do declared refactors lower the count? | no: −0.27 [−0.95, 0.24], p = 0.572 (N125) | RED (null) |
| Is a finding *meaningful*? (Link 4) | **0 labels** (N114). No public human-labelled TS conformance dataset exists (N139) | RED |
| Independent human rater (V5) | **none**. A paid outside developer, the decision sheet's AD4/V5 answer, is now ruled out | RED, needs a new route (`decisions.md` D3) |
| Who wrote the spec | every external figure rests on AI-written specs, and a second blind spec author flipped a third of the verdicts (N02) | AMBER |

### The free ground-truth routes (the scan of 2026-10-16)

| Route | What it gives | What it can't give | Cost |
|---|---|---|---|
| **Developer-acknowledged violations.** Developers' own layer rules (eslint-boundaries, no-restricted-paths), their suppressions, and fix commits | about 8 repos with about 120–150 positives, about 27 of them pre-2023. Measures recall, a lower bound on precision, and the fix rate | κ. It is mostly front-end Layered code. It changes the construct from "violates the declared style" to "violates the developers' own rule" | about 3–4 agent-days, 0 model calls, plus a no-restricted-paths reader (about half a day) |
| **Free classmate rater** | real human–human κ on the codebook (V6: κ ≥ 0.60) | scale. One rater, about 2–3 h | 0 cash, your network |
| **Port Java datasets (LC1: MLCQ, DACOS)** | real human labels | they are Java class-level smells, not TS layer conformance, so it is a different construct | 1,536 model calls, not run |
| **AI-era caveat** | of the depcruise baselines found, 40 of 42 were first committed in 2026, and 35 of the repos hold AI-agent files. Nx suppressions: 0 of 100 were layer violations | — | goes into threats to validity |

**My recommendation:** the classmate rater for κ, plus developer-acknowledged truth as a *second, declared* criterion. Neither replaces the other. This is D3 in `decisions.md`.

---

## SO5: the spec level and the architecture of agent code. Overall: **GREEN for Study 1, RED for Study 2 (not run)**

| Question | Evidence | Status |
|---|---|---|
| Study 1 (registered, v1.2E) | spec level matters, but in reverse: `none` scores best, 0.951 vs 0.887 (Holm p = 0.0003). No model effect (p = 0.438). The effect runs through project size | **GREEN** (registered) |
| Study 1 under v1.3 tiers | 0 of 65 accepted cells has a blocking finding (N144). The effect is in advisory coupling rules, not in violations | AMBER (descriptive) |
| Floor effect | hexagonal `none` 0/14 steps blocking (N146). Layered blocked 14/14, but as a step-1 layout habit that later steps replicated (N147). Probe 2: 0/8 per condition (N150). Probe 3: 0/8. Loop pilot: 0/8 | **RED** (null) |
| Study 2 design | declared deviation. Y = distinct blocking edges at step 4. Five cells: `none` at L2/L3/L4, `daedalus-mcp` at L2/L4. 24 blocks. Power at RR 0.25: 1.00 / 1.00 / 0.92. At RR 0.5: 0.88 / 0.88 / 0.70. Pilot bar: mean Y ≥ 1.5 at step 4. If no stratum passes, Study 2 does not run | AMBER (design) |
| DDD in Study 2 | aggregates are declared only in the evaluator's spec. Y uses FF-DS01, FF-DS02, FF-DT03, FF-DT04, FF-S01 and FF-S02. Reaching the bar is about a coin flip. If DDD fails, Study 2 runs on Layered only (12 blocks) and DDD is reported as "characterised, not confirmatory" | AMBER |
| Readiness | 1 of 42 gate lines GREEN at 2026-10-16 12:00Z. That count was not re-taken after the deviation | RED |
| Generators | Sonnet 5.5 and Gemini (CDX, `decisions.md:19`). The Gemini coding-agent adapter exists (PR #257), off by default; its S4 probe has not run. *(Updated 2026-10-19; the Codex pin is no longer required.)* | AMBER |

---

## What to do next, in order

The zero-cost steps come first. Each one either kills a risk or tells us whether Study 2 is worth running.

| # | Objective | Move | Cost | Owner | Gate |
|---|---|---|---|---|---|
| 1 | both | Confirm the decision sheet, OK F23, confirm the composition slot (`decisions.md` D1, D2) | 0 | you | — |
| 2 | SO5 | **B2:** re-score the 8 kept DDD snapshots (8, not 12: `notes/rev-04-gaps-and-promises-2026-10-19.md:74`) with and without `acl: []`, which gives the expected DDD Y | 0 | agent | decides whether DDD stays in |
| 3 | SO5 | T1: re-score the 8 pilot snapshots on Neo4j | 0 | agent | — |
| 4 | SO4 | F23, the sealed-list overlap check | 0 | agent, after your OK | required before the pilot |
| 5 | SO5 | Prerequisites: the layered frame, per-task MCP spec (A25), DDD L3/L4 frames, the binding check, k = 4 fixtures | 0 | agent | — |
| 6 | SO4 | Pick the rater route (D3). If it includes developer-acknowledged truth, build the set | 0 calls, 3–4 agent-days | you, then agent | — |
| 7 | SO5 | **Validation pilot**: one lane, Neo4j, go/no-go per stratum, then re-run power | model calls, to be counted before it runs | your OK | stop rule |
| 8 | SO4 | Freeze, seal the fresh hold-out supplement, run the hold-out once, then the rater labels | small, counted first | your OK | — |
| 9 | SO5 | From about Nov 9: Codex pin, confinement probes, dress rehearsal, pre-registration, gate, **Study 2 once** | the study budget | you sign | readiness gate |

## Changelog
- 2026-10-19: Gemini adapter marked as existing (PR #257); DDD snapshot count corrected to 8 (REV-04 §6 item 5).
- 2026-10-18: first version.
