# SEM-GATE: result

**Verdict: FAIL** (criterion 1a). The run was on 2026-11-02, once, with the live judge. Exploratory, not confirmatory.
The criteria, the labelling rule and the 53 cases are in `GATE.md` and `cases.json`. They were committed and pushed
in `3f12c1dcd` before the first judge call.

| # | Criterion | Value | Verdict |
|---|---|---|---|
| 1a | Recall ≥ 0.80, form A (core-side renamed copy, no adapter mapping) | 0 / 4 = 0.00 (no candidate in any of the 4 trees; the judge is never asked) | **FAIL** |
| 1b | Recall ≥ 0.80, form B (adapter-mapped renamed copy) | 16 / 16 = 1.00 | PASS |
| 2 | False positives ≤ 1 on 33 negatives (2 hard twins included) | 0 / 33 | PASS |
| 3 | 0 hallucinated citations | 0 problems (53 cases, 16 findings, 49 reasons) | PASS |
| 4 | Deferred mode: hub p95 < 5 s, no push check waits on a call, fires once the answer is in | p95 check 490 ms (control 492 ms); largest added check time over control 284 ms, against a shortest call of 6,686 ms; push 1 did not fire (pending), push 21 after the settle fired | PASS |
| 5 | Reported | 49 gate calls (49 distinct questions, 1 call each, 0 failed, 0 retries), median 4,631 ms per judged case; 2 more calls in the criterion-4 run | — |

Reported alongside, with no threshold:

- pooled recall over all 20 positives: 16 / 20 = 0.80;
- the judge's answers on the cases it was asked: 16 `yes` out of 16 positives and 33 `no` out of 33 negatives,
  0 `unsure`. Both hard twins (`hxpb1-n2`, `hxpb2-n2`: one-for-one synonym sets that the domain text names) got `no`,
  and their untwinned copies (`b2`) got `yes`.

## Reading

The judge separates renamed copies from domain-owned sets on every case it was shown. That includes 12 renamed copies
that agents actually wrote during the Hexagonal study, such as `CoverPolicy.status` `in_force | pending_docs |
voided` or `active | awaiting_paperwork | void` for Covernest's three policy states, and `Redemption.result`. None of
the scored rules saw those copies, because the study ran with the judge off. Deferred mode keeps the push check at
its symbolic cost.

The gate fails on form A. hxpb1 and hxpb2 were built to draw out that shape: the vendor code already reaches the core
as text, and the one-file shortcut casts it to a copy in the service. R-MIRROR-SEM only asks its question when an
outbound adapter maps vendor values onto the core set (`structureHolds`). Form A has no such mapping, so there is no
candidate and the rule can't fire. This is the B11 blind spot, confirmed with zero calls before the run (`GATE.md`
§2). An agent run on hxpb1 and hxpb2 with the current rule would measure nothing for the shortcut those tasks are
built for. So no agent-run plan is written.

To make the run worthwhile, the rule's structure would have to be widened to core-side copies: a core value set
filled from vendor text through a cast or a core lookup. That is a rule change inside the frozen root, so it needs a
new instrument version, and it is out of scope here. It would be checked again on new form-A cases, because the four
cases here have been seen.

## Limits

- The kept cases are agent-written, but many share a shape: 11 of the 12 kept positives are hxa2 `CoverPolicy`
  variants, and the kept negatives are f2, f14 and hxa2 `CoverQuote` sets that are coarser than the vendor's. Each
  distinct question counts once.
- One author labelled every case by the written rule in `GATE.md` §3, before any judge call. There is no second rater.
- The built form-B and twin cases are small edits of the task's reference trees.

## Files

`GATE.md` (criteria, fixed first) · `cases.json` (manifest and labels) · `cases/` (12 built trees) · `census.ts`,
`label-sheet.ts` (zero calls) · `gate.ts` · `deferred-latency.ts` · `result.json` (per-case rows and the criteria) ·
`results/calls.jsonl` (the call ledger, one line per call, no prompt text) · `results/judged.jsonl` (one answer per
judged case) · `results/latency-calls.jsonl`, `results/deferred-latency.json` (criterion 4) · `cache/` (the answers
by content hash). `npx tsx experiments/sem-gate/gate.ts --latency experiments/sem-gate/results/deferred-latency.json`
replays the result with zero calls.
