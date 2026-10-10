# E7 candidate research (2026-10-09)

Untracked research note. **No candidate was cloned, built or run through the firewall, and no DaedalusArch result for any candidate was looked at.** All facts come from the GitHub API (`gh` 2.88.1, authenticated, read-only) on 2026-10-09/10 (UTC). Candidates are judged only on their own properties.

## 1. Method

- **Repo searches** (`gh search repos … --language=typescript --archived=false --sort=stars --limit 20–25`): `topic:hexagonal-architecture`, `topic:ports-and-adapters`, `"hexagonal architecture"`, `"ports and adapters"`, `topic:clean-architecture topic:express|nodejs|fastify|nestjs`, `topic:ddd topic:typescript|koa`, `topic:domain-driven-design topic:nodejs`, `topic:hexagonal topic:typescript`, `topic:dependency-cruiser`, `topic:modular-monolith`, `topic:onion-architecture`. (Note: multi-topic queries returned near-identical lists, so `gh` treats them loosely.)
- **Code searches** (rate-limited, 10/min): `tsarch filename:package.json`, `arch-unit-ts filename:package.json`, `eslint-plugin-hexagonal-architecture filename:package.json`, `boundaries/element-types filename:.eslintrc`. Two further code queries hit the rate limit and were not retried.
- **Per-candidate probe** (78 repos probed): repo metadata, default-branch HEAD, recursive git tree at that SHA, root `package.json`, contributor and commit counts (from `Link` headers). The C2 count uses the registered rule: root `src/**/*.ts` minus `*.spec.ts`, `*.test.ts`, `*.d.ts`. AI files: `CLAUDE.md`, `AGENTS.md`, `.cursorrules`, `.cursor/rules`, `copilot-instructions.md`, `.windsurfrules`, `GEMINI.md`.
- **Fix-history mining**: the full first-parent commit list of 19 shortlisted repos (≈10.7k commits), with message lines grepped for cycle, boundary, violation, decouple and move-to/out-of-layer patterns. Each hit was then checked through `gh api repos/<r>/commits/<sha>` (file list and renames). **Commit diffs were only read. Whether the parent commit actually breaks a rule was NOT checked, because that needs tooling.**

Scores are 0–2: **1 Declared** (2 = the README or docs name the style and describe its layers; 1 = only topics or folder names). **2 Self-enforced** (2 = a committed rule file or test with layer rules). **3 Fix history** (2 = ≥3 boundary-fix commits or ≥2 clear ones; 1 = 1–2 plausible). **4 Hexagonal** (2 = explicit ports-and-adapters; 1 = clean with ports). **5 AI signals**. **6 Diversity** (non-Nest framework or new domain). **7 Realness** (2 = a real product with several contributors and tests; 0 = example or skeleton). C1–C6 are checked mechanically as in `Docs/corpus-criteria.md`. C4 is read as "has a named style" (see §5 for the query problem).

## 2. Ranked table

| # | Repo | HEAD (2026-10-09) | Style | Framework | src files | 1 | 2 | 3 | 4 | 5 | 6 | 7 | Total | C1–C6 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | raouf-b-dev/ecommerce-store-api | `08b0760ad501bbe25b612a4e4e2673ad4b9d17d6` | hexagonal | Nest | 793 | 2 | 2 | 2 | 2 | 2 | 1 | 1 | **12** | **FAIL C2** (793) |
| 2 | marcoturi/fastify-boilerplate | `084639798a3c992b0c00df8553cdf78d2cc40d15` | clean/hex | Fastify | 65 | 2 | 2 | 0 | 2 | 2 | 2 | 1 | **11** | **FAIL C5** (pnpm) |
| 3 | nmrusso/node-experience | `eba0ef476c854012d908c263373701d0032a42ed` | clean+DDD | Fastify/Koa | 286 | 2 | 2 | 1 | 1 | 0 | 2 | 1 | **9** | **FAIL C5** |
| 4 | zhuravlevma/typescript-ddd-architecture | `025ace5cff0efa8307a1e7e694d0c54bcde3bb18` | hexagonal | Nest | 187 | 2 | 2 | 1 | 2 | 0 | 0 | 1 | **8** | pass |
| 5 | fairnesscoop/permacoop | `1eb778033a12d8ef4c8ed5f02c0dc2e640c7c4c2` | hexagonal+CQRS | Nest | 323 | 1 | 0 | 2 | 2 | 0 | 1 | 2 | **8** | **FAIL C2** (323) |
| 6 | Sairyss/domain-driven-hexagon | `5c2d15a7e2d69e83dfddf28468ee9f30e02c30de` | hexagonal | Nest | 82 | 2 | 2 | 0 | 2 | 0 | 1 | 1 | **8** | **FAIL C5** |
| 7 | verdict-engine/verdict-engine | `948bd3f6ab7e138c14cee7fd55d7ad3b0e6a2838` | modular monolith + ports | Nest | 209 | 2 | 2 | 0 | 1 | 2 | 1 | 0 | **8** | pass |
| 8 | AlbertHernandez/nestjs-hexagonal-architecture-example | `dbb23feceb117c22f3ea04caee5bc20884203ae8` | hexagonal | Nest (Fastify adapter) | 30 | 2 | 0 | 1 | 2 | 0 | 1 | 0 | **6** | pass |
| 9 | bartosz-io/budget-node | `ff7311f03d92e4a48eebcc00004fdca97c494fbd` | layered | Express | 68 | 1 | 2 | 0 | 0 | 0 | 2 | 1 | **6** | pass |
| 10 | rmanguinho/clean-ts-api | `65d0b790eb4d7106c56b3f9326d75433005bb243` | clean | Express | 180 | 2 | 0 | 1 | 1 | 0 | 1 | 1 | **6** | pass |
| 11 | cecric/hexapinod | `bdc74deedc99479ea92e545a1254ef92a47c9132` | hexagonal | Express | 49 | 2 | 0 | 0 | 2 | 0 | 2 | 0 | **6** | pass |
| 12 | diego3g/umbriel | `9e6195e51a4333f5cfed3bf1442d3c8586329393` | clean (core/infra/modules) | Express | 276 | 1 | 0 | 1 | 0 | 0 | 2 | 2 | **6** | **FAIL C5** (yarn) |
| 13 | pvarentsov/typescript-clean-architecture | `5c29c39e402c67105ca66ec4dd2a4cf84b285e39` | clean with ports | Nest | 185 | 2 | 0 | 1 | 1 | 0 | 0 | 1 | **5** | pass |
| 14 | hafizhAR639/SuroParkAPI | `f926a2fb2cb9b11bf80cf265a61f4a449497f0ae` | clean (layered) | Express | 56 | 2 | 2 | 0 | 0 | 0 | 1 | 0 | **5** | pass |
| 15 | stemmlerjs/ddd-forum | `24df03e5e3f617065855266fcf7250425f6e53b5` | clean+DDD | Express | 248 | 2 | 0 | 0 | 0 | 0 | 2 | 1 | **5** | pass |

All 15 repos have OSI licences (MIT, ISC, Apache-2.0 or GPL-3.0), a backend package, are not archived and are not forks. In every row marked "pass", root `package-lock.json` is tracked.

**Screened out** (selection):
- `CodelyTV/typescript-ddd-example` has no licence (C1).
- `45ck/Portarium` is hexagonal, has dependency-cruiser, CLAUDE.md and ADRs, but has 528 files (C2) and no backend package (C3).
- `BrahimAbdelli/nestier`, `jbreckmckye/node-typescript-architecture` and `mikemajesty/nestjs-microservice-boilerplate-api` have no licence.
- `talyssonoc/node-api-boilerplate`, `medevorg/nodetskeleton`, `4lessandrodev/finance-project-ddd`, `TheGoatedDev/EnterpriseNest` and `CollatzConjecture/nestjs-clean-architecture` have no npm lock (C5).
- `bitloops/ddd-hexagonal-cqrs-es-eda` and `VincentJouanne/nest-clean-architecture` are monorepos with no root `src/`.
- `fmcarrero/nest-js-products-api` (23 files) and `tim-hub/nestjs-hexagonal-example` (12 files) are tiny examples.
- `rmanguinho/advanced-node`, `0xb4lamx/nestjs-boilerplate-microservice` and `dyarleniber/simple-blog-application-backend-challenge` pass C1–C6 but have weaker signals.

## 3. Per-candidate notes (evidence)

1. **raouf-b-dev/ecommerce-store-api**
   - Declared: README links `docs/architecture/DDD-HEXAGONAL.md` and `ARCHITECTURE.md`, with ADRs in `docs/architecture/adr`. Payments are a "Mock adapter behind a swappable hexagonal port".
   - Enforced: `test/architecture/hexagonal-architecture.spec.ts` (archunit, 9 rules). Examples: "Core must not depend on primary-adapters", "Domain must not depend on application", "No circular dependencies in core", "Core of module X must not depend on other modules".
   - AI files: `AGENTS.md`, `.github/copilot-instructions.md`, `.cursor/rules/*.mdc`, `.windsurfrules`, `.claude/`, `.gemini/`.
   - Size: 1,843 commits, 243 test files, 4 contributors. It is a portfolio-grade project, not a product.
   - Fails C2 by a wide margin (793 files).
2. **marcoturi/fastify-boilerplate**
   - Declared: "built on Clean Architecture, CQRS, DDD", with the hexagon diagram adapted from domain-driven-hexagon.
   - Enforced: `.dependency-cruiser.cjs` with rules `no-domain-to-infra-deps`, `no-domain-to-app-deps`, `no-cross-module-deps`, `no-handler-to-infra-deps` and `no-circular`.
   - AI files: `CLAUDE.md`, `AGENTS.md`.
   - No fix pairs: `beb8d9b` only tightened the dependency-cruiser config.
   - Uses pnpm, so it fails C5.
3. **nmrusso/node-experience**
   - Declared: "Clean Architecture + DDD".
   - Enforced: `.dependency-cruiser.js` (`domain-not-to-infra-or-presentation`, `no-circular`), plus `madge`, added in `11ed13c` "add madge to check circular dependencies".
   - Size: 22 contributors, 711 commits.
   - No npm lock, so it fails C5.
4. **zhuravlevma/typescript-ddd-architecture**
   - Declared: README says "Domain model with a clean architecture with ports and adapters".
   - Enforced: `test/arch/layer-depends.spec.ts`, which uses the in-repo `src/__lib__/ts-arch` helper. Rules include "Domain layer should not depend on dal/controllers".
   - Caveat: same author as the corpus project `zhuravlevma__nestjs-active-record`, so it adds no author diversity.
5. **fairnesscoop/permacoop**
   - A real cooperative ERP: 21 contributors, 90 test files, codecov.
   - Layout is `src/Domain|Application|Infrastructure`. Topics are `hexagonal-architecture`, `ddd`, `cqrs`, but the README only lists the stack.
   - Has the best real fix history (§4). Its pre-2021 commits live under `server/src`, so the pairs need a path prefix.
   - Fails C2 with 323 files (23 over the limit).
6. **Sairyss/domain-driven-hexagon**
   - The reference hexagonal template.
   - Enforced: `.dependency-cruiser.js` (`no-domain-to-infra-deps`, `no-domain-to-app-deps`, `no-infra-to-api-deps`), added in `760e605`.
   - Last commit 2024-05. No npm lock, so it fails C5.
7. **verdict-engine/verdict-engine**
   - Declared: README says "NestJS modular monolith. Its bounded contexts communicate through typed ports and domain events".
   - Enforced: `.eslintrc.cjs` uses `boundaries/elements` and `boundaries/element-types`.
   - AI files: `AGENTS.md`, `.agents/`.
   - Only 5 commits and 1 contributor, created 2026. Probably an AI-built snapshot: useful as an AI-signal case, weak on realness.
8. **AlbertHernandez/nestjs-hexagonal-architecture-example**
   - Declared: README says "how to create a NestJS service using the hexagonal architecture", with `src/contexts/*/{application,domain,infrastructure}`.
   - The README also says it is not a template and is not kept up to date.
   - Has two small boundary-fix commits (§4).
9. **bartosz-io/budget-node**
   - Layered Express: controllers, services, repositories.
   - Enforced: tsarch rules in `arch/app.spec.ts` and `arch/dashboard.spec.ts`, e.g. "controllers should not depend on apis". Some rules are `it.skip`, which itself marks known violations.
   - It is the only layered-style candidate that passes C1–C6, which matters because the registered rule has `preferLayered`.
   - GPL-3.0.
10. **rmanguinho/clean-ts-api**
    - Declared: README says "Clean Architecture", with layers `src/{domain,data,infra,presentation,main}`. Data "protocols" act as ports.
    - Single author, 580 commits, 41 test files. It is a course project.
    - Has no layer-rule configuration (only plain `eslint-plugin-import`).
11. **cecric/hexapinod**
    - A "Hexagonal Architecture API Framework/Skeleton in TypeScript … expressJS". The README describes its folders.
    - A skeleton, with its last commit in 2022.
12. **diego3g/umbriel**
    - Rocketseat's real mailing tool: 98 test files.
    - Layout is `core/infra/modules`. Has the fix commit `8f9535a`.
    - Uses yarn, so it fails C5. Last commit 2021.
13. **pvarentsov/typescript-clean-architecture**
    - Clean architecture with explicit `core/domain/*/port`.
    - Has two "move shared out of domain" commits.
14. **hafizhAR639/SuroParkAPI**
    - Enforced: `.dependency-cruiser.cjs` (`domain-no-framework`, `usecases-no-outer`, `no-circular`) plus eslint-plugin-boundaries.
    - Only 3 commits, 1 contributor.
15. **stemmlerjs/ddd-forum**
    - Declared: README says the app is "built … using the clean architecture" and describes clean architecture at length.
    - No rule configuration and no fix commits.

## 4. Mined architecture-fix commits (candidate before/after pairs)

The parent is "before" and the SHA is "after". Strength is judged from the message and the file list only. None of them were run through any tool.

| Repo | SHA | Date | Message / evidence | Strength |
|---|---|---|---|---|
| fairnesscoop/permacoop | `1056d6d8a622d484199fb7a9f1b37223cd058dbd` | 2020-11-15 | "remove dependency from adapter to domain": removes `Domain/HumanResource/Leave/ILeavePeriod.ts`, changes `Infrastructure/Adapter/DateUtilsAdapter.ts` and `Application/IDateUtils.ts` | strong |
| fairnesscoop/permacoop | `15f753c8e9e5ce5ad58f5f73ef0128b01b8f4b7b` | 2019-12-19 | "Extract Activity from project domain": renames `Application/Project/.../Activity` to `Application/Activity` | medium (context split) |
| fairnesscoop/permacoop | `244bf679a1d19e63932a067600b28d63df7d8a3b` | 2020-02-24 | "Remove the term adapter in the application layer (#64)": removes `Application/Adapter/I*BusAdapter.ts` | weak (naming) |
| raouf-b-dev/ecommerce-store-api | `acda9e0a91ff74f82d5648508c21bc3ec2c3d3ce` | 2026-04-11 | moves `orders/core/domain/services/shipping-address-resolver.ts` to `core/application/services/` | strong (domain → application) |
| raouf-b-dev/ecommerce-store-api | `9c2429c5954f9fd83d1783b35f1ce10029b133be` | 2026-01-14 | PR #65 "decouple cross-module dependencies in orders": adds `application/ports/*.gateway.ts` and `infrastructure/adapters/module-inventory.gateway.ts` (merge commit; use first parent) | strong (cross-module → port) |
| raouf-b-dev/ecommerce-store-api | `f3333d1ca411103a794b6caa9441686260a3c059` | 2026-03-01 | PR #72 "isolate bounded contexts with gateway adapters": adds `auth/core/application/ports/customer.gateway.ts` (merge) | strong |
| raouf-b-dev/ecommerce-store-api | `bb0e295add00c59f896f18e65a6b0ff0ace23119` | 2026-05-15 | "refactor(arch): harden DDD boundaries and hexagonal isolation": 29 files, domain repository ports and secondary adapters | medium |
| nmrusso/node-experience | `ddb293f391ef381c508c5f02275d6ff396ab1f3e` | 2023-10-28 | "remove controller from item and file domain": 17 files in `File/Domain/UseCases/*` | strong |
| nmrusso/node-experience | `4ff72b96f53662b0e109f600a5eead550a2fe2bd` | 2023-10-28 | "decouple AppKoa": `Shared/Application/Http/*`, new `KoaBootstrapping.ts` | weak |
| AlbertHernandez/nestjs-hexagonal-architecture-example | `4911cbfa5f7184d6630a874b8f77ad5e117a5c54` | 2024-06-21 | "remove domain in dependency injection": moves `shared/dependency-injection/domain/injectable.ts` up a level | medium |
| AlbertHernandez/nestjs-hexagonal-architecture-example | `4e1ab4d7ea0277272bd007851ec63f6187cb2f43` | 2024-06-21 | "duplicate v1 to not import from outside": the context stops importing `src/http-api/routes` | medium |
| pvarentsov/typescript-clean-architecture | `15efa381d694105a6458fe94d0a7079797c6bab8` | 2020-07-12 | "Move core/domain/.shared to core/shared": the bus ports leave `domain` | medium |
| pvarentsov/typescript-clean-architecture | `574ed3425a7accf7d561ae0164ba6ea61fe80d9e` | 2020-07-13 | "Move entity enums to core/shared" | weak |
| zhuravlevma/typescript-ddd-architecture | `100deb60d81f1cfa55fece8500ba3bebc28bae3d` | 2023-05-02 | "fix: move typeorm to infra": `app.module.ts` and `infrastructure.module.ts` | weak (wiring only) |
| diego3g/umbriel | `8f9535a2601ab49dd9f70f902dfc1c29ce3e8496` | 2021-08-01 | "Move validators implementation to infra layer": `infra/http/validation` → `infra/validation`, and `Validator.ts` → `core/infra` | medium |
| rmanguinho/clean-ts-api | `27c56c6395bae5702578dc8fab206f2c6a9e912d` | 2020-05-01 | "move the responsibility to load the survey result to UseCase" | weak |

That makes **16 pairs: 6 strong, 6 medium, 4 weak.** Only 3 of the 16 come from repos that pass C1–C6 and are strong or medium: AlbertHernandez ×2 and pvarentsov `15efa38`. The richest sources (raouf, permacoop) fail C2. No commit message anywhere mentioned "circular" or "cycle" as a fix; the only hits were commits that added cycle checkers (`nmrusso 11ed13c`, `Sairyss 760e605`).

## 5. Recommendation

The candidates that pass C1–C6 as registered and add the most:

1. **zhuravlevma/typescript-ddd-architecture**: hexagonal, with author-written layer tests that could serve as an oracle, plus 1 fix commit. Its only weakness is that it shares an author with a corpus project.
2. **bartosz-io/budget-node**: the only eligible *layered* repo, with tsarch rules (including `it.skip` rules that mark known violations). It uses Express.
3. **AlbertHernandez/nestjs-hexagonal-architecture-example**: explicit hexagonal, with 2 real boundary-fix pairs. It is small (30 files).
4. **cecric/hexapinod**: hexagonal on Express, giving style × framework diversity. It is a skeleton.
5. **rmanguinho/clean-ts-api**: clean architecture on Express, with long single-author history and many tests.
6. (Optional, for the AI-signal angle) **verdict-engine/verdict-engine**: eslint-boundaries plus AGENTS.md. Very thin history.

The near-misses (raouf: C2; permacoop: C2; marcoturi, nmrusso, Sairyss, umbriel: C5) are the best on self-enforcement and fix history. **They must stay excluded unless C2 or C5 are changed by a dated decision before the list is built.** Relaxing the criteria after seeing these names would be exactly the post-hoc move that BR-U5b-68 forbids. Their fix commits can still serve as *external* mutation-realism references without joining the evaluated corpus, but that use must also be declared beforehand.

**The registered query set alone would not find most of these.** Q1–Q6 all require the `nestjs` topic (or `layered-architecture`). Of the eligible picks above, budget-node, hexapinod and clean-ts-api are Express and would never enter `candidates.json`. Including them requires the extension below.

## 6. Proposed selection-rule extension (to register before E7)

Proposed wording for `Docs/corpus-criteria.md` §2–§3. Date it, commit it, and register it in `corpus/prereg.json` **before** `candidates.json` is generated.

> **Extension E7-x, dated 2026-10-09.** Disclosure: drafted after the API-only research in `Docs/DiagnosticRuns/e7-candidate-research-2026-10-09.md`. No candidate was run.
>
> 1. **Extra queries** (same flags as Q1–Q6, appended after Q6 so the existing order is unchanged):
>
>    | Query | Topics | Style |
>    |---|---|---|
>    | Q7 | `hexagonal-architecture` | `clean-architecture` |
>    | Q8 | `ports-and-adapters` | `clean-architecture` |
>    | Q9 | `clean-architecture`, `express` | `clean-architecture` |
>    | Q10 | `clean-architecture`, `fastify` | `clean-architecture` |
>
>    Q7 and Q8 map to `clean-architecture` until the spec compiler has a `hexagonal` template. If one is added before the freeze, change the style for Q7 and Q8 to `hexagonal` and add it to `styleOrder` after `clean-architecture`.
>
> 2. **C1–C6 unchanged.** No relaxation of C2 or C5.
>
> 3. **Recorded attributes**, all computed from the recorded SHA by API only:
>    - **E (enforced) ∈ {0,1}**: the tree has `.dependency-cruiser.{js,cjs,mjs,json}`, *or* root `package.json` (deps or devDeps) lists one of `dependency-cruiser`, `eslint-plugin-boundaries`, `tsarch`, `arch-unit-ts`, `archunit`, `eslint-plugin-hexagonal-architecture`.
>    - **H (hexagonal) ∈ {0,1}**: found by Q7 or Q8, *or* the root README matches `/hexagonal|ports\s*(and|&)\s*adapters/i`.
>    - **F (fix history) ∈ {0,1}**: at least one first-parent commit reachable from the recorded SHA meets both conditions:
>      - its first message line matches `/(circular|cyclic|cycle|violat|boundar|decoupl|(move|moved|extract|remove)\b.*\b(domain|application|infra|infrastructure|adapter|port|layer|core)\b)/i`;
>      - it touches at least one file under `src/`.
>    - **R (real) ∈ {0,1}**: contributors ≥ 3 and commits ≥ 50 and at least one `*.spec.ts`/`*.test.ts` in the tree.
>    - **A (AI signal)**: recorded only (`CLAUDE.md`, `AGENTS.md`, `.cursorrules`, `.cursor/rules/`, `.github/copilot-instructions.md`, `.windsurfrules`, `GEMINI.md`). **It is not used for selection**, so it stays an analysis covariate.
>
> 4. **Selection.** `preferLayered` stays as step 2. Then, instead of one undifferentiated draw, eligible candidates are partitioned into tiers by **P = E + H + F + R** (0–4). Tiers are drawn from highest to lowest. Within a tier, the order is drawn with the same `mulberry32(seed)` stream, until `addMax` is reached.
>
> 5. **Tie-break.** The seeded RNG only, never stars, names or dates. Same seed plus same `candidates.json` gives the same selection.
>
> 6. **Diversity cap.** At most one selected project per GitHub owner, and none from an owner already in the corpus (`zhuravlevma`, `nestjslatam`, `v-aguiar`, …). A capped candidate is recorded as `owner-cap` and the draw continues.
>
> 7. **Shortfall.** Fewer than `addMin` eligible candidates still ends with `CORPUS_SHORTFALL`. No criteria are relaxed after the list is seen.

Open decisions:
- **(a)** Whether to apply the owner cap to `zhuravlevma`. As written, it excludes rank 4.
- **(b)** Whether to accept `pnpm-lock.yaml`/`yarn.lock` under a new install policy. This would admit 4 strong near-misses. It is defensible only if the installer really supports them, and it must be decided and dated before regeneration, with this disclosure.
- **(c)** Whether fix-history pairs from ineligible repos may be used as external realism references.
