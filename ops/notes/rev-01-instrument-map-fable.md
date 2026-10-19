# REV-01: adversarial review of `ops/01-instrument-map.md`

**Reviewer:** Fable (adversarial lens), 2026-10-18. Read-only; no model calls. Evidence cites repo files and `Nxx` ids from `Docs/v1.3/compendium/nulls-and-limits.md`.

## Verdict

The C1–C6 split is a usable chapter skeleton, but the evaluation it hangs on it is not. The drift reframe reopens the slope outcome that the 2026-10-16 deviation abandoned for power reasons, re-adds two arms that were dropped on the same day, and rests on a ground truth (PR review history) that the project's own mining already shows is nearly empty for TS repos. Keep the map, move drift to the exploratory brownfield sub-study that already exists on paper, and fix the status table before anyone cites it.

## Findings, by severity

**1. "Introduced violations per iteration" is the outcome Study 2 just left, and it does not escape the floor.**
Claim (§5): a longitudinal drift metric "may solve the floor effect." Why it fails: the deviation record (`Docs/v1.3/study2-deviation-2026-10-16.md` §3.3–3.4) switched from slope outcomes to the level outcome Y because slope power was ≤ 0.08 and "a slope reads replicated step-1 habits as zero erosion." "New blocking identities at steps ≥ 2" is already a registered secondary, and it was 0 on the DDD pilot (1,1,1,1 across steps). The level power simulation says k = 6 "adds 50 % of the turns for no power" under the plateau reading (`Docs/v1.3/level-power-sim-2026-10-16.md:20`). A longer window multiplies turns without raising the per-step base rate (N144, N146, N148, N150). A brownfield start adds *inherited* burden, which is not "introduced," so it changes the baseline, not the slope. Fix: keep Y primary; report introduced/survival as the registered secondaries they already are; put brownfield drift in the exploratory sub-study already drafted in `Docs/v1.3/floor-escape-design-2026-10-16.md` item 5.

**2. A second redesign of a declared run-once study, after more data.**
Claim (§6): "This changes Study 2," taken to the director at design stage. Why it is weak: the deviation already concedes "some examiners will treat the switch as an outcome switch after data" (§3.6). This draft re-adds the CI gate (dropped 2026-10-16: "a post-hoc repair turn lowers the count mechanically," floor-escape §3.1) and an LLM reviewer arm (rejected in `study2-outline-v2.md:104` as "a different treatment, which Study 2 cannot power"; the self-review placebo went with it). Reopening both after floor probes 1–3 is the pattern an examiner reads as lever-hunting. Director involvement does not cure it; only a design that predates the data does. Fix: leave Study 2's protocol line untouched; register drift as a separate exploratory study with its own pre-stated metrics.

**3. PR review history is a thin, shifted truth source for TS.**
Claim (§4): "that history is free and survives in the PRs." Why it fails: fix mining walked 8,319 snapshots over 36 histories and found only 14 distinct commits that removed a blocking finding; fix commits used architecture words 5/14 times, no more than baseline removals; flagged edges survive one year at 0.76 vs 0.75 unflagged (N120, N122, N123; all three developer-behaviour criteria null, N128). The repos with declared layer rules are AI-era: 40/42 dependency-cruiser baselines first committed in 2026, 35 with agent files (`track-2-scale.md` §SO4), about 8 repos and 120–150 positives in total. A PR review comment saying "this belongs in the domain layer" is rarer still, and the "violation never reached main" case needs the pre-fix diff, the comment and a classification: three steps, each lossy. It also shifts the construct from "violates the style" to "a reviewer objected," which is K4 by NS-01's own taxonomy. Fix: a one-day count on 2 repos before building anything; if < 20 usable comments, fall back to developer-acknowledged rules (D3 route B), which is scoped and costed.

**4. The circularity guard leaks on mined norms.**
Claim (§4): "Every proposed norm cites evidence the model didn't produce," and a human accepts at t0. Why it fails: (a) a majority statistic over G is produced by the instrument, and if N1-enriched edges feed it, by the model; (b) mining at a 75 % threshold proposes no rule where erosion is already past 25 % (`Docs/v1.3/rule-mining.md:230`), so the t0 norm set freezes existing drift as "normal" and measures only drift from the eroded state; (c) mined specs recovered 24/52 plants, DDD 1/12 (N07), and two blind spec authors reached verdict κ 0.21 (N02), so what the author "accepts" at t0 is a third spec author's reading; (d) "norm erosion 47/50 → 40/60" is confounded by growth and by legitimate architectural change the frozen set cannot see. Fix: no N1 facts in t0 mining; declare the threshold and the floor it implies; validate mined norms against the 15 hand-written external specs first, as recall of declared rules.

**5. The status table misstates what exists.**
"Mined … RED, not built": `propose_rules` and `daedalus mine-rules` exist and have results (`rule-mining.md`, N07). "C5 … no drift metric is defined": per-commit evaluation and survival are already run (fix mining). "C3 GREEN (dev) 283/283 on human code": 283/283 is external, and it is correctness, not recall; blind recall is 0.78 with four styles below 0.90 (N105) and the hold-out is unrun. "72,388 statements across 81 projects" is the unmerged run; the committed figures are 65,254 over 79 (`claims-ledger.md:274`). "MCP has 11 tools" conflicts with "9 spec-only tools" and "7 tools" in `study2-outline-v2.md:43`. Fix: one figure per claim, each with its N-id or file:line, before the map goes to the director.

**6. Decomposition: time and exceptions are misplaced; "C3 is one engine" is only true for K0/K1.**
Survival and time-to-detect need edge identity across commits (renames, deletions, bot commits: the RENAMED/FILE-DELETED/MASS-OR-BOT taxonomy fix mining had to invent). That is representation, so time belongs in C1 (answer to Q1: yes, C1e). Exceptions appear in C2 and C4, which double-counts them in any compliance tally. A mined majority rule needs a count-and-threshold query shape the sealed templates do not have, and K2m/K3 rules need N1 nodes, so C3's variety leaks into C1d. Fix: C1e snapshot and identity; exceptions live in C2 only, C4 proposes them.

**7. Arm A is confounded and arm B carries two treatments.**
A = agent + reviewer (no tools); B = agent + MCP during generation + CI gate. The contrast is "two interventions vs one," not "graph vs no graph." Reviewer model, prompt, rounds and token budget are unfixed, and a Claude reviewer with a Claude generator reruns gate V10. Fix: same reviewer, same prompt and budget in both arms; the only difference is whether the reviewer has graph tools. Treat MCP-during-generation as a separate factor or drop it.

**8. The efficiency test is unfalsifiable as written.**
"Accuracy and tokens on the same question" has no fixed question set, no raw-file tool set, no cap, and no repo size. On a 20-file repo raw files win; on 1,000 files the graph wins. Track 1 already lists "no experiment gives the same model the code with and without the graph" as RED. Fix: answer Q5 as "sanity check"; 10 pre-written questions on 2 repos of stated size, fixed tool sets and cap, both directions reported.

**9. Feasibility.**
A month, one person, no raters. Drift over N commits × arms × blocks × generators multiplies the turn count (finding 1); review-history mining is 3–4 agent-days before a single number. Cut C5/C6 as evaluation; keep the NS-01 thread (K3/K2m hand-written set, 2-case pilot), developer-acknowledged truth, and a zero-call C5 descriptive on the fix-mining snapshots.

## What survives

- C1–C6 as chapter vocabulary, and the three neural roles as the operational form of NS-01 Claim B.
- "Truth relative to an accepted baseline" is the right idea for the *exploratory* brownfield sub-study.
- Exceptions must carry a justification; C4 proposing, a human accepting.
- Treating "deviation from the graph majority" as a C2 rule, once the threshold is declared.
- The honest reds on C1d, C4 and C6.

## Three changes first

1. Strike "This changes Study 2." Register drift metrics as secondaries and as the exploratory brownfield sub-study.
2. Replace the PR-review truth source with a one-day feasibility count; default to developer-acknowledged rules.
3. Correct the status table (findings 5) and add C1e for time, with exceptions in C2 only.
