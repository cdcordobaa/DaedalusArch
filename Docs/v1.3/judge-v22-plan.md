# Judge v2.2: changes, CHECK-2 and the decision rule

> **Written 2026-10-16, before any v2.2 judge call.** This is development-set work and not a pre-registration. The manifest, the split and the harvested prompts of CHECK-2 were committed before any judge run (§3.6). The decision rule (§5) is fixed here and in code (`decide` in `scripts/v1.3/judge-v22-check2.ts`, pinned by a unit test). No judge or LLM call was made to prepare this. The only model involved was the `mock` provider.

Context: `Docs/DiagnosticRuns/v1.3-judge-v2-2026-10-16.md` §8 and §9 (PR #126, branch `v1.3-judge-v2`). This branch, `v1.3-judge-v22-prep`, is cut from `origin/v1.3-judge-v2` @ `5f636af3`, because `origin/v1.3` does not contain the judge-v2 code.

## 1. Why a v2.2

On CHECK, v2.1 failed the layered style's business layer (declared `kind: domain`) for calling its persistence layer. The base `OrderService.ts` failed in 2 of 3 runs, in both rounds and on a twin. Two v2.1 FF-N02 clauses are keyed on the layer kind alone:
- "persistence or I/O in a domain file";
- "constructor parameters of an *application* file are dependency wiring".

The prompt also shows neither the architecture style nor the layers each layer may depend on. In closed layering (presentation → business → persistence), the business layer calling the persistence layer is the design.

CHECK is now spent: it found this false fail, so it cannot judge the fix. Hence CHECK-2 (§3).

## 2. What v2.2 changes

`--judge-version v2.2` (`src/llm-critic/judge-v22.ts`, `src/llm-critic/context-v22.ts`). v1 stays the default and stays frozen. `--judge-version v2` is still v2.1, unchanged.

| Part | v2.1 | v2.2 |
|---|---|---|
| Layer model section | `- business (kind: domain): src/business/**` | A style line, then `- business (kind: domain; may depend on: persistence): src/business/**` |
| FF-N02 domain I/O | "persistence or I/O (queries, database or ORM clients, HTTP or file access)" in a domain file | **Direct** I/O only: a database, ORM, query, HTTP or file client that the file itself creates, imports from a package or obtains from a global accessor. Persistence or I/O done through a class of a layer the file may **not** depend on still counts. A call to a class or interface of a layer this layer **may** depend on is not misplaced I/O. |
| FF-N02 constructor wiring | Exempts application files only | Any file, for types of its own layer or of a layer it may depend on |
| FF-N02 framework/ORM type, decorator and base-class ban in domain files | Kept | Kept, verbatim |
| FF-N02 delivery-type clause (request, response, HTTP error in signatures or throws) | Kept | Kept, verbatim |
| FF-N01, persona, instructions, neighbourhood, candidate flags, verdict schema | v2.1 | Unchanged (same objects) |

**Allowed dependencies** (`allowedDependenciesOf`) come from the evaluation spec only:
- **Graph styles** (hexagonal, ddd): `architecture.allowed_dependencies` as declared.
- **Closed layering** (`layered`): each layer may depend on the layer listed directly before it. These are the `no-layer-skip` transitions.
- **Every other style** (clean-architecture, nestjs, unspecified): the layer order. A layer may depend on every layer listed before it, the `dependency-direction` order.

**Style line.** It states the dependency rule, not a verdict. For example: `Style: layered. Closed layering: layers are listed bottom-up and each layer may depend only on the layer listed directly before it.`

**Hashes.**
- `JUDGE_V22_SHA256` = `1915fb117f43cb2d13d43675887a46fcb6f6546eda8f369034a1738501ce22c6`, the canonical JSON of every v2.2 text.
- v1 `FROZEN_SHA256` (`f8b2dabb…`) and v2.1 `JUDGE_V2_SHA256` (`0add6562…`) are unchanged.

**Tests** (`tests/unit/llm-critic/judge-v22.test.ts`, 13 tests):
- the rendered layer model for each of the three dependency rules;
- the exact v2.2 FF-N02 clauses, and the absence of v2.1's kind-only clauses;
- the kept clauses;
- probe-vocabulary independence (BR-U4-RUB-01);
- `--judge-version` parsing;
- an end-to-end `evaluateNeuronal` prompt;
- that the v2.2 prompt differs from the v2.1 prompt **only** in the rubric and the layer model section;
- **byte identity of the v1 and v2.1 prompts.** The sha256 of each prompt was computed on the branch base before this change and is pinned in the test.

**Wiring.** `judge-stage` passes the spec's `style` and `allowedDependencies` to the critic only for a v2.2 run. A v2.2 report carries `judge.judgeVersion: "v2.2"` and `judgeRevision: "v2.2"`.

**Known issue (pre-existing, not fixed here).** The frozen report schema rejects these two provenance fields. So `firewall evaluate --judge-version v2|v2.2` exits 2 at report validation after judging. PR #126's v2 reports have the same problem. The CHECK-2 harness reads the cassettes, not the report, so it is not affected. Fixing it means touching the report schema, which is the author's call.

## 3. CHECK-2: fresh material

### 3.1 Bases

Ten projects were written for CHECK-2 on 2026-10-16 (`tests/fixtures/v1.3-check2/`, see its README). No judge has seen them. None is derived from the reference projects, the `antipattern-nest` fixture or the E1 cells. The sources carry no comment at all, and a scan finds none of the words violation, anti-pattern, seed, twin, leak, bypass, judge, smell, layer, correct or bad.

| Base | Style | Domain | `src` files / lines |
|---|---|---|---|
| layered-library | layered | library lending | 18 / 316 |
| layered-clinic | layered | clinic appointments | 15 / 289 |
| layered-fleet | layered | fleet maintenance | 13 / 274 |
| layered-ticketing | layered | event ticketing | 13 / 247 |
| layered-payroll | layered | payroll | 13 / 262 |
| layered-warehouse | layered | warehouse stock | 12 / 234 |
| clean-subscriptions | clean-architecture | SaaS subscriptions | 16 / 312 |
| nestjs-courses | nestjs | course enrolment | 15 / 255 |
| hexagonal-parking | hexagonal | parking reservations | 17 / 274 |
| ddd-insurance | ddd | insurance policies and claims (2 contexts, ACL) | 22 / 368 |

**Six closed-layering bases.** Every layered base has business services that call persistence gateways, DAOs, tables, stores or repositories through constructor-injected fields. That is the §8 construct, and it is present in every layered clean control. Each layered base also has one business service that uses the persistence layer's `PrismaService` directly. That shape is what `AP-REPO-BYPASS` needs (§3.2).

**Evaluation spec** (`spec.yaml`):
- the style preset verbatim;
- **for DDD** (judged for the first time): `presets/ddd.yaml` with this project's `architecture.ddd` block and FF-N01/FF-N02 copied verbatim from `presets/layered.yaml` (tier advisory), because the DDD preset declares no judged function.

**Seeding-only spec** (`seed-spec.yaml`, layered only): the business layer is split into a domain-kind model and an application-kind service layer. The operators look for service classes in application-kind layers, so without this they place no FRAMEWORK-LEAK or REPO-BYPASS site in layered code. It is never used to evaluate or judge.

### 3.2 Families, operators and judged function

The existing operators are used unchanged. Their file hashes equal those frozen in `Docs/v1.3/judge-catch-frozen.md` (`ap-framework-leak.ts` `d6ed07f1…`, `ap-persist-in-domain.ts` `1994e50b…`, `ap-repo-bypass.ts` `8532ef79…`, `ap-fat-controller.ts` `866d1eca…`, `antipatterns/common.ts` `40552e37…`). `MO-DF01` and `MO-DF01n` come from the frozen catalogue (`mo-df01.ts` `7fb4cdc4…`).

| Family | Positive / twin | Judged function | Bases |
|---|---|---|---|
| FRAMEWORK-LEAK | AP-FRAMEWORK-LEAK / AP-FRAMEWORK-LEAKn: an unused optional express `Request` parameter / a plain context DTO | FF-N02 | all 10 |
| PERSIST-IN-DOMAIN | AP-PERSIST-IN-DOMAIN / AP-PERSIST-IN-DOMAINn: `@Entity`/`@Column` from typeorm / a plain `has<Prop>()` query | FF-N02 | all 10 |
| REPO-BYPASS | AP-REPO-BYPASS / AP-REPO-BYPASSn: a global client (`new PrismaClient()`, `getRepository(E)`) instead of the injected field / a local bound to the injected field | FF-N01 | 6 layered + nestjs |
| REPO-BYPASS | MO-DF01 / MO-DF01n: a domain class holds `new <Repository implementation>()` / an infrastructure class holds a domain value | FF-N02 | clean, hexagonal, ddd |
| LOGIC-IN-CONTROLLER | AP-FAT-CONTROLLER / AP-FAT-CONTROLLERn: a service's parameter rule moves into the controller handler / pure request mapping | FF-N02 | all 10 |

**Why MO-DF01 stands in on clean, hexagonal and DDD.** AP-REPO-BYPASS needs an application service whose field is ORM-injected. In those styles such a field would itself be a violation, so the operator places no site there by construction. MO-DF01 is the "domain reaches a repository implementation" construct that §8 asks for. It checks that v2.2's narrowed I/O clause does not reopen the real PERSIST-IN-DOMAIN or bypass construct.

**The two layered constructs that decide v2.2.**
- **Clean business → gateway.** Must pass. It sits in every layered clean unit.
- **Business → `new PrismaClient()`.** Must fail. This is the REPO-BYPASS seed, a direct DB client in the domain-kind layer.

### 3.3 Selection (one site per base and family)

**Seed.**
- Start from the eligible sites (`eligibleSites`: `findSites` plus the precondition pass, as in the judge-catch rounds).
- Narrow them to the preferred sites when any exist:
  - the holder class does not end in Error or Exception;
  - for MO-DF01, the target is named `*Repository*`, and on DDD it is in the holder's own bounded context.
- Draw one site with mulberry32(uint32(sha256(`daedalus-v1.3-judge-v22-check2-20261016|<baseId>|<family>`))).

**Twin.** The twin operator's eligible site closest to the seed, in this order: same site, same member, same file, the mirror (MO-DF01n), else the base's first site.

**Twin matches.** 27 same-site, 10 same-member (the FAT-CONTROLLER twins, same controller and handler), 2 mirror and 1 same-base (hexagonal MO-DF01n).

### 3.4 Copies

**Apply and check.** Each site is applied to a fresh copy with the operators' own apply seed (20261015). Each copy is then type-checked with the repository's `tsc`. All 80 copies apply and compile.

**Style normalisation.** Two operators write in a style foreign to the file, which would be a formatting cue:
- the frozen MO-DF01 writes double quotes and 4-space indentation;
- AP-FAT-CONTROLLER's moved rule body is over-indented.

So **only the lines the operator added** are re-indented to a bracket-depth model of the file's own indentation unit (`normaliseAdded`). Their import quotes are matched to the file. Unchanged lines are never touched. The model agrees with 2410 of the 2413 lines of the hand-written bases. Sixteen rows are normalised, all FAT-CONTROLLER seeds and the MO-DF01 rows, and the manifest lists them (`styleNormalised`). Every normalised copy is type-checked again.

**No comments.** A check rejects any copy that adds a comment line; none does.

**Remaining operator cues, kept as designed and paired with the twin:**
- the unused optional `request?` and `context?` parameters;
- the `has<Prop>()` twin method;
- MO-DF01n's `'u5a'` literal.

### 3.5 Composition (from the committed split)

| Family | Seed targets (units) | Twin targets (units) | Layered seeds | Other-style seeds |
|---|---|---|---|---|
| FRAMEWORK-LEAK | 10 (10) | 10 (10) | 6 | 4 |
| PERSIST-IN-DOMAIN | 10 (10) | 10 (10) | 6 | 4 |
| REPO-BYPASS | 10 (10) | 10 (10) | 6 | 4 |
| LOGIC-IN-CONTROLLER | 10 (20) | 10 (10) | 6 | 4 |
| **Total** | 40 (50) | 40 (40) | 24 | 16 |

Clean-control units: 48 (FF-N02 41, FF-N01 7), of which **21 are layered business units** (the §8 construct, D1). Per style: layered 27, clean-architecture 5, nestjs 5, hexagonal 5, ddd 6.
Items: **138** (50 seed units, 40 twin units, 48 clean units); targets: 90 (40 seeds, 40 twins, 10 clean bases). FF-N01 items: 21; FF-N02 items: 117. A LOGIC-IN-CONTROLLER seed edits two files (the service and the controller), hence two units.

### 3.6 Frozen artefacts (committed before any judge run)

| Artefact | sha256 |
|---|---|
| `results/v1.3-judge-v22/check2-seed-manifest.json` (80 rows; base tree hashes inside) | `fbae6cf4811c0d51755134652a553deda4442a05ae0945766cf637ead6b4b056` |
| `results/v1.3-judge-v22/check2-split.json` | `7660dee4e12e81b30eb4855d9fe2f6a71c4be1a206e2c5690687314145eeb351` |
| CHECK-2 item list (`itemsSha256` in the split) | `1c104ce17f2d2bc41933360f72d86ac8d851d61f672464141f4140d79bdd11c8` |
| `results/v1.3-judge-v22/prompts/check2-v1.json` | `65b0d39869b6664c3877308a321ccf0ee1b5b850411924349da81032e734a65e` |
| `results/v1.3-judge-v22/prompts/check2-v2.2.json` | `1b1d26656d8aae7c2d257355a991c3734914d59516e74f83b2846f09ab94fd57` |

Seed salt: `daedalus-v1.3-judge-v22-check2-20261016`; apply seed `20261015`.

**Reproducibility.** `seed --check` regenerates the manifest byte for byte; this was verified in a second, independent seeding run.

**How the prompts were harvested.** The prompts are the product path's own: a mock `firewall evaluate` per target, with the target units selected through a crafted baseline report (as in the judge-catch rounds), Neo4j graph view, cheap flags (v2.2), and `runIndex` 0 of the mock cassette. They were harvested locally with a throwaway Neo4j 5.26 and the mock provider.

**Prompt scan.** No prompt contains a work-dir path, a row id, an operator id, a base id or a `[REDACTED]` marker. All 138 v2.2 prompts carry the style line; no v1 prompt does. The cheap flags were available for every v2.2 target.

**Harvest environment.** The harvest ran under `env -i` (HOME, PATH and the Neo4j variables only). In the cloud container, an environment variable named like a secret (`MAX_THINKING_TOKENS`) has a short value. The cassette decorator scrubbed that value out of stored entries, turning `FF-N01` into `FF-N0[REDACTED]`. The local runner now uses a minimal environment too, and both harvest and record refuse a prompt holding `[REDACTED]`.

## 4. Expected call count

| Phase | Items | Distinct prompts | Runs | Judge calls | Init probe | Total |
|---|---|---|---|---|---|---|
| v1 (frozen) | 138 | 138 | 3 | 414 | 1 | 415 |
| v2.2 | 138 | 138 | 3 | 414 | 1 | 415 |
| **Total** | | | | **828** | **2** | **830** |

**Retries.** A retry (an invalid answer re-asked by the provider) counts as an extra attempt in the ledger, so the true total can be slightly higher. The record cap (`--budget`, default 1000) leaves room for that.

**Session spread.** At PR #126's pace (one session ran 117 calls before the usage limit), the run likely spans several CLI sessions; it resumes from the cassettes.

**Fewer runs.** Do not use `record --runs 1`: the rule is defined on the majority of 3 runs.

`budget` prints this up front from the committed prompts and whatever is already in the cassettes. `record` refuses to start when the ledger plus the projection would pass `--budget` (default 1000). Identical prompts are judged once per run index. The cassette decorator answers the rest.

## 5. Decision rule (fixed now, before any call)

**Inputs.**
- **Unit verdict:** the majority of 3 runs, for both judges.
- **Target verdict:** a seed or twin fails when any of its target units fails.
- **Metrics:** as in `judge-v2-score.ts` (catch, paired catch, twin false fail, clean false fail per unit).
- **Layered business clean unit:** a clean-control unit of a layered base under `src/business/`. This is the §8 construct.
- **Real-construct seed:** a REPO-BYPASS or PERSIST-IN-DOMAIN seed on a non-layered base.

**v2.2 becomes the CANDIDATE default only if every check holds:**

| Check | Rule |
|---|---|
| D0 (validity) | Each judge has at most 2 units without a majority verdict (invalid, tied or missing). If not, the outcome is **INCONCLUSIVE**: re-run only those units, then apply the rule again. |
| D1 (the fix) | Layered business clean units: v2.2 false fails ≤ 1, and ≤ v1's. |
| D2 | Catch: v2.2 ≥ v1 − 1. |
| D3 | Paired catch: v2.2 ≥ v1 − 1. |
| D4 | Twin false fail: v2.2 ≤ v1 + 1. |
| D5 | Clean false fail, all units: v2.2 ≤ v1. |
| D6 (no reopening) | Real-construct seeds: v2.2 catch ≥ v1 catch, with no loss at all. |

Any failed check from D1 to D6 means **NOT CANDIDATE**.

**Rationale.**
- D1 and D5 are the purpose of v2.2: remove false fails without adding any.
- D2 to D4 allow one item of slack, because with about 40 seeds one item is noise.
- D6 has no slack, because the narrowed I/O clause is exactly what could let real persistence-in-domain through.

**What CANDIDATE means.** v2.2 is proposed as the default for a separate, pre-registered confirmation. It does not mean v2.2 is adopted: v1 stays the frozen default until that confirmation. The rule is implemented as `decide` and unit-tested (`tests/unit/scripts/v1.3/judge-v22-check2.test.ts`). The scorer prints each check with both judges' counts.

**What is not done.**
- No v2.1 arm runs on CHECK-2. That keeps the budget down, and v2.1 is not a candidate.
- Nothing is tuned on CHECK-2. If v2.2 is NOT CANDIDATE, a v2.3 needs a CHECK-3.

## 6. Running it locally (one command)

From the repository root, with the isolated judge CLI login in place:

```bash
bash scripts/v1.3/judge-v22-check2-local.sh --dry-run   # verify inputs, print the call budget, no call
bash scripts/v1.3/judge-v22-check2-local.sh             # verify, print the budget, ask, record v1 then v2.2, score
```

**What the script does, in order:**
1. Prints the sha256 of the frozen inputs.
2. Runs the three unit-test files: judge texts, byte identity and the decision rule. It stops if any fails.
3. Prints the budget and asks before any call (`--yes` skips the question).
4. Records v1, 3 runs per unit.
5. Records v2.2, 3 runs per unit.
6. Scores. Results go to `results/v1.3-judge-v22/check2-scores.md` and `check2-decision.json`.

**Where things are stored.**
- Cassettes: `tests/fixtures/judge-cassettes-v13/judge-v22/check2-{v1,v2.2}/`.
- Call ledger: `results/v1.3-judge-v22/call-ledger.json`.

**Resuming.** A stop (usage limit, auth) ends the phase; re-run the same command. Stored entries are replayed, never called again. When nothing is missing, a phase uses replay mode and makes no pre-flight call.

**Optional reproducibility check.** `CHECK2_REHARVEST=1` re-seeds, re-plans and re-harvests into a scratch directory before any call, and compares the result with the committed manifest, split and prompts. It needs Neo4j, with `NEO4J_URI`, `NEO4J_USER` and `NEO4J_PASSWORD` set as for `firewall evaluate`.

**Safety.** The script never reads `.env`, credentials or the judge config dir; the provider's own pre-flight handles isolation (ADR-018/022).

## 7. What CHECK-2 can and cannot show

**Can show:**
- whether v2.2 removes the layered business false fail on six closed-layering bases it has never seen;
- whether v2.2 keeps v1's catches on four other styles, DDD included;
- the per-family picture.

**Cannot show:**
- **Validity.** The bases, seeds and rule were written by the same team. These are seeded constructs, not real defects, and no human adjudicates the citations.
- **Small differences.** About 40 seeds, so one item is about 2.5 points, and Wilson intervals of the two judges will overlap.

**Threats.**
- **Author-written bases.** The bases were written knowing the §8 construct. Two mitigations:
  - the decision gives weight to catches and to non-layered styles too;
  - every layered clean unit is judged by both judges.
- **Grey zone.** The `PrismaService` business services (the REPO-BYPASS bases) are a grey zone: business code using an ORM facade of the persistence layer. They are judged under FF-N01 only, which v2.2 does not change apart from the layer model section. Their FF-N02 clean units are not part of D1 unless a FRAMEWORK-LEAK or LOGIC-IN-CONTROLLER seed lands on the same file. That happened on 3 of 6 layered bases (library, clinic, fleet: the FRAMEWORK-LEAK site is the `PrismaService` service), so those three units do count in D1.
