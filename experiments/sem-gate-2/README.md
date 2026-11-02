# SEM-GATE-2: result

**Verdict: PASS.** The run was on 2026-11-02, once, with the live judge, on instrument v1.5.9 (v1.5.8 plus the
core-side candidates). Exploratory, not confirmatory; R-MIRROR-SEM stays uncounted. The criteria, the labelling rule
and the 20 fresh cases are in `GATE.md` and `cases.json`. They were committed and pushed in `069494e8a` before the
first judge call.

| # | Criterion | Value | Verdict |
|---|---|---|---|
| 1 | Form-A recall ≥ 0.80 on the fresh positives | 11 / 11 = 1.00 | PASS |
| 2a | FP ≤ 1 on the fresh negatives (4 twins included) | 0 / 9 | PASS |
| 2b | FP ≤ 1 on SEM-GATE's 33 negatives, under v1.5.9 | 0 / 33 | PASS |
| 3 | 0 hallucinated citations | 0 problems (73 cases: 20 fresh, 53 original) | PASS |
| 4 | Deferred hub p95 < 5 s; no push check waits on a call | p95 check 240 ms (control 276 ms); largest added check time over control 23 ms, against a shortest call of 5,115 ms | PASS |
| 5 | Reported | 24 gate calls (24 distinct new questions, 1 call each, 0 failed, 0 retries), median 5,315 ms per question; 49 questions answered from the SEM-GATE cache at zero calls; 2 more calls in the criterion-4 run, and the rule fired on the push after the settle | — |

Reported alongside, with no threshold:

- the judge's answers on the fresh set: 11 `yes` on the 11 positives, 9 `no` on the 9 negatives, 0 `unsure`;
- seen material: the 4 SEM-GATE form-A cases now become candidates and all 4 fire (they were 0 / 4 in SEM-GATE); the
  16 form-B cases still fire (16 / 16); the 33 original negatives get the same 33 `no` answers as in SEM-GATE (their
  questions are unchanged, answered from the SEM-GATE cache).

## Candidate-set changes on the old cases (zero calls)

`results/census-diff.json`: over the 12 SEM-GATE built trees and the final trees of the 220 kept Hexagonal study
sessions, v1.5.9 keeps all 75 earlier candidates with the same asked state and question key and adds 4, exactly the 4
SEM-GATE form-A targets. No kept study tree gains a candidate. The same holds on top of v1.5.8.

## Reading

With the widened candidate selection, the judge separates core-side renamed copies from domain-owned sets on every
case it was shown, in casts, lookup tables, `Map`s, switch, if and conditional chains, in domain and service files,
and through a port method. That includes both twins of the shortcut cast, where the same seven or six vendor words
are named in the domain's own text as the domain's stages. It also includes the coarser core-side mappings. The
deferred mode keeps the push check at its symbolic cost. An agent run on hxpb1 and hxpb2 is now worth making, so
`AGENT-RUN-PLAN.md` is written. It has not been run.

## Limits

- Every fresh case was built by one author from the task's reference trees (18) or a kept agent tree (2), and labelled
  by the written rule before any judge call. There is no second rater. The built shapes are edits that an author
  chose, not agent output. An agent run is the test of the shapes agents actually write.
- The twins are negatives only because the domain text names the members (§3.1). The judge reads that text, so they
  test whether the judge uses it, not a harder semantic distinction.
- The candidate structure traces vendor text through adapter result fields and port methods, local variables and one
  level of function parameters, up to depth 3. A copy that reaches the core by another route (an event payload, a
  repository row that stores the vendor text, a generic `Record<string, unknown>`) is not a candidate. The census shows
  no such case in the kept study trees, but the study tasks were not built to elicit it.
- Perfect scores on 20 + 33 cases bound the error rate only loosely (for example, 0 / 9 false positives is compatible
  with a true rate of up to about 30 % at 95 %).

## Files

`GATE.md` (criteria, fixed first) · `cases.json` (manifest and labels) · `cases/` (20 built trees) · `build-cases.py`
(the hxpb rewrites) · `check-trees.ts`, `results/tree-checks.json` (tests and tsc) · `census-all.ts`,
`compare-census.ts`, `results/census-*.json` (zero calls) · `results/label-sheet-fresh.json` (zero calls) · `gate.ts` ·
`deferred-latency.ts` · `result.json` (per-case rows and the criteria) · `results/calls.jsonl` (the call ledger, one line
per call, no prompt text) · `results/judged.jsonl` (one answer per judged case) · `results/latency-calls.jsonl`,
`results/deferred-latency.json` (criterion 4) · `cache/` (the new answers by content hash). `npx tsx
experiments/sem-gate-2/gate.ts --latency experiments/sem-gate-2/results/deferred-latency.json` replays the result with
zero calls.
