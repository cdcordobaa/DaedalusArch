# SEM-GATE-2: the semantic gate again, with core-side candidates (R-MIRROR-SEM v1.5.9), fixed before any judge call

2026-11-02. Exploratory (neuro-symbolic row H11). R-MIRROR-SEM stays uncounted; no counted rule list changes; no
registered study is rescored. This file, the case manifest `cases.json`, the built trees under `cases/`, the zero-call
census and the scripts were committed and pushed **before any judge call**. The gate decides, as SEM-GATE did, whether
an exploratory agent run on hxpb1-pottery-kiln and hxpb2-translation-portal, with R-MIRROR-SEM in deferred mode, is
worth making. No agent session is part of this gate.

## 1. Background and the change

SEM-GATE (`experiments/sem-gate/`, PR 482) failed on one criterion only, form-A recall (0 / 4). Form A is a
**core-side renamed copy**: the vendor value reaches the core as text and the core casts it, or looks it up, into a
core value set, with no outbound-adapter mapping. v1.5.8 asked the judge only when an outbound adapter mapped vendor
values onto the core set, so form A never became a candidate.

Instrument v1.5.9 (`src/v15-instrument/mirror-sem.ts`, `coreMapsOf`, `coreSideCandidate`) widens **candidate
selection only**:

- A core value set (union, enum, const object or array; at least 3 members; in a domain, application or port file)
  that no adapter maps into is also a candidate when the core fills it from **vendor text**: through a cast to the set
  (`x as CoreSet`; members matched case- and separator-insensitively), a lookup table or `Map` keyed by the text, or a
  switch / if / conditional chain on the text.
- **Vendor text** is a value whose source is a vendor-declared property (a declaration file or `node_modules`), typed
  as a vendor value set, which an adapter copies into a field of a port's result or returns from a port method,
  passed on as is or through a string normalizer only (`toLowerCase`, `String(x)`, a bare template, `?? ''`). The core
  read is traced through local variables and through a function's parameter to its call sites (depth 3). A value the
  adapter maps is not vendor text; a core set filled from text with no vendor source is never a candidate.
- The rest is unchanged: the structure test (`structureHolds`: at least 2 vendor values onto at least 2 members, a
  core branch on the set, not baseline-owned), the Cypher rule, the judge's question, system prompt, schema, model
  and cache keys. The one prompt difference for a core-side candidate is the mapping table's heading, which says the
  mapping is in the core (`in the core: the vendor value reaches the core as text`) instead of in the outbound adapter.
- Every earlier candidate is unchanged: a set an adapter maps into keeps the v1.5.8 reading, byte for byte.

**Zero-call evidence that the widening is narrow** (`results/census-v1.5.7.json`, `results/census-v1.5.9.json`,
`results/census-diff.json`, `census-all.ts`, `compare-census.ts`): over the 12 SEM-GATE built trees and the final
trees of all 220 kept Hexagonal study sessions, v1.5.9 keeps all 75 earlier candidates with the same asked state and
the same question key, removes none, and adds 4: exactly the 4 SEM-GATE form-A targets (`hxpb1-a1` KilnPhase,
`hxpb1-a2` KilnStage, `hxpb2-a1` MarketState, `hxpb2-a2` JobStep), all asked. No kept study tree gains a candidate.
The form-B candidates and the 33 negatives' candidate sets are therefore unchanged, and their questions are the ones
SEM-GATE already asked. The v1.5.9 census was made on v1.5.7 plus this change; the same census on v1.5.8 (PR 483,
head `20499e183`) plus this change, the code the gate runs on, is identical (79 candidates, 56 asked, every key equal).

## 2. Case sets

**Fresh set (counted; `cases.json`, 20 cases, never seen by any judge).** Built after reading only the task material,
the rule's documented structure and the SEM-GATE record; no judge answer on any of them exists. Every tree passes its
task's behaviour tests (hxpb1, hxpb2: 7 of 7; hxa2: 10 of 10) and tsc (strict) with 0 errors
(`results/tree-checks.json`, `check-trees.ts`). Every target is an asked R-MIRROR-SEM candidate under v1.5.9 (zero-call
census).

- From the hxpb1 / hxpb2 reference shortcut trees (`solutions/trap`, rewritten by `build-cases.py`), per task:
  5 form-A positives, each a different filling construct and place (hxpb1: a cast to an exported domain copy; a
  domain switch into a renamed union; a service `Map` into a renamed const object; a service if chain on the
  upper-cased text into a renamed enum; a new port method returning the vendor value, lower-cased and cast. hxpb2: a
  domain table into a renamed enum; a cast to an exported same-spelling domain copy; a domain if chain into a renamed
  union; a service `Map` into a renamed const object; a conditional chain into a renamed union) and 4 negatives that
  are candidates (2 coarser core-side mappings, the clean set and a second cut; 2 hard twins: a one-for-one renamed
  table and the shortcut's own cast, each with `ARCHITECTURE.md` naming every member as a domain term with its own
  rule).
- From kept Hexagonal study tree `c020` (hxa2-canal-boats, agent-written, branch `results/v15-hx-study` commit
  `5f69990e4482`, final step): `hxa2-p1`, the adapter's policy-state mapping moved into the core (the adapter copies
  the vendor state into `CoverPolicy.insurerState`; a domain table maps it onto a renamed 3-member standing), and
  `hxa2-q1`, the quote-cover mapping moved into the core (a domain switch maps 2 of the vendor's 5 quote states, the
  rest fall to `none`).
- Totals: **11 form-A positives, 9 negatives (4 twins)**.

**Original set (SEM-GATE's 53 cases, read from `experiments/sem-gate/cases.json`).** The 33 negatives are the
criterion-2b set. The 4 form-A positives are seen material: reported, not counted. The 16 form-B positives are
reported. Their questions are unchanged (§1), so their answers come from the committed SEM-GATE cache at zero calls;
the 4 form-A questions are new and are asked once.

## 3. Labelling rule (SEM-GATE `GATE.md` §3, unchanged; applied by reading the code)

A case is a core value set C (the target: file and set name in `cases.json`) and the vendor value set V it is taken
from. Read the code that turns a vendor value into a core member (adapter or core) and write the full mapping V → C
(a vendor value not named in the code goes where the default branch sends it).

3.1 **Negative** if any of: |C| < 3; two or more vendor values map onto the same core member (C is coarser); some core
member is reached by no vendor value; at least half of C's members appear, case- and separator-insensitively, in the
domain's own text (the task's `spec.yaml` and the tree's `ARCHITECTURE.md` / glossary / domain docs).

3.2 **Positive** (renamed copy) otherwise: (a) |C| ≥ 3; (b) the mapping is one to one; (c) it reaches every member of
C; (d) the domain text does not name C's members. Spelling does not matter.

Labels and a one-line reading per case are in `cases.json`. The zero-call label sheet (`experiments/sem-gate/label-sheet.ts`
on the fresh list) supports every label: the 11 positives have one-to-one mappings onto every member (in `hxpb1-p4`
and `hxpb2-p5` the last vendor value reaches the last member through the final return, read as §3 says) and 0
members named in domain text; 5 negatives are coarser (in `hxpb2-q2` the sheet does not read the `||` branch that
sends `claimed` and `drafting` onto `inWork`; the code reading settles it) and the 4 twins have every member named in
the domain text.

## 4. Criteria (all must hold for PASS)

| # | Criterion | Measured as |
|---|---|---|
| 1 | Form-A recall ≥ 0.80 on the 11 fresh positives | the rule (`runTree`, R-MIRROR-SEM only, the frozen Cypher, v1.5.9) reports a violation whose file and subject are the case's target set |
| 2a | False positives ≤ 1 on the 9 fresh negatives (twins included) | as 1, on the fresh negatives |
| 2b | False positives ≤ 1 on SEM-GATE's 33 negatives, under v1.5.9 | as 1, on the original negatives |
| 3 | 0 hallucinated citations, every case of both sets | SEM-GATE criterion 3, unchanged (finding `file:line` and evidence sites exist; in every model reason every path names a file of the tree, every `file:line` exists, every quoted code-like token occurs in the prompt, no line number is cited) |
| 4 | Deferred hub p95 < 5 s | `deferred-latency.ts` (the SEM-GATE script; the arriving copy is now the core-side shortcut `hxpb1-a1`): one hub cell with the deferred judge, one control cell with no judge, 21 pushes each. Pass: deferred p95 check < 5 s, and every push's added check time over control < min(1 s, the shortest model call made) |
| 5 | Reported, no threshold | model calls (ledger lines), calls per distinct question, median call latency per question, the latency run's calls, whether the rule fires on the push after the settle, seen form-A and form-B recall, the answer counts per set |

An `unsure` answer, a failed call and an unasked candidate never fire (the rule's own semantics): a miss on a
positive, non-firing on a negative.

## 5. Procedure

1. Commit and push this file, `cases.json`, `cases/`, the census files, `build-cases.py`, `check-trees.ts`,
   `census-all.ts`, `compare-census.ts`, `gate.ts` and `deferred-latency.ts` (before any call).
2. `npx tsx experiments/sem-gate-2/deferred-latency.ts --out experiments/sem-gate-2/results/deferred-latency.json`.
3. `npx tsx experiments/sem-gate-2/gate.ts --live --latency experiments/sem-gate-2/results/deferred-latency.json --out experiments/sem-gate-2/result.json`
   once. A question SEM-GATE asked is answered from `experiments/sem-gate/cache` (zero calls); every other question is
   asked once (session map and disk cache `cache/`), one retry on an invalid answer. Every call is a line of
   `results/calls.jsonl` (gate) or `results/latency-calls.jsonl` (criterion 4); every answer a line of
   `results/judged.jsonl`. Claude CLI judge route only (`claude-opus-5-5`); nothing goes to any other provider.
4. Commit the result, the ledgers and the cache; a re-run without `--live` replays at zero calls.
5. If PASS, write `AGENT-RUN-PLAN.md` (exploratory; not run here).

No case, label, criterion or script is changed after step 1. A defect found after the run is reported in the
README, not fixed in place.
