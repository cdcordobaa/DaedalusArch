# Corpus Selection Criteria

Dated 2026-10-08, before any candidate list or selection is committed (ADR-017 item 1; BR-U5b-68; FR-v1.2E-36). The five projects of `Docs/corpus.md` are the frozen core (ADR-015 item 3). E7 adds 3–5 open-source projects chosen under the criteria below, with a fixed seed, to reach 8–10 projects. The candidate list (`corpus/candidates.json`), the selection (`corpus/selection.json`) and the added `corpus/corpus.json` entries are committed after this file and registered (`corpus/prereg.json`) before any run on the added projects.

## 1. Inclusion criteria (every candidate)

| # | Criterion | How it is checked (no clone is evaluated) |
|---|---|---|
| C1 | OSI-approved licence | GitHub `license.key` is in the licence list of the machine block. `other`, `none` or a missing licence excludes the candidate (`licence-not-osi`). |
| C2 | 20–300 TypeScript source files (NFR-v1.2E-07) | Counted from the git tree at the recorded commit (`gh api repos/<owner>/<repo>/git/trees/<sha>?recursive=1`): files under the root `src/` ending in `.ts`, excluding `*.spec.ts`, `*.test.ts` and `*.d.ts` (the rule used for the core counts below). A truncated tree response excludes the candidate (`tree-truncated`); no root `src/` (`files-out-of-range`, count 0). |
| C3 | TypeScript backend | The root `package.json` at the recorded commit lists one of the backend packages of the machine block in `dependencies` (`not-backend`). |
| C4 | Named style | The search query that found the candidate names one of the styles the spec compiler knows (`clean-architecture`, `layered`, `nestjs`; `src/spec-parser/template-registry.ts`). A candidate found by several queries takes the first style in the machine block's `styleOrder`. |
| C5 | Reproducible install | A tracked root `package-lock.json` at the recorded commit, so the install policy can be `npm-ci-ignore-scripts` with a lock-file sha256 (BR-U5b-66) (`no-package-lock`). |
| C6 | Not archived, not a fork, not a core project | GitHub `isArchived` / `isFork` false; the origin URL differs from every core origin (`archived`, `fork`, `core-duplicate`). |

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
```
