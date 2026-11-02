# SEM-GATE: zero-agent gate for the semantic layer (R-MIRROR-SEM), fixed before any judge call

2026-11-02. Exploratory (neuro-symbolic row H11). This file, the case manifest `cases.json`, the built cases under
`cases/` and the scripts were committed and pushed **before any judge call**. The gate decides whether an
exploratory agent run on the renamed-copy tasks hxpb1-pottery-kiln and hxpb2-translation-portal, with R-MIRROR-SEM in
deferred mode, is worth making. No agent session is part of this gate.

## 1. Background

- R-MIRROR-SEM (`src/v15-instrument/mirror-sem.ts`, rule `rules/r-mirror-sem-vendor-value-set.cypher`, version
  `r-mirror-sem-v1`, model `claude-opus-5-5`) fires when a symbolic structure holds (a core value set of at least 3
  members, an outbound adapter mapping at least 2 vendor values onto at least 2 of its members, a core branch on it,
  not in the baseline) and the model fact says the set mirrors the vendor's distinctions.
- In the Hexagonal study, pilot run 1 stopped on hub latency with the live judge inside the push check (DEV-HX-1,
  `Docs/v1.5/hexagonal-study-preregistration.md` §6). The deferred mode (`DAEDALUS_MIRROR_SEM=deferred`, PR 462) moves
  the call off the check path.
- hxpb1 and hxpb2 were dropped from that study (B11): their reference shortcuts reach the core as an opaque string
  and are cast to a lower-cased copy in the service, with no adapter mapping, so R-MIRROR-SEM has no candidate there.

## 2. Case set and why it is new

Every labelled case in `experiments/sem-mirror-dev/` (synthetic cases, trap-family solutions, HCAL-04/05 trees) was
used to develop the rule and its prompt, and HCAL-06 was used to score it, so none of them is used here. The gate set
(`cases.json`, 53 cases) is new:

- **Built from the hxpb1 / hxpb2 task material (12 cases, `cases/<id>/tree`).** Per task: `a1` the reference
  shortcut tree (copied unchanged); `a2` a core-side renamed copy (a core enum or const object with renamed members,
  filled from the vendor text by a lookup in the core); `b1` the adapter maps every vendor value one for one onto a
  core set spelled like the vendor values (case changed); `b2` the same with renamed synonyms; `n1` the reference
  clean tree (copied unchanged); `n2` a hard twin of `b2` (the same one-for-one set, but `ARCHITECTURE.md` names every
  member as a domain term with its own rule). All 12 trees pass the task's behaviour tests (7 of 7) and tsc (strict) with
  0 errors. Built after reading only the task material, the rule's documented structure and the B11 record; no judge
  answer was seen. The `n1` questions were asked once before, for the B11 visibility record (both `no`); they were
  not used for tuning and are asked again here with a fresh cache.
- **Kept agent trees of the Hexagonal study (41 cases).** Branch `results/v15-hx-study`, commit `5f69990e4482`, the
  final tree (`snap/step-03`) of every one of the 220 sessions, baseline `snap/step-00`. The study ran with the judge
  off, so none of these questions was ever asked. The census (`census.ts`, zero calls) found 44 asked candidates in
  those trees, 41 distinct questions (content-hash keys); each distinct question is one case (its first tree).

Forms of a positive:

- **Form A**: core-side renamed copy, no adapter mapping (the shape the hxpb tasks are built to elicit: lever (a),
  the vendor code already reaches the core as text). 4 cases (`hxpb1-a1`, `hxpb1-a2`, `hxpb2-a1`, `hxpb2-a2`).
- **Form B**: adapter-mapped renamed copy. 16 cases (4 built, 12 kept).

Totals: 20 positives (4 A, 16 B), 33 negatives (2 reference clean trees, 2 hard twins, 29 kept agent sets).

**Fact known before the run (census, zero calls).** No form-A case has an R-MIRROR-SEM candidate (the structure
needs an adapter mapping), so criterion 1a cannot pass with the current rule whatever the judge answers. The gate is
still run as registered: the judge's behaviour on form B and on the negatives is what a widened rule would rely on.

## 3. Labelling rule (written before judging; applied by reading the code)

A case is a core value set C (the target: file and set name in `cases.json`) and the vendor value set V it is taken
from. Read the code that turns a vendor value into a core member (adapter or core) and write the full mapping
V → C (a vendor value not named in the code goes where the default branch sends it).

3.1 **Negative** if any of: |C| < 3; two or more vendor values map onto the same core member (C is coarser); some
core member is reached by no vendor value; at least half of C's members appear, case- and separator-insensitively, in
the domain's own text (the task's `spec.yaml` and the tree's `ARCHITECTURE.md` / glossary / domain docs).

3.2 **Positive** (renamed copy) otherwise, that is: (a) |C| ≥ 3; (b) the mapping is one to one; (c) it reaches every
member of C, so V and C correspond one for one; (d) the domain text does not name C's members. Spelling does not
matter: a case change, a synonym or the same word all count.

Labels are in `cases.json` with a one-line note per case. For the kept cases the counts settle most labels: every
kept f2 / f14 / CoverQuote set has fewer members than its vendor set (3.1, coarser); the 11 kept hxa2 CoverPolicy
sets and the hxa3 `Redemption.result` set are 3-for-3 one-to-one mappings that no domain text names (3.2).

## 4. Criteria (all must hold for PASS)

| # | Criterion | Measured as |
|---|---|---|
| 1a | Recall ≥ 0.80 on form-A positives | the rule (`runTree`, R-MIRROR-SEM only, the frozen Cypher) reports a violation whose file and subject are the case's target set |
| 1b | Recall ≥ 0.80 on form-B positives | as 1a |
| 2 | False positives ≤ 1 on the 33 negatives (twins included) | as 1a, on negatives |
| 3 | 0 hallucinated citations | every finding's `file:line` and every `file:line` in its evidence exists in the tree; in every model reason, every file path names a file of the tree, every `file:line` exists, every quoted code-like token occurs in the prompt the judge was shown, and no reason cites a line number (the prompt gives none) |
| 4 | Deferred mode adds no model call on the push path | `deferred-latency.ts`: one hub cell with the deferred judge and one control cell with no judge, 21 pushes each (the renamed copy `hxpb1-b2` arrives at push 1; 19 unrelated edits; the hub settles; 1 more edit). Pass: deferred p95 check < 5 s; every push's added check time over control < min(1 s, the shortest model call made); and R-MIRROR-SEM fires on the push after the settle |
| 5 | Reported, no threshold | model calls (ledger lines), calls per distinct question, median call latency per judged case |

Why criterion 1 is split by form (a change from the proposed single recall): the dev material (B11 record, and the
census above) shows that form A never reaches the judge, so a pooled recall's verdict would depend on the chosen mix
of forms. Reported alongside, with no threshold: pooled recall over all 20 positives, and the judge's `yes` rate on
the positives it was asked about.

An `unsure` answer, a failed call and an unasked candidate never fire (the rule's own semantics); they count as
misses on positives and as non-firing on negatives.

## 5. Procedure

1. Commit and push this file, `cases.json`, `cases/`, `census.ts`, `label-sheet.ts`, `gate.ts` and
   `deferred-latency.ts` (before any call).
2. `npx tsx experiments/sem-gate/deferred-latency.ts --out experiments/sem-gate/results/deferred-latency.json`.
3. `npx tsx experiments/sem-gate/gate.ts --live --latency experiments/sem-gate/results/deferred-latency.json --out experiments/sem-gate/result.json`
   once. One call per distinct question (session map and disk cache `cache/`), one retry on an invalid answer. Every
   call is a line of `results/calls.jsonl` (gate) or `results/latency-calls.jsonl` (criterion 4); every answer a line
   of `results/judged.jsonl`. Nothing goes to any other provider.
4. Commit the result, the ledgers and the cache; a re-run without `--live` replays at zero calls.

No case, label, criterion or script is changed after step 1. A defect found after the run is reported in the
README, not fixed in place.
