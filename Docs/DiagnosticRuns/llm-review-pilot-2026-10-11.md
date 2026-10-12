# Plain LLM-review baseline pilot: results (ADR-036, prereg v24, exploratory)

**Run**: 2026-10-11, `scripts/llm-review-cli.ts run`, then `score` (`results/llm-review/`). **Reading**: exploratory throughout (analysis plan §15). Reviewer: Codex CLI 0.162.1, `gpt-5.6-terra`, effort medium. Every call was served by `gpt-5.6-terra`. The read-only sandbox held: the only denials were write attempts such as heredoc temp files, and no read outside the tree occurred.

## Execution and the budget stop

The registered budget stop (ADR-036 item 5) ended the run before `p4-after` run 1: spent 147.96 + projected 9.96 > 150 credits. **25 of the 42 planned reviews ran and are valid**: run 0 of all 14 trees, and run 1 of the 10 seeded and baseline trees and of `p4-before`. Runs 1 of `p4-after`, `p5-before` and `p5-after`, and every run 2, were not made. They are reported as not run (`cost.csv`). There were 26 calls: 1 discarded attempt (on `dry-run-test--MO-C04--k1--baseline` run 1, 7.99 credits) and 25 valid runs. **Credits**: 139.97 for the valid runs, 147.96 including the discard (rate card), or 5.92 per valid review. The plan balance fell from 1235.95 (after the 0.84-credit probe) to 1091.86, a fall of 144.09. Wall time was 80 min, 3.2 min per review.

## Seeds (5 seeds × 2 runs; the firewall's SO4 v2 status beside)

| Seed | Rule | Runs detecting (primary / presence / family) | Firewall |
|---|---|---|---|
| truthy-demo:MO-S01:0 | FF-S01, FF-S04 | 2/2, 2/2, 2/2 | matched |
| v-aguiar__valex:MO-P01:0 | FF-P01 | 2/2, 2/2, 2/2 | matched |
| dry-run-test:MO-C04:1 | FF-C04 (created `OrphanHelper.ts`, TV-112) | 2/2, 2/2, 2/2 | matched |
| realworld-test:MO-SO01:1 | FF-SO01 | 1/2, 1/2, 1/2 | matched |
| zhuravlevma__nestjs-active-record:MO-CV02:0 | FF-CV02 | 2/2, 2/2, 2/2 | matched |

Seed-run recall: **9/10 = 0.90** (Wilson 0.60–0.98, "if independent") under all three readings. Every seed was found in at least one run. The firewall matched 5/5.

## Real fix pairs (one before/after run pair each; the third and second runs were not made)

| Pair | Runs flagging (primary / strict) | Resolved keys | Chance control | DaedalusArch / dependency-cruiser |
|---|---|---|---|---|
| p4 (hexagonal isolation) | 1/1, 1/1 | FF-S01 and FF-S04 on `carts` and `products` domain repositories (4) | 1 of 2 run pairs of the unchanged before tree "resolve" a finding | detects / detects |
| p5 (wiring only) | 1/1, 0/1 | FF-C03 on `src/app.module.ts` | not computable (one before run) | no / no |

The p4 flag lands on the same layer-crossing that both rule tools resolve. However, the two `p4-before` runs listed 28 and 2 findings (Jaccard 0), and the chance control fires in 1 of 2 run pairs, so on this tree one run cannot tell a fix from run-to-run variation. The p5 flag is an instability finding on the module root; no rule tool reads it, and it rests on one run.

## Consistency (trees with 2 valid runs)

Mean pairwise Jaccard over the 11 trees with two runs is **0.727**. Over the 10 seeded and baseline trees it is **0.799** (range 0.54–0.94), and `p4-before` is 0.000. **Declared scorer defect**: `summary.json` `consistency.meanPairwiseJaccard` (0.571) averages the three one-run trees as 0. The per-tree `consistency.csv` is correct and is the source of the two means above. The registered scorer is not edited after the run.

## Overlap with the firewall (all valid runs, listed rules only)

Of 909 listed keys (rule, file):
- 460 (50.6 %) equal a firewall key;
- 119 (13.1 %) are on a file the firewall flags under another listed rule;
- 210 (23.1 %) are on a file with no listed-rule firewall finding;
- 120 (13.2 %) name a judge rule (FF-N01, FF-N02) or an unlisted id.

The runs list 460 of the firewall's 1736 run-paired keys (26.5 %). Nothing is labelled, so neither side's precision is claimed.

## Reading

Given the same spec as prose, the agent finds the five clear-cut seeds about as well as the firewall does: 9 of 10 runs against 5 of 5. It reproduces about a quarter of the firewall's findings and adds a fifth of its claims on files the firewall does not flag. It costs about 6 credits and 3 minutes per review, against seconds and no credits for the firewall (`results/tool-comparison/runtime.csv`). On the largest tree (p4, 726 files) its output is unstable from run to run. n is 5 seeds and 2 pairs, mostly with 1–2 runs each (TV-111..113).
