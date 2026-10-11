# Judge model robustness: results (ADR-038, prereg v25)

**Run**: 2026-10-11, `scripts/judge-robustness-cli.ts run`, then `score` (`results/judge-robustness/`). The 100 registered units (25 per E7/E1 × FF-N01/FF-N02) were re-judged by `claude-sonnet-5-5` on the frozen route: CLI 2.1.294, the ADR-018 config dir with the pre-flight passed, the byte-identical recorded prompts, effort high, 3 runs per unit. There were **300 calls**: 0 invalid runs, 0 retries, no usage-limit pause, and every run resolved to `claude-sonnet-5-5`.

## Unit agreement (Opus vote vs Sonnet vote, U4 `voteUnit`)

| Scope | n | Agreement (95 % CI) | κ (95 % CI) | AC1 (95 % CI) |
|---|---|---|---|---|
| **All, unweighted (primary)** | 100 | **0.940** (0.875–0.972, Wilson) | **0.766** (0.565–0.926) | **0.931** (0.872–0.978) |
| All, population-weighted | 100 | 0.974 (0.950–0.992, weighted bootstrap) | 0.886 (0.713–0.968) | 0.970 (0.943–0.991) |
| E7 | 50 | 0.880 (0.762–0.944) | 0.603 (0.282–0.852) | 0.859 (0.736–0.955) |
| E1 | 50 | 1.000 (0.929–1.000) | 1.000 | 1.000 |
| FF-N01 | 50 | 0.960 (0.865–0.989) | 0.852 (0.567–1.000) | 0.954 (0.880–1.000) |
| FF-N02 | 50 | 0.920 (0.812–0.968) | 0.672 (0.310–0.929) | 0.909 (0.812–0.979) |
| E7 FF-N01 / E7 FF-N02 | 25 / 25 | 0.920 / 0.840 | 0.752 / 0.432 | 0.905 / 0.815 |
| E1 FF-N01 / E1 FF-N02 | 25 / 25 | 1.000 / 1.000 | 1.000 / 1.000 | 1.000 / 1.000 |

The κ and AC1 intervals are 95 % item bootstraps (seed 9402, 10 000 resamples). No Sonnet unit was invalid, so the "invalid as disagreement" row equals the primary row.

**Transition table**: Opus pass → Sonnet pass 82; Opus fail → Sonnet fail 12; **Opus fail → Sonnet pass 6**; Opus pass → Sonnet fail 0; no split votes. All six disagreements are E7 units with low Opus confidence (0.60–0.66): 2 FF-N01 DTO modules (raouf-b-dev), and 4 FF-N02 files (dry-run-test `files.module.ts`, truthy-demo `email-template.entity.ts`, realworld-test `follows.entity.ts`, raouf-b-dev `low-stock-query.dto.ts`). **Fail rate**: Opus 18/100 (0.18, 0.12–0.27), Sonnet 12/100 (0.12, 0.07–0.20). Mean confidence: 0.823 and 0.836.

## Verdict impact (41 reports, sampled rows replaced by the Sonnet votes)

**0 function verdict changes, and 0 project or cell verdict changes** under the registered majority rule and under the any-fail rule. Every unsubstituted report reproduced its stored `ahsCombined` and verdict.

## Reading (pre-declared, analysis plan §16.2)

The primary κ is 0.766 ≥ 0.60, so **the unit verdicts are robust to the judge model** within the frozen route. Where the models differ, Sonnet is the more lenient: it never fails a unit Opus passes. It clears 6 of Opus's 18 fails, all low-confidence and all on real (E7) projects. Replacing the sampled votes would change no verdict. This is agreement between two Claude models on one route, not validity (TV-114). n = 100 with 18 % prevalence, and the E7 FF-N02 κ is 0.43 on 25 units (TV-115).
