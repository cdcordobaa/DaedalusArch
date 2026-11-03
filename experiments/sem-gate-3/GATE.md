# SEM-GATE-3: the semantic gate with form C (R-MIRROR-SEM v1.5.10), fixed before any judge call

2026-11-03. Exploratory (neuro-symbolic row H11). R-MIRROR-SEM stays uncounted; no counted rule list changes; no
registered study is rescored. This file, `cases.json`, the built trees under `cases/`, the zero-call census files and
the scripts were committed and pushed **before any judge call**. No agent session is part of this gate. The gate
decides whether instrument v1.5.10 is merged.

## 1. Background: the SEM-2 miss and the change

In the SEM-2 agent pilot (`Docs/DiagnosticRuns/v15-sem2-pilot-2026-11-02.md`; records on `results/v15-sem2`,
commit `669354c95`), four sessions ended with the vendor's states as the keys of an untyped table in the core
service, consulted with the vendor text the port carries:

| Session | Arm | Task | Table | Consulted with |
|---|---|---|---|---|
| c005 | combined | hxpb2 | `STAGES: Readonly<Record<string, string \| undefined>>`, six job states → portal words | `STAGES[s.stateCode]` (`s` from `JobLookup.snapshot`) |
| c001, c008 | none | hxpb2 | `STAGE_BY_STATE`, the same shape | `STAGE_BY_STATE[s.stateCode]` |
| c006 | none | hxpb1 | `PICKUP_STATUS`, seven kiln phases (`scheduled`, `candling`, `ramping`, …) → pickup words | `PICKUP_STATUS[r.phaseCode.toLowerCase()]` |

The judge was never asked in c005 (no line in `run/hub/c005.mirror-sem.jsonl`): v1.5.9 builds no candidate there.

**Why v1.5.9 misses it** (`mirror-sem.ts` v1.5.9; checked on the four trees, `results/census-v1.5.9.json`):

1. The vendor trace works: the adapter copies `job.state` (typed `JobState` in the vendor typings) into
   `JobSnapshot.stateCode`, so `vendorCarriersOf` records the field and `traceVendor(s.stateCode)` returns `JobState`.
   `coreMapsOf` reads the table lookup and makes pairs `posted -> 'FINDING_TRANSLATOR'`, … .
2. A pair counts only as a mapping **into a declared core value set** (a union, enum or const). The table's values are
   plain strings; the port's `Progress.stage` is `string`. No core set holds `'FINDING_TRANSLATOR'` … except the table
   itself (a const object of strings is a value set), and `coreSideCandidate` drops pairs written inside a set's own
   declaration ("a table never fills itself"). So no set has 2 pairs, and no candidate is made.
3. Nothing else reads the table: v1.5.9 treats a set's members as the **targets** of a mapping (form A: a renamed copy
   that vendor text is cast or looked up into). The table's **keys**, which are the vendor's own six values, are never
   read as a copy of the vendor set. Form A needs a declared vendor-derived type or a cast; form C has neither.

**The change (v1.5.10, `keyLookupsOf` / `keyCandidatesOf`), candidate selection only.** A core lookup is a form-C
candidate when:

- it is an object literal (a `const T = {…}`, typed `Record<…>` or not, `as const` or not), a `new Map([[k, v], …])`,
  a `switch`, or an equality chain (`===`, `==`, `!==`, `!=` comparisons of the same text in one function);
- the text it is indexed, read (`get`), switched or compared with traces to vendor text (`traceVendor`, unchanged: a
  vendor value an adapter copies into a port result field or returns from a port method, or a vendor-declared
  property, passed on as is or through a string normalizer, through local variables and parameters, depth 3);
- it has at least 3 distinct keys, and its keys name (by the existing `norm`: case- and separator-insensitive) at
  least half of the values of one vendor set that text carries (at least 2).

The candidate's core set is the **key set** (`coreKind: 'keys'`, `mapSide: 'core'`); its pairs are vendor value → the
key that names it; its branch sites are the index / get / switch / comparison sites. A lookup the baseline core
already has (same name and keys) is `ownedBy: 'baseline'`. A lookup whose name is already an earlier candidate's
core set in the same file keeps the earlier reading. The structure test, the Cypher rule (`applies:` comment only),
the question, the system prompt, the schema, the model and the cache keys are unchanged. The prompt of a form-C
candidate differs only in its mapping heading and one line saying that the core set is the lookup's keys.

**Zero-call evidence** (`results/census-diff.json`, `compare-census.ts`):

- Over the 83 gate trees (§2), v1.5.10 keeps all 97 v1.5.9 candidates with the same asked state and question key,
  removes none, and adds 35, all form C.
- Over the final trees of the 220 kept Hexagonal study sessions and the SEM-GATE / SEM-GATE-2 built trees
  (`experiments/sem-gate-2/census-all.ts`), it keeps all 103 earlier candidates unchanged and adds 23, all form C, all
  in SEM-GATE and SEM-GATE-2 built trees. **No kept study tree gains a candidate.**

## 2. Case sets

**Fresh form C (counted; `cases.json`, 8 built trees, never seen by any judge).** Built after reading only the task
material, the SEM-2 pilot trees and the rule's documented structure. Each tree passes its task's behaviour tests
(hxpb1, hxpb2: 7 of 7; hxa2: 10 of 10) and tsc (strict) with 0 errors (`results/tree-checks.json`). Built by
`build-cases.py` from the reference trees (hxpb1 / hxpb2 `solutions/trap`, with the shortcut's type and cast removed;
hxa2 `solutions/clean`, with the adapter's quote-state mapping moved into the core):

- 6 positives: `hxpb1-c1` (untyped `Record` in a domain file, upper-case vendor spelling, the service upper-cases the
  port text), `hxpb1-c2` (the shortcut's switch on the port text, no type), `hxpb1-c3` (a module `Map` in the service,
  `get`), `hxpb2-c1` (an equality chain in a domain function, 5 of 6 states), `hxpb2-c2` (an `as const` object read
  through a `Record` view), `hxa2-c1` (an untyped table of the five Covernest quote states in the hire service, a
  third vendor task).
- 2 negatives, twins: `hxpb1-d1` (the c1 table in the service) and `hxpb2-d1` (the c005 table), each with
  `ARCHITECTURE.md` naming every key as a domain stage with its own rule (the SEM-GATE-2 q4 glossaries).
- Note: `hxpb1-c2`'s question is byte-identical to the one of the switch that sits beside the target of SEM-GATE
  `hxpb1-a1` (the trap tree); that co-located candidate is not asked (§5), so no judge has seen it.

**Dev form C (`cases.json`, reported against a threshold, not evidence).** The four SEM-2 pilot trees c001, c005,
c006, c008 (final step, `step-03`; the seed `step-00` as baseline). They shaped the rule. c001 and c008 ask the same
question.

**Negatives of this gate (`cases.json`).** The hxpb1 and hxpb2 reference clean trees (`solutions/clean`) and the
final trees of pilot sessions c002, c003, c004, c007 (adapter-side mappings). Every R-MIRROR-SEM firing in these trees
counts.

**Earlier sets, unchanged.** SEM-GATE-2's 20 cases (11 form-A positives, 9 negatives; targets as in its `cases.json`)
and SEM-GATE's 53 (33 negatives, 4 form-A and 16 form-B positives). Their target questions are unchanged (§1), so their
answers come from the committed SEM-GATE and SEM-GATE-2 caches at zero calls.

**Co-located form-C candidates (`cases.json` `colocated`, 23).** v1.5.10 adds a form-C candidate beside the target in
23 earlier trees (the lookup the earlier case used to build its target set). Each is labelled by §3C before any call:
15 sit in positive cases (all §3C positives) and are **not asked** (§5); 8 sit in SEM-GATE-2's negative cases and are
asked: 6 are §3C positives (q1, q2, q3 of both tasks: a coarser core translation still keys a core lookup by the
vendor's values) and 2 are §3C negatives (`hxpb1-q4`, `hxpb2-q4`: the domain glossary names every key).

## 3. Labelling rules

**3A/3B (form A and B): SEM-GATE `GATE.md` §3, unchanged.**

**3C (form C).** A case is a core lookup L (table, Map, switch or equality chain) consulted with vendor text, and the
vendor value set V that text carries.

- 3C.1 **Negative** if any of: L has fewer than 3 distinct keys; its keys name fewer than half of V's values; the
  consulting text does not reach the core from the vendor as is (an adapter mapped it); at least half of L's keys
  appear, case- and separator-insensitively, in the domain's own text (the task's `spec.yaml` and the tree's
  `ARCHITECTURE.md` / glossary / domain docs).
- 3C.2 **Positive** otherwise: the core draws the vendor's distinctions itself, as the keys of its own lookup, whatever
  the lookup returns (one for one or coarser). The vendor's vocabulary decides the core's branches, so a vendor that
  adds, splits or renames a value changes the core.

Labels and a one-line reading per case are in `cases.json`. The zero-call label sheet (`results/census-v1.5.10.json`,
field `sheet`) supports every form-C label: the 6 fresh positives and the 4 dev trees have 0 keys in domain text; the 2
fresh twins and the 2 q4 rows have every key in domain text; the 6 co-located q1–q3 rows have at most 2 of 6 or 7.

## 4. Criteria (all must hold for PASS)

| # | Criterion | Measured as |
|---|---|---|
| 1 | Form A still caught: 11 / 11 on the SEM-GATE-2 fresh form-A targets | the rule (`runTree`, R-MIRROR-SEM only, the frozen Cypher, v1.5.10) reports a violation whose file and subject are the target |
| 2 | Form-C recall ≥ 0.80 on the 6 fresh positives | as 1 |
| 3 | Dev form C: at least 3 of the 4 pilot trees fire | as 1 (development material, required but not evidence) |
| 4 | 0 false positives | every row labelled negative: the 2 fresh twins; SEM-GATE-2's 9 negative targets and the 2 negative co-located rows; SEM-GATE's 33 negative targets; every candidate of the 2 clean trees and of pilot c002, c003, c004, c007 |
| 5 | 0 hallucinated citations | SEM-GATE criterion 3, unchanged, on every finding and every judged answer |
| 6 | Deferred hub p95 < 5 s; no push check waits on a call | `deferred-latency.ts` (the SEM-GATE-2 script; seed the hxpb2 clean tree, arriving copy the c005 final tree): 21 pushes per cell, a deferred judge against no judge. Pass: deferred p95 check < 5 s and every push's added check time over control < min(1 s, the shortest model call made) |
| 7 | Reported, no threshold | model calls (ledger lines), calls per distinct question, median call latency, the latency run's calls, the co-located rows, seen form-A / form-B recall, answer counts per set |

An `unsure` answer, a failed call and an unasked candidate never fire.

## 5. Procedure

1. Commit and push this file, `cases.json`, `cases/`, the census files, `build-cases.py`, `trees.ts`, `census.ts`,
   `compare-census.ts`, `check-trees.ts`, `gate.ts` and `deferred-latency.ts`, with the v1.5.10 code and unit tests
   (before any call).
2. `npx tsx experiments/sem-gate-3/deferred-latency.ts --out experiments/sem-gate-3/results/deferred-latency.json`.
3. `npx tsx experiments/sem-gate-3/gate.ts --live --latency experiments/sem-gate-3/results/deferred-latency.json --out experiments/sem-gate-3/result.json`
   once. A question SEM-GATE or SEM-GATE-2 asked is answered from its cache (zero calls). Every other asked question is
   asked once (session map and disk cache `cache/`), one retry on an invalid answer. A form-C candidate co-located in
   a positive case is not asked, to keep the call count down: it cannot fire and no criterion reads it. Every call is a
   line of `results/calls.jsonl` (gate) or `results/latency-calls.jsonl` (criterion 6). Claude CLI judge route only
   (`claude-opus-5-5`); nothing goes to any other provider. The judge prompt is the rule's plain classification
   question.
4. Commit the result, the ledgers and the cache; a re-run without `--live` replays at zero calls.
5. If PASS: the v1.5.10 PR goes to main. If FAIL: the record is pushed to the branch, no PR is opened.

No case, label, criterion or script is changed after step 1. A defect found after the run is reported in the
README, not fixed in place.
