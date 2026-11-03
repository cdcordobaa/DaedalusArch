# SEM-GATE-3: result

**Verdict: PASS.** The run was on 2026-11-03, once, with the live judge, on instrument v1.5.10 (v1.5.9 plus form C).
Exploratory, not confirmatory; R-MIRROR-SEM stays uncounted. The criteria, the labelling rules and the 8 fresh cases
are in `GATE.md` and `cases.json`; they were committed and pushed in `1d894b84d` before the first judge call.

## Why v1.5.9 missed the SEM-2 pilot tables

In c005 (and c001, c006, c008) the core service keeps an untyped table keyed by the vendor's states
(`STAGES: Readonly<Record<string, string | undefined>>`) and indexes it with the port-carried vendor text
(`STAGES[s.stateCode]`). v1.5.9 traced that text to the vendor set and read the table's pairs, but it counts a pair
only as a mapping into a declared core value set. The looked-up values are plain strings, the port field is `string`,
and the only set holding them is the table itself, whose own pairs are dropped. So no candidate was made and the judge
was never asked. v1.5.9 reads a set's members as the targets of a mapping (form A needs a declared copy or a cast); it
never read a lookup's keys as a copy of the vendor set. v1.5.10 does (GATE.md §1).

## Gate

| # | Criterion | Value | Verdict |
|---|---|---|---|
| 1 | Form A still caught (SEM-GATE-2 fresh targets) | 11 / 11 | PASS |
| 2 | Form-C recall ≥ 0.80 on the fresh positives | 6 / 6 = 1.00 | PASS |
| 3 | Dev form C (pilot c001, c005, c006, c008) ≥ 3 / 4 | 4 / 4 | PASS |
| 4 | 0 false positives | 0 / 52 negative rows: fresh twins 0 / 2, SEM-GATE-2 0 / 11 (9 targets, 2 co-located q4 rows), SEM-GATE 0 / 33, clean trees 0 / 2, pilot c002 c003 c004 c007 0 / 4 | PASS |
| 5 | 0 hallucinated citations | 0 problems | PASS |
| 6 | Deferred hub p95 < 5 s; no push check waits on a call | p95 check 289 ms (control 290 ms); largest added check time over control 74 ms, against a shortest call of 4,676 ms; the rule fired on the push after the settle | PASS |
| 7 | Reported | 23 gate calls (23 distinct new questions, 1 call each, 0 failed, 0 retries), median 5,512 ms per question; 73 questions answered from the SEM-GATE (49) and SEM-GATE-2 (24) caches at zero calls; 2 calls in the criterion-6 run; **25 model calls in all** | — |

Reported alongside, with no threshold:

- answers: fresh form C 6 `yes` on the 6 positives and 2 `no` on the 2 twins; dev 4 `yes` (3 questions; c001 and c008
  ask the same one); 52 `no` on the 52 negative rows; 0 `unsure`;
- co-located form-C rows in SEM-GATE-2's negative trees: 5 of the 6 §3C positives fire (q1, q2, q3 of hxpb1; q1, q2 of
  hxpb2); `hxpb2-q3` (`BUREAU_STAGE_OF`) does not: the judge read the q3 glossary, which names the renamed stages the
  table leads to, as the domain's own (a §3C positive answered `no`: a miss, not a false positive). Both §3C negative
  rows (`hxpb1-q4`, `hxpb2-q4`, glossary names every key) answer `no`. The 15 co-located rows in positive trees were
  not asked (GATE.md §5);
- seen material: SEM-GATE's 4 form-A and 16 form-B positives still fire (same questions, cached answers).

## Regression (zero calls)

`experiments/v158-dev/evaluate.ts` (every v1.5 rule, no judge) on main (`2de6920fe`, v1.5.9, a frozen copy of `src/`)
and on this branch, over the final trees of the 220 kept Hexagonal study sessions (`origin/results/v15-hx-study`,
commit `5f69990e4482`) with the 11 task seeds, and the 762 dev-set trees the earlier PRs used (HCAL-01..04, HCAL-06,
hx-rules-v3-dev, h11d-dev, d5-unseen, CAL-01..03; HCAL-07 not read): **993 trees, byte-identical** (`regression.ts`, `results/regression.json`: every tree has the same sorted `rule|file|subject|evidence` violation lines on both sides; one sha256 for both). 7 findings on the seeds, 433 on the 220 final trees, 482 on the dev sets, at both versions. R-MIRROR-SEM is not counted and has no judge there, so its count is 0 on both sides.

R-MIRROR-SEM's own candidate census (GATE.md §1, `results/census-diff.json`): no kept study tree gains a candidate;
every earlier candidate keeps its question key.

## Limits

- One author built and labelled the fresh cases, before any judge call; no second rater. The shapes are edits of the
  task reference trees, plus the four pilot trees an agent wrote (dev, they shaped the rule).
- §3C labels a coarser core lookup keyed by the vendor's values as a positive: the core draws the vendor's lines. That
  is a reading of the hexagonal rule, and it makes 6 of SEM-GATE-2's negative trees hold a form-C positive beside their
  (still negative) target. The judge agreed on 5 of 6.
- The twins are negatives only because the domain text names the keys; they test whether the judge reads that text.
- Form C needs the consulting text to trace to the vendor (`traceVendor`, unchanged). A table indexed with text that
  arrives another way (an event payload, a stored row) is not a candidate. A lookup with fewer than 3 keys, or keys
  naming fewer than half of the vendor's values, is not either.
- 6 / 6 and 0 / 52 bound the error rates loosely (0 / 52 is compatible with a true false-positive rate up to about 6 %
  at 95 %; 6 / 6 with a recall down to about 61 %; one-sided).

## Files

`GATE.md` (criteria, fixed first) · `cases.json` (manifest, labels, co-located labels) · `cases/` (8 built trees) ·
`build-cases.py` · `trees.ts` (the gate's trees; pilot and kept trees by `git archive`) · `check-trees.ts`,
`results/tree-checks.json` (tests and tsc) · `census.ts`, `compare-census.ts`, `results/census-*.json` (zero calls) ·
`gate.ts` · `deferred-latency.ts` · `result.json` (per-candidate rows and the criteria) · `results/calls.jsonl` (the
call ledger, one line per call, no prompt text) · `results/judged.jsonl` · `results/latency-calls.jsonl`,
`results/deferred-latency.json` · `cache/` (the new answers by content hash) · `regression.ts`, `results/regression.json` (the counted
regression). `npx tsx experiments/sem-gate-3/gate.ts --latency experiments/sem-gate-3/results/deferred-latency.json`
replays the result with zero calls.
