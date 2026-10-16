# v1.3 anti-pattern host projects (development set)

> Fixture-building unit, 2026-10-15. Development set only. No pre-registration. No operator, catalogue, rubric or frozen harness file was changed. `aidlc-docs/` was not touched. No judge call and no Neo4j run was made here: neither is available in this environment. The live run is in §6.

## 1. Why

The judge catch test (`Docs/DiagnosticRuns/v1.3-judge-catch-2026-10-15.md`, `…-round2-…`, `v1.3-duprule-v2-2026-10-15.md`) rests on n = 35 seeds, most of them on the 8-file `fixtures/unit/antipattern-nest`. The frozen operators (`scripts/lib/mutation/antipatterns/`, `Docs/operator-catalogue-antipatterns.md`) need NestJS/Express code with an ORM: injected repositories, controller handlers that call services, parameter rules in service methods, plain domain classes, and a project that uses TypeORM and express types. The reference projects and the E1 cells mostly lack these shapes. This unit adds four realistic host projects that offer every operator many sites.

## 2. The hosts

All four live under `fixtures/unit/ap-hosts/<name>/`. Each has its own `tsconfig.json` (strict, `experimentalDecorators`, `paths` to vendored minimal typings under `vendor/`, the same scheme as antipattern-nest), a `package.json` that lists the real dependencies, and a `firewall.spec.yaml`. Each compiles with plain `tsc -p tsconfig.json` and needs no install.

| Host | Stack | Domain | `src` files | Spec (preset) |
|---|---|---|---:|---|
| `museum-loans` | NestJS + TypeORM, feature modules | museum exhibitions, hanging plans, inbound artwork loans, condition checks, lenders | 43 | `presets/nestjs.yaml`; the domain layer also maps each feature's `domain/` folder; DI modules and `main.ts` excluded from FF-C03 |
| `coworking-memberships` | Express + Prisma client (`PrismaService`), manual DI | members, membership plans and pauses, desk and meeting-room bookings, day passes, invoices | 36 | `presets/nestjs.yaml` (see below); `src/http/**` is presentation; composition roots excluded from FF-C03 and FF-C02 |
| `blood-drives` | NestJS + Mongoose (`@InjectModel`, `Model<D>`) | donors and deferrals, mobile drives, appointments, collections with hemoglobin screening, warehouse statistics | 37 | `presets/nestjs.yaml`; `mongoose`, `@nestjs/mongoose`, `@nestjs/*` forbidden in the domain; DI modules excluded from FF-C03 |
| `translation-jobs` | Express + TypeORM, ports and adapters (typedi, typeorm-typedi-extensions) | quotes, job acceptance and payment, translator assignment, delivery, review, cancellation | 42 | `presets/hexagonal.yaml`, unchanged |

Design choices that the operators' preconditions required. Each is a realistic shape and is stated in the code where it applies:

- **Plain domain classes, ORM mapping outside the domain.** AP-PERSIST-IN-DOMAIN needs domain classes with a declared property in files that import no persistence package. ORM entities are therefore in `src/persistence/` (infrastructure) for the NestJS hosts. Prisma rows come from `@prisma/client`. The hexagonal host maps its domain classes with TypeORM `EntitySchema` objects in the outbound adapter. Domain errors take their `code` as a constructor parameter property, so the operator does not pick `Error` subclasses as sites.
- **TypeORM in every host.** AP-PERSIST-IN-DOMAIN's precondition requires the project to use TypeORM. The Prisma host writes invoices to the finance team's TypeORM ledger (`src/persistence/invoice.entity.ts`, used by `InvoicingService`). The Mongoose host loads closed drives into a Postgres warehouse table (`DriveStatsRow`, used by `DriveStatsService`, which is also a TypeORM site of AP-REPO-BYPASS). Both are polyglot-persistence setups.
- **Repository fields of the shapes AP-REPO-BYPASS reads.** `@InjectRepository(E) … Repository<E>` (museum, translation-jobs), `@InjectModel(X.name) … Model<D>` (blood-drives), and a field typed `PrismaService` (coworking, where `PrismaService` is the process-wide `PrismaClient`).
- **Parameter rules in service methods, with handlers that pass field arguments.** These are input rules over the method's own parameters, which AP-FAT-CONTROLLER and AP-DUP-RULE move or copy. Some use only package or application names (`BadRequestException`, `ValidationError`). Others use only domain names (`isLoanCurrency` / `UnsupportedCurrencyError`, `MAX_BOOKING_MINUTES` / `BookingTooLongError`, `MIN_UNIT_ML` / `UnitVolumeError`, `isLanguageCode` / `UnsupportedLanguageError`), so AP-DUP-RULE2n gets both own-file and domain hosts on museum-loans, coworking-memberships and blood-drives. On translation-jobs its hosts are all own-file: the domain-named rules there take the application `RequestQuoteCommand` parameter, so the rule does not consist of domain names only. No service relies on the narrowing of a guard. Removing a rule (AP-FAT-CONTROLLER) therefore never breaks the type-check.
- **Coworking spec.** Of the five presets, only `presets/nestjs.yaml` has the layer flow of a service-layer Express app: presentation → application → infrastructure → domain. The layered preset has no application-kind layer, so services would place no AP-REPO-BYPASS, AP-DUP-RULE or AP-FRAMEWORK-LEAK site. The clean-architecture preset puts the Prisma client outside the services.
- **Hexagonal persistence port.** The translation-jobs use cases receive TypeORM's generic `Repository<T>` through `@InjectRepository` as their persistence port. Payments, notifications, the translation memory, the clock and id generation go through named ports (`src/application/ports/`) implemented by outbound adapters. This is the only host whose clean base could plausibly draw a judge remark: TypeORM's `Repository` type is named in the application layer. The live run's clean controls will show whether it does (§6).

## 3. Site counts

Counts are the operators' own site pass: `findSites` followed by the pipeline's precondition pass without judge placement (`eligibleSites` of `scripts/v1.3/judge-catch-seed.ts`), as rounds 1, 2 and v2 used it. Cells are `eligible / candidates`. The seeded operators are the five frozen anti-patterns, AP-DUP-RULE as v2. The v1 AP-DUP-RULE pair is listed for reference only.

| Operator | museum-loans | coworking-memberships | blood-drives | translation-jobs | total eligible |
|---|---:|---:|---:|---:|---:|
| AP-REPO-BYPASS | 23 / 23 | 15 / 15 | 20 / 20 | 14 / 14 | 72 |
| AP-REPO-BYPASSn | 23 / 23 | 15 / 15 | 20 / 20 | 14 / 14 | 72 |
| AP-FAT-CONTROLLER | 19 / 20 | 14 / 15 | 16 / 19 | 14 / 15 | 63 |
| AP-FAT-CONTROLLERn | 11 / 11 | 16 / 16 | 7 / 7 | 8 / 8 | 42 |
| AP-PERSIST-IN-DOMAIN | 8 / 8 | 7 / 7 | 7 / 7 | 7 / 7 | 29 |
| AP-PERSIST-IN-DOMAINn | 8 / 8 | 7 / 7 | 7 / 7 | 7 / 7 | 29 |
| AP-DUP-RULE (v1, reference) | 100 / 100 | 75 / 75 | 76 / 76 | 105 / 105 | 356 |
| AP-DUP-RULEn (v1, reference) | 100 / 100 | 75 / 75 | 76 / 76 | 105 / 105 | 356 |
| AP-FRAMEWORK-LEAK | 21 / 21 | 18 / 18 | 14 / 14 | 11 / 11 | 64 |
| AP-FRAMEWORK-LEAKn | 21 / 21 | 18 / 18 | 14 / 14 | 11 / 11 | 64 |
| AP-DUP-RULE2 | 100 / 100 | 75 / 75 | 76 / 76 | 105 / 105 | 356 |
| AP-DUP-RULE2n | 100 / 100 | 75 / 75 | 76 / 76 | 105 / 105 | 356 |

Every seeded operator and twin has at least 6 eligible sites on every host. The smallest cells are AP-PERSIST-IN-DOMAIN, with 7 or 8 domain classes per host, and AP-FAT-CONTROLLERn, with 7 to 16. All rejections are AP-FAT-CONTROLLER `type-shape`: a call argument that is not a plain name or field access (`Number(limit)`, `limit === undefined ? 20 : …`). For comparison, antipattern-nest offers 1 site each to AP-FAT-CONTROLLER and AP-DUP-RULE2, and 1 eligible site to AP-PERSIST-IN-DOMAIN.

AP-DUP-RULE's count is (rules) × (other service files): 20, 15, 19 and 15 distinct parameter rules respectively. The seeds use 6 distinct rules per host (§4).

## 4. Seeds and twins (fixed seed)

`npx tsx scripts/v1.3/ap-hosts-seed.ts --out <work>` with `SAMPLE_SEED = 20261016` and `--per-cell 6` (the default). The copies are made by the frozen round-1 harness, `applyOne` of `judge-catch-seed.ts`: copy the host, apply the edit with its fixed apply seed `20261015`, then type-check the copy with the repository's tsc (BR-U5a-07). A copy with any error is a `typecheck` rejection.

- **Sampling.** Per host and positive operator, the eligible sites are taken in a permutation from mulberry32(deriveSeed(20261016, {host, operator, 'select'})). Sites are tried in that order until 6 seeds type-check. AP-DUP-RULE2 seeds use distinct rules, because its twin does not touch the second service and two seeds of one rule would share one twin.
- **Twins.** Each seed gets one twin. For the four operators whose twin shares the positive's site pass, the twin is applied on the same site. AP-FAT-CONTROLLER's twin is chosen from the same handler call, then the same handler, then the same controller file, then the host. No twin site is used twice.
- **Result:** 120 seeds and 120 twins, 6 + 6 per operator per host. **0 rejected draws: every seeded and every twin copy type-checks.** Twin match: 96 same-site, 15 same-call, 4 same-file, 5 same-host.
- **Full sweep.** As a stronger check than the sample, `--sweep` applied every eligible site of all twelve registered entries, in memory, on every host (`smokeBase`): 1,859 applications, 0 that add a diagnostic, 0 apply errors. The coworking host was re-swept after its last edit (§7).
- **Judge volume.** 240 copies plus 4 clean controls (the unmodified hosts, `<work>/bases/<host>/`) give 244 evaluated projects. At 3 runs per unit and one probed function per row, that is about 730 live judge calls plus the controls' units. This is more than the 200-call budget of the v2 unit. `--per-cell 3` halves it, and `--only <host,…>` limits the hosts.

The manifest (`<work>/seed-manifest.json`) has the row format `judge-catch-run.ts` reads: `rows[].status`, `copyDir`, `baseId`, `specPath`, `role`, `positiveId`, plus `twinOf` and `twinMatch`. It also holds the site table and the per-cell counts.

## 5. Clean bases

The clean base should pass the judge and the symbolic rules. Neither the evaluator (Neo4j) nor the judge is available here, so two checks stand in for them:

- **Static clean-base check** (`scripts/v1.3/lib/ap-hosts-lint.ts`, run by the unit test). It is not the evaluator. It reads the extractor's APG under the v1.3 defaults through the in-memory mirrors (`v13DependencyDirection`, `v13NoCyclicDeps`, `v13DomainPurity`), and restates the remaining rules over the same APG or the import graph. Those rules are: the hexagonal allowed-dependency graph, domain/core outward imports, dependency inversion and use-case isolation over `CONSTRUCTOR_INJECTS`, controller → domain entity reach, the repository / port-adapter pattern, the SRP/ISP proxies, and the file metrics with the spec's thresholds and exclude paths. The blocking scope is the one the v1.3 reference projects use (`tests/fixtures/v1.3-reference/<style>/reference.json`): structural and pattern rules block, coupling metrics and SOLID proxies are advisory (FR-V6).
- **Result.** No blocking row on any host. No advisory row on the three non-hexagonal hosts. The hexagonal host has 7 advisory rows, pinned in the test: FF-C03 on four use cases and one inbound controller, each imported by one adapter, and FF-C03/FF-C02 on the composition root `src/config/main.ts`. The repository's own clean hexagonal reference project shows the same pattern (FF-C03 on its application services, FF-C03/FF-C02 on its container).

The authoritative symbolic check is the `full-mock` phase in §6, which evaluates the real Cypher templates on every clean control. The judge's verdict on the clean controls comes from the `record` phase.

## 6. Live run (local, with Neo4j and the pinned judge CLI)

```
npm ci
npx tsx scripts/v1.3/ap-hosts-seed.ts --out <work>          # optional: --per-cell 3, --only museum-loans,blood-drives
# Neo4j env: set -a; . ~/.daedalus-bt.env; set +a
npx tsx scripts/v1.3/judge-catch-run.ts full-mock <work>     # symbolic rows of every clean control and copy
npx tsx scripts/v1.3/judge-catch-run.ts plan <work>
npx tsx scripts/v1.3/judge-catch-run.ts dry <work>           # projected live calls; check against the budget
npx tsx scripts/v1.3/judge-catch-run.ts record <work> --budget <n> \
  --cassettes tests/fixtures/judge-cassettes-v13/judge-catch-ap-hosts --results results/v1.3-judge-catch/ap-hosts
npx tsx scripts/v1.3/judge-catch-run.ts replay <work> --cassettes tests/fixtures/judge-cassettes-v13/judge-catch-ap-hosts
```

`judge-catch-run.ts` already maps every positive used here, including AP-DUP-RULE2, to its probed function (FF-N01 or FF-N02). It is used unchanged. Scoring has no host-aware script yet. `judge-catch-v2-score.ts` is frozen and reads the v2 unit's layout, so scoring this run needs a new score script, or the v2 scorer's logic re-pointed at `results/v1.3-judge-catch/ap-hosts`. That work is outside this unit. Before trusting the catch numbers, check that the clean controls pass (§5): a failing control on a host makes that host's seeds uninformative for the failing function.

## 7. Freeze check

Every file hashed in `Docs/v1.3/judge-catch-frozen.md` still has its latest recorded sha256. That is 20 files: the operators, `registry.ts`, `types.ts`, `sites.ts`, the rubric, `frozen.ts`, and the seeding, run and score harness. The catalogue and `index.ts` match their v2 rows. The combined v2 registry digest recomputes to `afe879b51c3d1cd0c84a203e0f819000eccd427e155acb7db2c4480648764444`, as recorded. The unit test re-checks the hash table on every run.

The counts in §3 and the seeds in §4 come from the final commit of the hosts. One edit was made after the first seeding run: coworking's `toMembership` mapper (`src/prisma/membership.mapper.ts`) removes a row-to-domain mapping that two services duplicated. Seeding was then re-run and gave the same counts and 0 rejections, and the coworking host was re-swept.

## 8. Files

- `fixtures/unit/ap-hosts/{museum-loans,coworking-memberships,blood-drives,translation-jobs}/`: the hosts and their specs.
- `scripts/v1.3/ap-hosts-seed.ts`: site table, seeding and the sweep. It imports the frozen harness and does not change it.
- `scripts/v1.3/lib/ap-hosts-lint.ts`: the static clean-base check.
- `tests/unit/scripts/v1.3/ap-hosts.test.ts`: each host compiles, has 25 to 45 source files, and has ≥ 6 eligible sites per seeded operator and twin; no blocking clean-base row and only the pinned advisory rows; a seeded draw of every operator adds no diagnostic; twin pairing order; the freeze hashes.
