# Cheap semantic proxies (pass 0.5) against the planted anti-patterns, 2026-10-15

> **DEVELOPMENT-SET NUMBERS, CIRCULAR BY CONSTRUCTION.** Every figure here comes from the v1.3 development reference projects and the `antipattern-nest` unit fixture. 10 of the 11 seeds sit on one 8-file fixture. The proxies were written *after* the five frozen operators and the judge round-1 results had been read, and each operator has a designated proxy. A catch here shows that the proxies implement what they were written to detect. It is not a recall estimate. The less circular evidence is §4 (hand-written analogues written before this unit) and §5 (false flags on clean code). There is no pre-registration (author decision).

> **Correction (2026-10-16, post-merge review R28):** all **11 of the 11** seeds sit on the one 8-file `antipattern-nest` fixture, not 10 of 11 (this doc's own §1 seed list: "11 seeds: REPO-BYPASS 4, FAT-CONTROLLER 1, PERSIST-IN-DOMAIN 1, DUP-RULE 1, FRAMEWORK-LEAK 4, all on `antipattern-nest`"; same count corrected in `Docs/DiagnosticRuns/v1.3-judge-catch-2026-10-15.md`). The same applies to "11 seeds, 10 on one fixture" in the threats section. The banner above is left as written.

Branch `v1.3-cheap-semantics`, cut from `origin/v1.3` @ `81143247`. Code: `src/apg-enrich/cheap/` (design: `Docs/v1.3/cheap-semantics-design.md`). Harness: `scripts/v1.3/cheap-semantics-eval.ts`. Outputs: `results/v1.3-cheap-semantics/` (`scores.json`, `rows.csv`, one `flags/<row>.json` per copy).

## 1. Setup

- **Seeds.** `scripts/v1.3/judge-catch-seed.ts` was rerun unchanged, as the judge catch test ran it. The operators, preconditions and apply seed are the frozen ones (`Docs/v1.3/judge-catch-frozen.md`). The run reproduced the judge run's site table and its 53 applied copies, and all 53 pass `tsc --noEmit`:
  - 11 seeds: REPO-BYPASS 4, FAT-CONTROLLER 1, PERSIST-IN-DOMAIN 1, DUP-RULE 1, FRAMEWORK-LEAK 4, all on `antipattern-nest`;
  - 42 twins, on the fixture, the five clean reference projects and two nestjs near-miss variants.
- **Twin count against the judge.** The judge saw 33 twins: it skipped the 9 DDD twin copies because `presets/ddd.yaml` declares neither FF-N01 nor FF-N02. The proxies run on all 42. Restricted to the judge's 33, the proxy twin numbers below are unchanged: no DDD twin carries a designated flag.
- **Runs.** Every copy and every unmodified base was extracted with `extractAPG`, using the branch defaults and the spec's `default_exclude_paths`. All ten proxies then ran on it with their default options. No LLM, Neo4j or network was used.
- **Designated proxy per operator.** It was fixed before the first evaluation run (`DESIGNATED` in the harness). The *primary* proxy is the one meant for the operator. The *set* also counts a second proxy that reads the same property.

| Operator | Primary proxy | Set |
|---|---|---|
| AP-REPO-BYPASS | repo-bypass (6) | + name-behaviour (3) `service-direct-orm` |
| AP-FAT-CONTROLLER | logic-density (5) | + name-behaviour (3) `controller-business-logic` |
| AP-PERSIST-IN-DOMAIN | name-behaviour (3) `domain-persistence-mapping` | + framework-in-core (7) |
| AP-DUP-RULE | clones (1) | + shared-literals (2) |
| AP-FRAMEWORK-LEAK | framework-in-core (7) | — |

- **Scoring.** The site's unit is the file, class and method of the operator's site detail. For AP-DUP-RULE (a new method in the second class) and AP-PERSIST-IN-DOMAIN (an annotated class) it is the file and class only.
  - **Catch:** a designated flag lies on the seed's unit.
  - **Paired catch:** the flag (proxy, kind, file, class, method) is not already on that unit in the unmodified base.
  - **Twin false flag:** a designated flag on the twin's unit. It is paired in the same way.
  - **Clean false flag:** a designated flag on the seed's unit in the unmodified base.

  The judge's definitions (`judge-catch-score.ts`) are the unit-level analogues of these.

## 2. Three-way result (development set)

Cells give k/n. The Wilson 95% intervals are in §3.

| Anti-pattern | Seeds | **Cheap proxy** catch (primary) | **LLM judge** catch (round 1) | **Symbolic v1.3 rules** catch | Proxy twin false flag (raw / paired) | Judge twin false fail (raw) | Proxy clean false flag | Judge clean false fail |
|---|---|---|---|---|---|---|---|---|
| AP-REPO-BYPASS | 4 | **4/4** | 4/4 | 0/4 | 0/4 / 0/4 | 0/4 | 0/4 | 0/4 |
| AP-FAT-CONTROLLER | 1 | **1/1** | 1/1 | 0/1 | 0/2 / 0/2 | 0/1 | 0/1 | 0/1 |
| AP-PERSIST-IN-DOMAIN | 1 | **1/1** | 1/1 | 0/1 (FF-P01 expected, did not fire) | 2/12 / **0/12** | 2/7 | 0/1 | 0/1 |
| AP-DUP-RULE | 1 | **1/1** | 1/1 | 0/1 | 0/1 / 0/1 | **1/1** | 0/1 | 0/1 |
| AP-FRAMEWORK-LEAK | 4 | **4/4** | **2/4** | 0/4 | 0/23 / 0/23 | 0/20 | 0/4 | 0/4 |
| **Pooled** | **11** | **11/11** | 9/11 | 0/11 | 2/42 / **0/42** | 3/33 | 0/11 | 2/24 units |

Judge and symbolic columns: `Docs/DiagnosticRuns/v1.3-judge-catch-2026-10-15.md` §3 and §4. "Symbolic" is S2 there: any new symbolic row on an edited file. No v1.3 rule fired on any seed, and no seed changed the blocking verdict. The judge's clean false fails are counted per unit (2/24: the two fixture entity files). The proxy's are counted per seed unit.

Reading:
- **Every seed is flagged by its primary proxy, and every flag is paired**, so none was on the base unit. The designated set adds nothing to the primary.
- **The two judge misses are both caught.** They are the FRAMEWORK-LEAK seeds on `invoice.service.ts`, `issue` and `countFor`, each with an optional `request?: Request` parameter. The type checker reads `Request | undefined`, resolves `Request` to the `express` alias of the fixture's tsconfig `paths`, and flags it whatever the method body says.
- **The judge's one twin false fail is not repeated.** That was DUP-RULEn's `validateCreate` forwarding to `assertCreateRule`. The rule moves into one helper, so no fragment is left to clone and the message literal has one site.
- **The two raw twin flags are inherited, as for the judge.** They are the PERSIST-IN-DOMAINn twins on `invoice.entity.ts` and `order.entity.ts`, TypeORM-mapped entities in a `*.entity.ts` domain layer. The flag is already on the base, so the paired rate is 0/12.
- **The symbolic column stays at 0.** The proxies cover what the v1.3 rule set does not read: call receivers, signature types, decorators and statement-level duplication.

## 3. Details with intervals

From `scores.json` → `perOperator`, `pooled`:

| Operator | Catch (primary) | Paired | Twin false flag (primary) | Paired | Clean false flag |
|---|---|---|---|---|---|
| AP-REPO-BYPASS | 4/4 = 1.00 [0.51, 1.00] | 4/4 | 0/4 = 0.00 [0.00, 0.49] | 0/4 | 0/4 = 0.00 [0.00, 0.49] |
| AP-FAT-CONTROLLER | 1/1 = 1.00 [0.21, 1.00] | 1/1 | 0/2 = 0.00 [0.00, 0.66] | 0/2 | 0/1 = 0.00 [0.00, 0.79] |
| AP-PERSIST-IN-DOMAIN | 1/1 = 1.00 [0.21, 1.00] | 1/1 | 2/12 = 0.17 [0.05, 0.45] | 0/12 = 0.00 [0.00, 0.24] | 0/1 = 0.00 [0.00, 0.79] |
| AP-DUP-RULE | 1/1 = 1.00 [0.21, 1.00] | 1/1 | 0/1 = 0.00 [0.00, 0.79] | 0/1 | 0/1 = 0.00 [0.00, 0.79] |
| AP-FRAMEWORK-LEAK | 4/4 = 1.00 [0.51, 1.00] | 4/4 | 0/23 = 0.00 [0.00, 0.14] | 0/23 | 0/4 = 0.00 [0.00, 0.49] |
| **Pooled** | **11/11 = 1.00 [0.74, 1.00]** | 11/11 | **2/42 = 0.05 [0.01, 0.16]** | **0/42 = 0.00 [0.00, 0.08]** | 0/11 = 0.00 [0.00, 0.26] |

What fired on each seed (`rows.csv` → `proxiesOnSite`):
- **REPO-BYPASS:** `repo-bypass:direct-db-access` and `name-behaviour:service-direct-orm` on the `getRepository(E)` line. The twin's `const repo = this.repo` aliases the injected field and is not direct.
- **FAT-CONTROLLER:** `logic-density:controller-logic-density` and `name-behaviour:controller-business-logic`. `OrderController.create` has density 3: 1 branch, 1 comparison and 1 validation throw. The twin's mapping local scores 0.
- **PERSIST-IN-DOMAIN:** `name-behaviour:domain-persistence-mapping` on `@Entity()` and `@Column()` of `Order`. The decorators resolve to `typeorm` through the type checker. FF-P01 misses this seed; the round-1 report suspects the same tsconfig `paths` alias.
- **DUP-RULE:** `clones:cross-component-exact-structural` (fragment `if (quantity <= 0) { throw … }` in `InvoiceService.validateCreate` and `OrderService.create`) and `shared-literals` ('Quantity must be positive' in components `invoice` and `order`).
- **FRAMEWORK-LEAK:** `framework-in-core:framework-type-parameter`.

Other proxies on the edited files: none of the 11 seed copies has a new flag from a non-designated proxy (`newFlagsOnEditedFiles`). Two DDD and one nestjs twin units carry pre-existing clone or literal flags from the base (§5). They are not designated for those operators.

## 4. Hand-written analogues (less circular)

The reference projects' violation variants were written in earlier units (`tests/fixtures/v1.3-reference/`), independently of the AP operators and before these proxies. Six of them plant the same defect family as two operators:

| Variant | Plant (its own description) | Analogue of | Primary proxy flags the unit | Paired (not on the clean variant) |
|---|---|---|---|---|
| clean-architecture/v04 | `Book` (domain entity) decorated with `@Entity` from typeorm | PERSIST-IN-DOMAIN | yes | yes |
| layered/v07 | `Order` (business model) decorated with `@Entity` | PERSIST-IN-DOMAIN | yes | yes |
| nestjs/v05 | `Workshop` (domain) decorated with `@Entity` | PERSIST-IN-DOMAIN | yes | yes |
| clean-architecture/v10 | `Member.fromRequest(request: express.Request)`, type-only import | FRAMEWORK-LEAK | yes | yes |
| layered/v08 | `OrderService.placeOrderFromRequest(request: express.Request)`, type-only | FRAMEWORK-LEAK | yes | yes |
| nestjs/v06 | `Attendee.fromRequest(id, request: express.Request)`, type-only | FRAMEWORK-LEAK | yes | yes |

That is **6/6 [0.61, 1.00]**. On these variants each new flag is the expected one, and no other new flag appears.

The other 46 violation variants are structural: edges, cycles, ports. They are FF-S/FF-P/FF-DT territory, and the proxies add almost nothing there, as they should (`scores.json` → `violations`). Only two of them gain a new defect flag: `layered/v04`, a shared number between `Money` and `ProductView`, and `layered/v05`, LCOM4 on `Order` after the cycle edit. Three are near the proxies' intent and are **missed**:
- **`ddd/v06-fat-application-service`.** Logic density flags controllers and adapters only, not services.
- **`hexagonal/v07-domain-service-nestjs-decorator`** (`@Injectable` on a domain service). Proxy 3 reads ORM mapping decorators, not DI decorators.
- **`ddd/v04-framework-in-domain`** (`class-transformer` in a value object). The package is not in any catalogue.

These are the catalogue-coverage limit: a proxy sees only what its package and role tables name.

## 5. Precision proxy on the clean reference projects, and runtime

Every proxy ran on the five clean reference projects. Every flag on them counts as a false flag, though some are arguable (below). Communities are reported apart, because a mismatch between the dependency communities and the declared components is a diagnostic, not a defect claim (design §9).

| Project | Files | clones | shared-literals | name-behaviour | cohesion | logic-density | repo-bypass | framework-in-core | vocabulary | **Defect flags** | communities (diagnostic) | ARI vs layers / components | Extract ms | Proxies ms | Total ms |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| clean-architecture | 29 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | **1** | 10 | 0.16 / 0.16 | 132 | 84 | 216 |
| layered | 27 | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **2** | 7 | 0.45 / 0.42 | 136 | 89 | 225 |
| nestjs | 29 | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **2** | 10 | −0.09 / 0.42 | 136 | 81 | 217 |
| hexagonal | 30 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | **1** | 9 | 0.28 / 0.21 | 135 | 71 | 206 |
| ddd | 31 | 6 | 2 | 0 | 0 | 0 | 0 | 0 | 0 | **8** | 6 | 0.01 / 0.25 | 294 | 99 | 393 |
| **Total** | **146** | 10 | 2 | 0 | 1 | 1 | 0 | 0 | 0 | **14** | 42 | | | | |

- **Flags from the semantic-placement proxies.** Repo-bypass, framework-in-core and name-behaviour give 0 flags on all five clean projects and on all 14 near-misses.
- **Flags that are arguably true** (counted anyway):
  - **ddd, 6 of its 8.** `Order.addLine` and `Money.add` repeat the same currency guard with the same message, "Currency mismatch", across `ordering` and `shared-kernel`. That is a duplicated invariant.
  - **ddd, the other 2 clone flags**: `pullEvents` and `total` repeated between `Order` and `Invoice`. That is intentional per-context duplication, which DDD accepts.
  - **layered and nestjs**: one near-clone pair each of mapping functions. They are a record mapper and a view renderer in layered, and two response-DTO `from()` methods in nestjs.
- **False flags by construction:**
  - `LoanController` has LCOM4 3, because each handler delegates to its own use case;
  - `FakePaymentGateway.charge` has density 4, because it is an adapter that simulates a decline rule.
- **Near-miss variants** (14 variants built to trip naive detectors): 39 defect flags in total. Every one is the base project's flag again, except three shared-number flags in `layered/n01` (the price-parsing controller) and one extra near-clone pair in `nestjs/n03`. No near-miss trips repo-bypass, framework-in-core or name-behaviour.
- **Runtime.**
  - Proxies: 71 to 99 ms per project, single-threaded. The shared behaviour pass (I/O resolution through the type checker) is booked under `name-behaviour`, its first user, at 17 to 50 ms.
  - Extraction: 132 to 294 ms.
  - The whole evaluation took 56 s, including materialising 70 variants and running the 53 copies and 7 bases. Seeding took 71 s more, nearly all `tsc` type-checks.
  - The judge round-1 needed 261 live calls for the same seeds.
- **Other summaries.**
  - **Mean LCOM4:** 1.0 to 1.12.
  - **Vocabulary leakage:** maximum 0.40 (hexagonal `application` → `domain`). No component crossed the 0.5 threshold, so there are 0 vocabulary flags.
  - **Doc text:** stored on 1 to 12 units per project.

## 6. Changelog: one revision after the first clean-project run

The first evaluation run used the proxy definitions as first written. Four definitional changes followed. Each came from reading the **clean reference projects' false flags**, not the seeds, and the seed, twin and clean-control numbers of §2 and §3 are identical before and after. The changes:

1. **Clones, body minimum.** A whole-body unit now needs 30 normalised tokens (CCFinder's default), up from the 12 that fragments keep. 12-token one-line delegations (`return this.x.get(id) ?? null`) were Type-2 clones of each other across controllers and repositories: 68 nestjs flags.
2. **Clones, fragment content.** A fragment must hold a value comparison or numeric arithmetic. Bare `if (!x) throw` existence guards were Type-2 clones across every component.
3. **Shared literals.** Identifier-like single-token strings (`'not-found'`, `'invalid'`: error codes and keys) are dropped. Writing a unit test also showed a bug: the "HTTP status" filter dropped every 3-digit number. It now drops only the common status codes. This fix came after the revised run. Its only effect on the development projects is that the near-miss `layered/n01` gains three shared-number flags.
4. **Cohesion.** `*Module` classes (DI composition roots) are exempt from the breadth flag.

| | Run 1 (as first written) | Final |
|---|---|---|
| Seeds caught (primary) | 11/11 | 11/11 |
| Twin false flags raw / paired | 2/42 / 0/42 | 2/42 / 0/42 |
| Clean-project defect flags (5 projects) | **101** (clones 86, literals 12, cohesion 2, density 1) | **14** |
| Near-miss defect flags (14 variants) | 289 | 39 |
| Communities (diagnostic) | 42 | 42 |

The reported precision is therefore a tuned-on-dev number. The 5 clean projects are the set the revision was made on, so the 14 is optimistic. Held-out precision needs the corpus.

## 7. Threats and limits

- **Circularity.** This is the main threat: see the banner. The proxies encode the operators' code shapes, such as the `getRepository` accessor, `@Entity` from a db package, and an express type in an application signature. The judge reads the code without being told what to look for. The proxies cannot be fooled by phrasing or by what a body says, but they also cannot see a defect outside their tables. §4 shows one side of that (6/6), and the three misses show the other.
- **Sample.**
  - 11 seeds, 10 on one fixture, and three operators with one seed each. The pooled lower bound is 0.74.
    > **Correction (2026-10-16, post-merge review R28):** all 11 seeds are on that one fixture (`antipattern-nest`), not 10. The line above is left as written.
  - The fixture's ORM and express typings come through tsconfig `paths` (`vendor/*.d.ts`); the reference projects use ambient `declare module`. Real `node_modules` declarations are supported (`packageOfPath`) but untested on the development set.
- **Unit matching.** The proxies flag a class or method and the judge fails a file or module unit. Matching on file plus class plus method is stricter than the judge's file or module unit. A proxy can therefore only lose catches by that choice, never gain them.
- **Not measured.**
  - Recall of the proxies on defects nobody designed for.
  - Precision on the corpus, where real NestJS-with-TypeORM projects make every `*.entity.ts` a `domain-persistence-mapping` candidate when the spec maps entities to the domain layer.
  - Whether the LLM pass, given the proxy's candidate and evidence, verifies better than it judges blind.

## 8. Reproduce

```
npm ci
npx tsx scripts/v1.3/judge-catch-seed.ts --out <work>/seed          # frozen operators, copies, tsc (71 s)
npx tsx scripts/v1.3/cheap-semantics-eval.ts --out results/v1.3-cheap-semantics --seed <work>/seed --work <work>
npx jest tests/unit/apg-enrich                                       # 23 unit tests, one file per proxy
```

Without `--seed`, the evaluation runs the seeding first. Only the `generatedAt` timestamp and the millisecond timings change between runs.
