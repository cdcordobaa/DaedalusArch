# Judge CHECK-3: rebuilt layered clean controls, decision rule and call budget

> **Pre-registration of the next judge run, written 2026-10-16 and committed before any CHECK-3 judge call.** No judge or LLM call was made to prepare it. The only model involved was the `mock` provider (prompt harvest). The items, prompts and hashes in §3 were committed in the commit before this document, on branch `v1.3-check3-bases`. Nothing in §3 to §6 may be changed after the first CHECK-3 call. A change before that call is an amendment: it is committed with its date and reason, and it is listed in the run report.
>
> **Development set, not a registered SO3 result.** CHECK-3 is author-written material, like CHECK-2. 117 of its 138 prompts were already judged in CHECK-2 (§3.3).

Context:
- `Docs/v1.3/judge-v22-plan.md` (CHECK-2 plan; its §5 is the decision rule reused here);
- `Docs/DiagnosticRuns/v1.3-judge-v22-check2-2026-10-16.md` (PR #191; CHECK-2 result: NOT CANDIDATE on D1);
- `Docs/DiagnosticRuns/v1.3-judge-check3-bases-2026-10-16.md` (what changed in the bases, and the self-check result).

## 1. Why a CHECK-3

CHECK-2 had a defect in how the test data was built:
- Every layered base had one business service that injected the persistence layer's `PrismaService` and called `prisma.<model>.create/findMany` itself. It sat next to services that go through gateways.
- It was put there on purpose, because it is the only shape on which `AP-REPO-BYPASS` places a site in closed layering.
- But it made every clean FF-N01 business directory unit a bypass already. Both Claude judges and Gemini failed all 6 of those units, in 3 of 3 runs, citing "skips the module's own persistence abstraction".

Consequences:
- **D1 could not hold for any judge.** 6 of its 21 units were failed by construction. The ≤ 1 bound was unreachable whatever the rubric did.
- **CHECK-2 has no usable FF-N01 evidence.** The 7 layered and nestjs `AP-REPO-BYPASS` "catches" were the base's verdict, not the seed's. REPO-BYPASS paired catch was 3/10, and only the three `MO-DF01` seeds counted.

CHECK-3 fixes the data, not the judge.

## 2. What changed, and what did not

**Changed: the six layered bases** (`tests/fixtures/v1.3-check3/`, see its README).
- **The clean base is clean.** In each base, the one `PrismaService` business service now injects a new persistence class (gateway, DAO, table, store or repository, named like the base's others). Its class name, method names, signatures and behaviour are kept. `main.ts` wires the new class.
- **The bypass exists only in the seeded variant.** The CHECK-2 version of that service, and of `main.ts`, is kept byte for byte in `<base>/seed-overlay/`. The seeder lays the overlay over a copy of the base only for the `AP-REPO-BYPASS` seed, draws the site there, and applies the unchanged operator.
- **The twin is built on the clean base.** `AP-REPO-BYPASSn` is applied to the clean base, on the same class and method, to the gateway field. The result is `const <field> = this.<field>;`, so the calls still go through the gateway.

**Unchanged.**
- **The four non-layered bases.** They are read from `tests/fixtures/v1.3-check2/`, and their tree sha256 equals the CHECK-2 manifest (self-check S5).
- **Every spec and seed-spec.** `spec.yaml` and `seed-spec.yaml` are byte-identical to CHECK-2.
- **The operators and the frozen catalogue.**
- **The salt (`daedalus-v1.3-judge-v22-check2-20261016`) and the apply seed (`20261015`).**
  - Every one of the 40 seed draws lands on the same file, class and method as in CHECK-2. That includes the six layered REPO-BYPASS seeds, which draw on the overlay.
  - The 40 twins are paired the same way, except that the six layered REPO-BYPASS twins are now matched `same-member-clean-base`.
- **The selection, normalisation and comment rules** (`judge-v22-plan.md` §3.3 and §3.4).
- **The harness.**
  - `scripts/v1.3/judge-v22-check2.ts` gains `--set check3`. Without it, the script reproduces CHECK-2 byte for byte: `seed --check` matches manifest `fbae6cf4…`.
  - The scorer applies the same `decide` function.

**Known and kept: the fleet `FleetError` slip.** The base's `FleetError` carries HTTP status codes. v2.2 failed the clean FF-N02 unit `MaintenanceService.ts` on the delivery-type clause in CHECK-2 (report §0). The task kept every other part of the bases unchanged so that results stay comparable, so this unit is still in D1. Its prompt is byte-identical to CHECK-2. Stating it now: if the candidate fails it again, the candidate needs **0** false fails on the other 20 D1 units.

## 3. Items and frozen artefacts

### 3.1 Composition

Same structure as CHECK-2 (the item ids are equal apart from the `check3|` prefix):

| | Count |
|---|---|
| Targets | 90 (40 seeds, 40 twins, 10 clean bases) |
| Items | **138** (50 seed units, 40 twin units, 48 clean units) |
| Clean units, by function | FF-N02 41, FF-N01 7 |
| **Layered business clean units (D1)** | **21** (FF-N02 15, FF-N01 6) |
| Items, by function | FF-N01 21, FF-N02 117 |

### 3.2 Hashes (sha256)

| Artefact | sha256 |
|---|---|
| `results/v1.3-judge-check3/check3-seed-manifest.json` (80 rows, 0 not ok; base and overlay tree hashes inside) | `ec56b0979705d90c909282aa8fd66476995fa5850d9e3299bafc13f7d5c4ee56` |
| `results/v1.3-judge-check3/check3-split.json` | `75d6b242b1b3d94f1222898a2afb6a66237668e8825770629929b3331a700370` |
| CHECK-3 item list (`itemsSha256` in the split) | `50670a6b514328fca2f32a96dcef7c27e0d51b2256f4d47b897c1320937008b4` |
| `results/v1.3-judge-check3/prompts/check3-v1.json` | `e1d9a02f825edc56a409e97f9dc247608e518fd3ce892a9f7ca96e9ee4d2ceb4` |
| `results/v1.3-judge-check3/prompts/check3-v2.2.json` | `419eecb46bdf3a57c0dec84bc06c34e786fb59e13c2ee74b1aad5202081d3067` |
| v1 judge texts (`FROZEN_SHA256`) | `f8b2dabb865107b5f315c82f7917a3ae1ee265136ffcc733db4f530c76eaec5a` |
| v2.2 judge texts (`JUDGE_V22_SHA256`) | `1915fb117f43cb2d13d43675887a46fcb6f6546eda8f369034a1738501ce22c6` |

**Reproducibility.**
- `seed --set check3 --check` regenerates the manifest byte for byte. `plan --set check3 --check` regenerates the split byte for byte. Both were verified in a second, independent work dir.
- The prompts were harvested with the product path, as for CHECK-2 (`judge-v22-plan.md` §3.6):
  - mock provider, local throwaway Neo4j 5.26, under `env -i`;
  - no `[REDACTED]` marker, and no work-dir path, row id, operator id or base id in any prompt;
  - all 138 v2.2 prompts carry the style line, and no v1 prompt does.

### 3.3 What is new against CHECK-2

21 of 138 prompts differ from CHECK-2 in each arm. The other 117 are byte-identical. The 21 are exactly the units that read the rebuilt service:

| Units | n |
|---|---|
| Clean FF-N01 business directory units (6 layered bases) | 6 |
| Clean FF-N02 units of the rebuilt service file (library, clinic, fleet: the CHECK-2 FRAMEWORK-LEAK site was that service) | 3 |
| `AP-REPO-BYPASSn` twins (FF-N01) | 6 |
| `AP-FRAMEWORK-LEAK` seeds and twins on those three service files (FF-N02) | 6 |

The six layered `AP-REPO-BYPASS` seed prompts are byte-identical to CHECK-2. The FF-N01 unit shows the business directory only, which is the CHECK-2 bypass service plus the seed edit. The new persistence class lies outside that unit.

### 3.4 Static self-check (run before any call, and by the runner)

`scripts/v1.3/judge-check3-selfcheck.ts` (unit-tested in `tests/unit/scripts/v1.3/judge-check3-selfcheck.test.ts`) checks:

| Id | What |
|---|---|
| S1 | No clean base carries a known seed pattern. The patterns are a global ORM handle outside infrastructure; a layered business file importing `PrismaService` or `@prisma/*`; `typeorm` or `@Entity`/`@Column` in a domain-kind file; `express` in a domain- or application-kind file; a domain file importing an infrastructure file on clean, hexagonal or ddd; the operator cues `'u5a'`, `request?:` and `context?:`; any comment. |
| S2 | Positive control: every layered seed overlay carries the facade pattern. |
| S3 | The overlays carry no comment. |
| S4 | The committed manifest's tree hashes equal the bases on disk. |
| S5 | The non-layered bases are byte-identical to CHECK-2. |
| S6 | With a work dir: no REPO-BYPASS twin copy carries a bypass pattern. |
| S7 | With a work dir, positive control: every layered `AP-REPO-BYPASS` seed copy carries `new PrismaClient()`. |

AP-FAT-CONTROLLER has no static signature and is not checked.

**Result on CHECK-3: PASS, S1 to S7** (`results/v1.3-judge-check3/check3-selfcheck.json`).

**Result on CHECK-2: FAIL** (S1: 6 findings, S6: 6 findings). They are the six `PrismaService` services and their six twins, and nothing else. So the check detects the CHECK-2 defect.

**Rule:** the runner stops before any call when the self-check fails. A run made on a failing self-check is void.

## 4. Decision rule (reused unchanged from `judge-v22-plan.md` §5)

**Arms.**
- **v1:** the frozen default judge.
- **v2.2:** the candidate, unchanged (`JUDGE_V22_SHA256` above).
- **A v2.3** may replace v2.2 as the candidate only by an amendment committed before its first CHECK-3 call. The amendment must give its texts' sha256 and re-harvest its prompts. The rule below stays as it is. v2.3 must not be tuned on CHECK-3 verdicts.

**Inputs.** These are the same as in CHECK-2:
- **Unit verdict:** majority of 3 runs per judge.
- **Target verdict:** a seed or twin fails if any of its units fails.
- **Metrics:** those of `judge-v2-score.ts`.
- **Layered business clean unit:** a clean-control unit of a layered base under `src/business/`.
- **Real-construct seed:** a REPO-BYPASS or PERSIST-IN-DOMAIN seed on a non-layered base.

**The candidate becomes CANDIDATE only if every check holds:**

| Check | Rule |
|---|---|
| D0 (validity) | Each judge has at most 2 units without a majority verdict (invalid, tied or missing). Otherwise the outcome is **INCONCLUSIVE**: re-run only those units, then apply the rule again. |
| **D1 (the fix)** | **Layered business clean units (n = 21: 15 FF-N02, 6 FF-N01): candidate false fails ≤ 1, and ≤ v1's.** |
| D2 | Catch: candidate ≥ v1 − 1. |
| D3 | Paired catch: candidate ≥ v1 − 1. |
| D4 | Twin false fail: candidate ≤ v1 + 1. |
| D5 | Clean false fail, all 48 units: candidate ≤ v1. |
| D6 (no reopening) | Real-construct seeds (8): candidate catch ≥ v1 catch, with no loss at all. |

Any failed check from D1 to D6 means **NOT CANDIDATE**. The rule is the `decide` function in `scripts/v1.3/judge-v22-check2.ts`, unchanged and pinned by `tests/unit/scripts/v1.3/judge-v22-check2.test.ts`. `score --set check3` writes `results/v1.3-judge-check3/check3-decision.json`.

**Why the D1 bound is now testable.** On CHECK-2, 6 of the 21 D1 units held a planted bypass, so "≤ 1 false fail" could not be met by any judge, however good its rubric. On CHECK-3, self-check S1 confirms that no D1 unit carries a seed pattern. The 6 FF-N01 units now hold the same "business service calls an injected persistence class" construct as the 15 FF-N02 units. So a judge that reads closed layering correctly can meet the bound, and a fail on any of the 21 units is a real false fail.

**Reported with the decision, but not part of it (fixed now, so it cannot be chosen after the data):**
1. D1 split by function: FF-N01 false fails out of 6, FF-N02 out of 15, for both judges.
2. REPO-BYPASS layered paired catch for both judges: 6 seeds, now attributable because the clean FF-N01 unit is clean.
3. **Attribution of the CHECK-2 FF-N01 result.** If v1 and the candidate each fail at most 1 of the 6 clean FF-N01 units, the CHECK-2 FF-N01 failure is attributed to the base defect. If either fails 4 or more, it is attributed to the judge's FF-N01 reading, and the CHECK-2 report's §0 explanation is withdrawn for that judge. Counts of 2 or 3 are reported as unresolved.
4. **The nestjs FF-N01 clean unit.** `src/enrolments#application` holds an `@InjectRepository` field, which is idiomatic in that style, and was failed by both Claude judges on CHECK-2. It is not in D1, it is unchanged, and it is reported on its own.

**What CANDIDATE means.** The same as in CHECK-2: the candidate is proposed for a separate, pre-registered confirmation on fresh material. It is not adopted. CHECK-3 cannot be that confirmation, because 117 of its 138 prompts were judged in CHECK-2. A CANDIDATE on CHECK-3 does not erase v2.2's NOT CANDIDATE on CHECK-2. Both are reported.

## 5. Call budget

| Phase | Items | Distinct prompts | Runs | Judge calls | Init probe | Total |
|---|---|---|---|---|---|---|
| v1 (frozen) | 138 | 138 | 3 | 414 | 1 | 415 |
| v2.2 | 138 | 138 | 3 | 414 | 1 | 415 |
| **Total** | | | | **828** | **2** | **830** |

- **Printed with no call.** `judge-v22-check2.ts budget --set check3 --runs 3` printed this on 2026-10-16, with an empty CHECK-3 ledger.
- **Own ledger and cassettes.** CHECK-3 uses `results/v1.3-judge-check3/call-ledger.json` and `tests/fixtures/judge-cassettes-v13/judge-v22/check3-{v1,v2.2}/`.
- **Hard cap: 1000 on the CHECK-3 ledger** (`--budget 1000`, the default). A retry counts as an extra attempt. The runner refuses to start a phase that would pass the cap.
- **CHECK-2 cassettes are not reused.** Copying them in would replay the 117 identical prompts and cut the run to about 128 calls. It would also make 117 of 138 verdicts known before the run and reuse CHECK-2's samples rather than draw independent ones. So the run draws fresh verdicts for all 138 items.
- **No other rater.** No Gemini or other rater is part of this run. Any such run must be labelled exploratory and kept out of the decision, as in CHECK-2 §6.
- **Runs per unit:** 3. Do not use `--runs 1`, because the rule is defined on the majority of 3. Use one judge process at a time when the machine is loaded (`--workers 1`). This changes neither prompts, cassette keys nor verdicts.

## 6. v1 stays frozen

- **v1 stays the default judge whatever CHECK-3 shows.** Its texts (`FROZEN_SHA256` `f8b2dabb…`) and its prompts are not changed by this work. Its byte-identity test still passes.
- **The v1 arm is the reference, not a candidate.** No outcome of this rule changes v1.
- **Only a separate pre-registered confirmation could change the default.** Even then, the change is the author's decision.
- **The other judge texts are unchanged too:** `--judge-version v2` (v2.1, `0add6562…`) and v2.2 (`1915fb11…`).

## 7. Running it (locally, by the author)

```bash
bash scripts/v1.3/judge-v22-check2-local.sh --set check3 --dry-run   # hashes, self-check, unit tests, budget; no call
bash scripts/v1.3/judge-v22-check2-local.sh --set check3              # the same, ask, record v1 then v2.2, score
```

- With `CHECK3_REHARVEST=1`, the runner first re-seeds, re-plans and re-harvests into a scratch dir and compares the result with §3.2. This needs Neo4j.
- The runner's minimal environment, its isolation and the resume behaviour are those of CHECK-2 (`judge-v22-plan.md` §6).

## 8. What CHECK-3 can and cannot show

**Can show:**
- whether the CHECK-2 D1 and FF-N01 failure came from the bases;
- whether v2.2 (or an amended v2.3) meets the pre-fixed rule once the clean controls are clean;
- REPO-BYPASS paired catch on layered code.

**Cannot show:**
- **Validity.** The bases, seeds and rule are by the same team, the constructs are seeded, and no human adjudicates the citations.
- **Independence from CHECK-2.** Most prompts are shared.
- **Small differences.** About 40 seeds, so one item is about 2.5 points.
- **Generality** beyond ten small bases.
