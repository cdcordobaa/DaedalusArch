# Corpus Selection Criteria

Dated 2026-10-08, before any candidate list or selection is committed (ADR-017 item 1; BR-U5b-68; FR-v1.2E-36). Extended 2026-10-09 by §7 (extension E7-x, ADR-027), before `corpus/candidates-e7x.json` was generated; §1–§6 are the round-1 rule and still reproduce `corpus/selection.json`. The five projects of `Docs/corpus.md` are the frozen core (ADR-015 item 3). E7 adds 3–5 open-source projects chosen under the criteria below, with a fixed seed, to reach 8–10 projects. The candidate list (`corpus/candidates.json`), the selection (`corpus/selection.json`) and the added `corpus/corpus.json` entries are committed after this file and registered (`corpus/prereg.json`) before any run on the added projects.

## 1. Inclusion criteria (every candidate)

| # | Criterion | How it is checked (no clone is evaluated) |
|---|---|---|
| C1 | OSI-approved licence | GitHub `license.key` is in the licence list of the machine block. `other`, `none` or a missing licence excludes the candidate (`licence-not-osi`). |
| C2 | 20–300 TypeScript source files (NFR-v1.2E-07); **20–800 in the E7-x round** (§7, ADR-027 decision 3) | Counted from the git tree at the recorded commit (`gh api repos/<owner>/<repo>/git/trees/<sha>?recursive=1`): files under the root `src/` ending in `.ts`, excluding `*.spec.ts`, `*.test.ts` and `*.d.ts` (the rule used for the core counts below). A truncated tree response excludes the candidate (`tree-truncated`); no root `src/` (`files-out-of-range`, count 0). |
| C3 | TypeScript backend | The root `package.json` at the recorded commit lists one of the backend packages of the machine block in `dependencies` (`not-backend`). |
| C4 | Named style | The search query that found the candidate names one of the styles the spec compiler knows (`clean-architecture`, `layered`, `nestjs`; `src/spec-parser/template-registry.ts`). A candidate found by several queries takes the first style in the machine block's `styleOrder`. |
| C5 | Reproducible install (unchanged in E7-x: `pnpm-lock.yaml` and `yarn.lock` do not count, ADR-027 decision 2) | A tracked root `package-lock.json` at the recorded commit, so the install policy can be `npm-ci-ignore-scripts` with a lock-file sha256 (BR-U5b-66) (`no-package-lock`). |
| C6 | Not archived, not a fork, not a core project | GitHub `isArchived` / `isFork` false; the origin URL differs from every core origin (`archived`, `fork`, `core-duplicate`). In the E7-x round it also differs from every other `corpus/corpus.json` origin, so a round-1 project, admitted or excluded, is not drawn again (`corpus-duplicate`). |

## 2. Selection rule (seeded)

1. Candidates are sorted by `name` (`owner/repo`); each is checked against C1–C6 in that order; the first failing criterion is the exclusion reason.
2. If `preferLayered` is true and at least one eligible candidate has style `layered`, one `layered` candidate is drawn first with the seeded RNG (`mulberry32(seed)`, `scripts/lib/mutation/rng.ts`). If none is eligible, the reason `no eligible layered candidate` is written into `corpus/selection.json`.
3. The remaining eligible candidates are drawn with the same RNG until `addMax` projects are selected or the eligible set is exhausted.
4. Fewer than `addMin` eligible candidates stops selection with `CORPUS_SHORTFALL`; the criteria are not relaxed after looking at the list.
5. Every eligible candidate not drawn is recorded with the reason `not drawn`.

The same seed and the same candidate list always give the same `corpus/selection.json` (BR-U5b-68).

## 3. Candidate search procedure

- **Tool**: GitHub CLI `gh` 2.88.1 (`gh search repos`, `gh api`), authenticated, read-only.
- **Date**: the search date is written into `corpus/candidates.json` (`searchedAt`); the commit recorded for each candidate is its default-branch HEAD at that time (`gh api repos/<owner>/<repo>/commits/<branch>`).
- **Queries** (each `--language=typescript --archived=false --sort=stars --limit 30`, JSON fields `fullName,url,license,isArchived,isFork,defaultBranch`), in this order:

  | Query | Topics | Style |
  |---|---|---|
  | Q1 | `nestjs`, `layered-architecture` | `layered` |
  | Q2 | `layered-architecture`, `express` | `layered` |
  | Q3 | `nestjs`, `clean-architecture` | `clean-architecture` |
  | Q4 | `nestjs`, `ddd` | `clean-architecture` |
  | Q5 | `nestjs`, `hexagonal-architecture` | `clean-architecture` |
  | Q6 | `nestjs` (and `--stars=">=200"`) | `nestjs` |

- **Recorded per candidate**: `name`, `originUrl`, `licence`, `commitSha`, `fileCount`, `style`, `backend`, `hasPackageLock`, `isArchived`, `isFork`, and the queries that found it. Candidates are deduplicated by `name`.
- **No clone** of a candidate is made or evaluated before selection. Only the selected projects are cloned, by `fetch-corpus`, after their `corpus/corpus.json` entries are committed.

## 4. Added-entry decisions (fixed before selection)

For every selected project: `install` = `npm-ci-ignore-scripts` with the sha256 of the root `package-lock.json` at the recorded commit; `tsc` = `project` with `tscPath` `node_modules/typescript/bin/tsc` and `tscVersion` = the `node_modules/typescript` version in that lock file (verified as `node <tscPath> --version` by `prepare-bases`); no overlay unless `fetch-corpus --check` shows the default tsconfig cannot load the root `src/` (then a configuration-only overlay, recorded with its sha256); `specPath` = `corpus/specs/<project>.yaml`, written in the E7 mapping step (OI-12).

## 5. Core projects (grandfathered) and licence notes

| Project | Licence note | Use |
|---|---|---|
| `dev-nest` | **Ambiguous**: `package.json` says ISC, the README says MIT, no licence file. Both permissive. | Read and analysed; not redistributed. |
| `realworld-test` | ISC from `package.json` only (no licence file). | Read and analysed; overlay `src/config.ts` from the repository's own `config.ts.example`. |
| `ghostfolio-test` | **AGPL-3.0**. | Read-only use: the source is analysed, never redistributed or modified beyond a configuration-only overlay (`apps/api/tsconfig.json`). |
| `truthy-demo` | MIT. | Read and analysed. |
| `dry-run-test` | MIT. | Read and analysed; configuration-only overlay (`tsconfig.json`). |

**AGPL overlays are configuration-only**: an overlay on an AGPL project may change build configuration (tsconfig, lock files) and nothing else; no source file of an AGPL project is patched or committed here.

Core file counts under rule C2 (root `src/`, or `apps/api/src` for ghostfolio): dev-nest 75, realworld-test 34, ghostfolio-test 241, truthy-demo 131, dry-run-test 156 (all within 20–300).

## 6. Machine block

`scripts/select-corpus.ts` reads this block; it is the only machine-readable copy of the criteria.

```yaml corpus-criteria
version: 1
licences: [mit, isc, apache-2.0, bsd-2-clause, bsd-3-clause, mpl-2.0, lgpl-3.0, gpl-3.0, agpl-3.0, unlicense]
minFiles: 20
maxFiles: 300
styles: [layered, clean-architecture, nestjs]
styleOrder: [layered, clean-architecture, nestjs]
backendPackages: ["@nestjs/core", express, fastify, koa, "@hapi/hapi"]
preferLayered: true
addMin: 3
addMax: 5
seed: 20261008
# Extension E7-x (§7, ADR-027), dated 2026-10-09. The keys above stay the round-1 values.
extension:
  id: E7-x
  registeredOn: 2026-10-09
  minFiles: 20
  maxFiles: 800
  addMin: 3
  addMax: 6
  seed: 20261008
  ownerCap: 1
  hexagonalQueries: [Q7, Q8]
  hexagonalReadme: 'hexagonal|ports\s*(and|&)\s*adapters'
  enforcementFiles: [.dependency-cruiser.js, .dependency-cruiser.cjs, .dependency-cruiser.mjs, .dependency-cruiser.json]
  enforcementPackages: [dependency-cruiser, eslint-plugin-boundaries, tsarch, arch-unit-ts, archunit, eslint-plugin-hexagonal-architecture]
  fixMessage: '(circular|cyclic|cycle|violat|boundar|decoupl|(move|moved|extract|remove)\b.*\b(domain|application|infra|infrastructure|adapter|port|layer|core)\b)'
  fixPathPrefix: src/
  realMinContributors: 3
  realMinCommits: 50
  aiFiles: [CLAUDE.md, AGENTS.md, .cursorrules, .cursor/rules/, .github/copilot-instructions.md, .windsurfrules, GEMINI.md]
```

## 7. Extension E7-x (dated 2026-10-09; ADR-027)

**Disclosure.** This extension was drafted **after** the API-only research of `Docs/DiagnosticRuns/e7-candidate-research-2026-10-09.md`, which had seen candidate names and their properties, and **before** any firewall run, clone, build or DaedalusArch result on any candidate. It is committed before `corpus/candidates-e7x.json` is generated. The author decisions it carries (owner cap, lock files, size) are ADR-027 decisions 1–3, dated 2026-10-09. The round-1 rule (§1–§6, `corpus/candidates.json`, `corpus/selection.json`) is unchanged and still reproducible; E7-x is a second, separate draw whose additions join E7 only, never the frozen SO4 golden set.

### 7.1 Criteria in the E7-x round

- C1, C3, C4 and C5 as in §1. **C5 stays npm-only**: `fetch-corpus` and `prepare-bases` support only the install policy `npm-ci-ignore-scripts` (a hash-pinned `package-lock.json`), and no reproducible pnpm or yarn install exists in the tools (ADR-027 decision 2). `pnpm-lock.yaml` and `yarn.lock` are recorded per candidate (`hasPnpmLock`, `hasYarnLock`) but do not satisfy C5.
- **C2: 20–800** source files, counted as in §1 (ADR-027 decision 3; NFR-v1.2E-07 amended 2026-10-09).
- **C6** as in §1, plus `corpus-duplicate`: the origin equals any `corpus/corpus.json` origin (round-1 additions included, admitted or excluded).

### 7.2 Extra queries

Same flags as Q1–Q6 (`--language=typescript --archived=false --sort=stars --limit 30`), appended after Q6 so the existing order is unchanged:

| Query | Topics | Style |
|---|---|---|
| Q7 | `hexagonal-architecture` | `clean-architecture` |
| Q8 | `ports-and-adapters` | `clean-architecture` |
| Q9 | `clean-architecture`, `express` | `clean-architecture` |
| Q10 | `clean-architecture`, `fastify` | `clean-architecture` |

Q7 and Q8 map to `clean-architecture`: the spec compiler has no `hexagonal` template or preset (`src/spec-parser/template-registry.ts` registers `clean-architecture`, `nestjs`, `layered`; `presets/` holds the same three; ADR-027 Context). The E7 spec rule (`Docs/e7-spec-rule.md`) assigns the spec style from the directory structure, independent of the query style.

### 7.3 Recorded attributes

Computed by API only (`gh api`), at the recorded commit, for every candidate that passes C1–C6 in the E7-x round (they play no role for an excluded one, so they are not fetched for it):

- **E (enforced) ∈ {0,1}**: the tree has one of `enforcementFiles`, or the root `package.json` lists one of `enforcementPackages` in `dependencies` or `devDependencies`.
- **H (hexagonal) ∈ {0,1}**: found by Q7 or Q8 (`hexagonalQueries`), or the root README (`gh api repos/<r>/readme?ref=<sha>`) matches `/hexagonal|ports\s*(and|&)\s*adapters/i` (`hexagonalReadme`).
- **F (fix history) ∈ {0,1}**: at least one first-parent commit reachable from the recorded commit (followed from it through `parents[0]` in the `repos/<r>/commits?sha=<sha>` listing) has a first message line matching `fixMessage` (case-insensitive) and touches at least one file under `src/` (`repos/<r>/commits/<sha>` file list, renames by their new and old path).
- **R (real) ∈ {0,1}**: contributors ≥ 3 (`repos/<r>/contributors?anon=1`; the API counts the default branch, not the recorded commit) and commits reachable from the recorded commit ≥ 50 and at least one `*.spec.ts` or `*.test.ts` in the tree.
- **A (AI signal)**: the `aiFiles` present in the tree (exact paths; `.cursor/rules/` as a prefix). **Recorded only, never used for selection**; it stays an analysis covariate.

### 7.4 Selection (seeded)

1. Candidates sorted by `name`, checked against §7.1 in §1's order; the first failing criterion is the reason.
2. Fewer than `extension.addMin` eligible candidates ends with `CORPUS_SHORTFALL`. No criterion is relaxed after the list is seen.
3. One RNG, `mulberry32(extension.seed)`. If `preferLayered` and an eligible `layered` candidate exists, one is drawn first (`rng.pick`); otherwise the reason is recorded.
4. The remaining eligible candidates are partitioned into tiers by **P = E + H + F + R** (0–4). Tiers are taken from the highest P to the lowest. Within a tier the order is the seeded permutation `rng.pickDistinct(tier, |tier|)` of the tier sorted by name. Candidates are taken in that order until `extension.addMax` = **6** are selected (the extension text names no number; the author's fallback is "up to 6 additions", and tiers are taken top-down as the extension specifies).
5. **Tie-break**: the seeded RNG only, never stars, names, dates or attributes other than P.
6. **Owner cap** (ADR-027 decision 1): at most `ownerCap` = 1 selected project per GitHub owner within this round. A candidate whose owner already has a selected project in this round is recorded `owner-cap` and the draw continues. An owner already present in `corpus/corpus.json` (core or round 1) is **not** excluded and may contribute a different repository (C6 still excludes the same origin); the author overlap is declared as a threat (TV entry with ADR-027).
7. Every eligible candidate not selected is recorded `not drawn` (or `owner-cap`).
8. Outputs: `corpus/candidates-e7x.json` (search, attributes), `corpus/selection-e7x.json` (selected with tier and draw, excluded with reasons). Same seed and same candidate list give the same selection.

### 7.5 Added-entry decisions

As §4. Every selected project then goes through `fetch-corpus`, the registered E7 spec generator (`Docs/e7-spec-rule.md`, project appended to its `projects` list, no hand edit), the Mock-derived baseline selection (DV-BT-2), `prepare-bases`, the base type-check and import-graph parity. A project that fails any step is **excluded without repair**, with the reason recorded in `Docs/corpus.md`.
