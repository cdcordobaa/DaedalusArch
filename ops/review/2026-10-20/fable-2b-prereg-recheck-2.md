# Fable re-check 2 of the Study 2b pre-registration: semantic secondary (2026-10-20)

Scope: the three applied notes of re-check 1, and the DELEG11 addition. Read only. Nothing under `daedalus-sealed/` or the MEAN-01 sample was opened.

## A. The three notes of re-check 1

| Note | Status | Evidence |
|---|---|---|
| `supportedUnderBoth` compares signs only for a rejection | APPLIED | `scripts/v1.4/lib/study2b-analyse.ts:269` (`!a.reject \|\| a.predictedSign === b.predictedSign`); test `study2b-analyse.test.ts:93` expects "not rejected under D or D†" for a double non-rejection |
| Post-run acceptance runner committed before the first 2b call | APPLIED | pre-registration §4, "Post-run acceptance", last paragraph: "committed and checked on the rehearsal snapshots before the first 2b call (gate line D12)" |
| Runbook §6 carries a D8 engine-parity step | APPLIED | `Docs/v1.4/study2b-runbook.md:159`, inside §6 (lines 134–169): seeded 2b sample re-scored on Neo4j 5.26.24, rows compared with `cypher-interp`, Neo4j governs |

Minor wording drift: §4 says the runner is committed "before the first 2b call"; gate line D12 (§6) says "before the first 2b snapshot is scored". The §4 form is the stricter one and is the registered procedure. Non-blocking.

## B. The DELEG11 addition, requirement by requirement

**(1) D_sem as a registered secondary.** RESOLVED.
- §1 secondary table row "D_sem" and §4 "Semantic layer" item 1: no Holm claim, no confirmatory claim, no change to D, the verdicts or the scorer (§4 first line).
- Class mapping is faithful to C4-01 §4.2: no verdict field (rule 1, line 115), citation required for a claim and must be doc or comment (rule 2), grounding (rule 3), rejected citation becomes `claimed: false` (rule 4), `severityClass` never moves a finding out of the tier (rule 5), two runs and `single-run` (rule 6, line 120). The pre-registration's "stable, grounded exception claim" is exactly the set C4-01 §4.3 forwards to `proposed-exceptions.json`. "C4 has no non-violation class" matches C4-01 §1 (line 17, 20) and N1.
- Per-cell D_sem and the H1/H2/H3 contrasts with the same test: `scripts/v1.4/study2b-analyse.ts:149-159` (`--dsem`, `analyseContrast` with a value override, `familyDecision`, `perCell`); skipped under `--plant`, so the planted-effect check is untouched.
- Reading: `semanticReading` at `lib/study2b-analyse.ts:282-293` emits "the symbolic conclusion survives semantic interpretation" when `reject` agrees and, for a rejection, `predictedSign` agrees; else "conclusion depends on the semantic layer"; null when D_sem is absent. Test at `study2b-analyse.test.ts:97-106` covers all three.

**(2) C1d on a seeded sample, descriptive.** RESOLVED. §4 item 2: m = 4 step-5 snapshots per cell, at most 2 per task, `drawSemanticSample` with seed 20261021 (the function takes `m`, `seed`, `perTask`: `scripts/v1.4/lib/stage-c.ts:184`); semantic-fact rate per cell, agreed-only, by fact kind; the 0.75 threshold both ways. Runner `scripts/v1.3/ontology-run.ts` exists with `--fact-policy agreed-only`, `--runs 2`, `--estimate`.

**(3) Semantic configuration as a declared parameter.** RESOLVED.
- Names match the code exactly: `JUDGE_MODEL = 'claude-opus-5-5'` (`frozen.ts:26`), `JUDGE_EFFORT = 'high'` (`:28`), `PINNED_CLI_VERSION = '2.1.294'` (`:85`), `JUDGE_CONFIG_DIR_DEFAULT = '~/.firewall/judge-claude-config'` (`:110`), `CLAUDE_EXPLORATORY_VERSIONS = ['2.1.303', '2.1.304']` (`claude-cli-provider.ts:58`). Provider name `claude-cli` is a registered route (`routes.ts:31`) that defaults to `JUDGE_MODEL`, `JUDGE_EFFORT` and `JUDGE_CONFIG_DIR_DEFAULT` (`routes.ts:96, 142`). Both runners default to it (`ontology-run.ts` header; `c4-run.ts --provider claude-cli`). No adapter built; "configuration pending" not needed.
- Swap arms: dated extensions with their own addendum, same component on the same stored snapshots, between-configuration agreement reported as raw and Cohen's κ, not accuracy; whether D_sem's readings hold (§4 item 3). The instrument map paragraph (`ops/01-instrument-map.md:140`) says the same and adds that the configuration is recorded in every A2 and A5 record.
- Same-vendor bias: §7 limitation 10, with the swap arm as its control and the "under the Claude configuration" reading until one runs.

**(4) Timing and caps.** RESOLVED. §4 item 4: after the run, on stored snapshots, no agent re-run; calls counted from the findings by `--estimate` (0 calls) before the first semantic call; C4 cap 4 × identities (2 runs plus one retry each, matching `c4-run.ts --runs 2` default and C4-01 rule 6); C1d cap = the estimator's upper bound on the 12 snapshots, fixed before the first call, and the 2a budget of 30 explicitly dropped with the reason the 2a report §10 gives (always-made passes 28–64 exceed it); a cap stop is "report the truncation", never raised mid-run. The 2a figures cited (17 identities, 34 calls; 584 expected, 1,654 at most) match `v1.4-exploratory-report-2026-10-20.md` §10.

**(5) DELEG row recording the decision.** RESOLVED. `ops/decisions.md:51`, DELEG11, records the author's decision and restates items 1–4 and the "not run" status; the pre-registration header (line 8) names it the author's own decision, and the changelog's first entry records it as added before dating.

## C. Consistency with the rest of the pre-registration and the repository

- **D, the tests and the scorer are unchanged.** D_sem is read from a separate file via `--dsem`; it never feeds `decision`, `supportedUnderBoth`, E or the sensitivities. Nothing in `src`, `scripts/v1.3` or `scripts/lib` is claimed changed, and the addition cites only existing code there.
- **The "not run" fallback never holds 2b** (§4 item 3, "Status of the route"), consistent with the 2a registration's rule quoted in the 2a report §10.
- **C4-01 §7 pilot**: the pre-registration states the pilot has never run and C4's behaviour on its seeded cases is uncharacterised. Consistent with 2a report §10.
- **Secondary table header reads "no Holm"**, while the D_sem reading needs a Holm decision on D_sem to compare with D's. This is what DELEG11 asked for; §4 says the Holm on D_sem is descriptive. Substance is consistent; the header wording is loose. Non-blocking.

## D. Notes for the record (non-blocking)

1. **H3 in `semanticReading`.** The registered text says the sign is compared for a rejection. For H3, `predictedSign` is null in both decisions (no predicted direction, `familyDecision:252`), so two H3 rejections in opposite directions would read "survives". `supportedUnderBoth` never sees H3, so no confirmatory reading is affected. Fix when convenient: compare the sign of T for H3 (store it in the decision), before the P8 hash is taken.
2. **Stale header comments.** `routes.ts:6`, `c4-run.ts:27` and `ontology-run.ts:29` still say the exploratory list is "2.1.303"; the constant is `['2.1.303', '2.1.304']`. The pre-registration cites the constant, which is correct.
3. **P8 script hashes.** The changelog says the `--dsem` change's hash is in P8. I could not compute sha256 read-only, so I did not verify that the P8 values are the post-DELEG11 bytes. Confirm at the go commit.
4. **C1d budget granularity.** `ontology-run.ts --budget` is per project, while §4 states a total cap over 12 snapshots. Use the per-snapshot upper bound as `--budget` and record it, so the stated total holds.
5. **D12 wording** (section A): align the §6 gate line to "before the first 2b call".

VERDICT: GO

*Editorial note (coordinator, 2026-10-20): item B(5) was reworded after the re-check to drop a reference to a quoted chat message, which the branch then removed for the public repository. The verdict and the findings are unchanged.*
