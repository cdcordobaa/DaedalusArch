# v1.3 npx readiness, 2026-10-16

Branch `v1.3-npx-readiness`, cut from `origin/v1.3` at `e9fd61b7`. The question: can someone with no Neo4j and no
Docker use the tool through `npx`, on the in-process Cypher interpreter (`--engine cypher-interp`)? Background on that
mode is in [`npx-mode.md`](npx-mode.md).

**Answer: yes.** A packed tarball, installed into a fresh empty directory outside the repository, ran on 36 of 36
projects. Every run was **identical** to the committed results: the same findings (rule, file, target, line and
message) and the same verdict. Each project's MCP server also started over stdio and answered `tools/list` with
11 tools. One packaging blocker was fixed (§3). Nothing was published to npm.

## 1. README one-liner

Once the package is published:

```bash
npx daedalus-arch evaluate path/to/project --spec path/to/spec.yaml
```

Before publishing, the same command runs from a packed tarball:
`npx --yes --package=./daedalus-arch-0.1.0.tgz daedalus-arch evaluate path/to/project --spec path/to/spec.yaml`.
The bin `daedalus-arch` has the same name as the package, so `npx daedalus-arch` needs no `--package`. With no
`NEO4J_URI` set, the engine is `cypher-interp`, and stderr says so in one line. Passing `--engine cypher-interp`
pins the engine explicitly. To run the MCP server: `npx -p daedalus-arch daedalus-arch-mcp --spec path/to/spec.yaml --project path/to/project`.

## 2. Measures

Environment: this container, Node v22.22.0, npm 10.9.4, 4 cores, runs one after another. The tarball was built from
this branch (`npm pack`; `prepare` builds first).

| measure | value |
|---|---|
| tarball | 780,345 bytes (762 KB), 328 files, 4.1 MB unpacked; the largest file is the generated ANTLR parser (1.8 MB) |
| install into an empty project (`npm install <tgz>`) | 5.9 s (9.2 s on the first, cold install); `node_modules` 91 MB, 180 packages. The largest are antlr4ng, rxjs (from neo4j-driver), @ts-morph (which bundles TypeScript), openai, @modelcontextprotocol/sdk and zod |
| cold start, installed bin: `npx --no-install daedalus --version` | 1,759 ms |
| cold start, true npx: `npx --yes --package=<tgz> daedalus-arch --version` with an empty npm cache | 16.7 s and 29.4 s (two fresh caches; this includes resolving and downloading 180 packages through the container's proxy) |
| the same with a warm npx cache | 2.8 s to 35.5 s over 3 runs (npx re-checks the registry; this container's proxy dominates the spread) |
| true npx `evaluate` on the reference variant, empty cache | 15.7 s, exit 0, 28 findings, engine line `cypher-interp` |
| `evaluate`, installed bin, 36 projects | median 3.8 s, max 48.5 s (bank-server); peak RSS median 234 MB, max 279 MB |
| MCP `initialize` over stdio, 36 projects | median 1.74 s, max 2.09 s; `tools/list` answers about 10 ms later |

Wall time and peak RSS cover the `npx` process tree: `os.wait4` on `npx`, and Linux folds the waited-for `node`
child into `ru_maxrss`. The run used an environment of `PATH` and `HOME` only, with no `NEO4J_*` variable. The
fresh-cache `npx --package` rows kept the container's proxy variables, because without them npm cannot reach the
registry.

## 3. Packaging check and the fix

| item | state |
|---|---|
| `bin` | `daedalus`, `daedalus-arch` → `dist/cli/bin.js`; `daedalus-mcp`, `daedalus-arch-mcp` → `dist/mcp-server/main.js`. Both have `#!/usr/bin/env node`, and npm links them executable. OK |
| `files` | `dist/**/*.js`, `presets/*.yaml`, `specs/*.yaml`, `README.md`. No sources, maps, `.d.ts`, tests, results or `.env`. OK |
| postinstall | none. `prepare` (`build`) runs only for git and directory installs and `npm pack`, never for a tarball or registry install. OK |
| runtime deps found only through devDependencies | **`picomatch` (fixed)**. It is imported by 12 runtime modules (layer annotator, APG extractor, spec validator, MCP server, ISE, fix hints), but `package.json` never declared it. It resolved only as a hoisted transitive dependency (`ts-morph → @ts-morph/common → fast-glob → micromatch → picomatch@2.3.2`), so an upstream change could have removed it or swapped the version (`@types/picomatch` is 4.x, and a v4 copy sits under the dev-only `tinyglobby`). It is now declared as `"picomatch": "^2.3.1"`. The lockfile still resolves 2.3.2, so the code runs on the version it was tested with, and behaviour is unchanged |
| other bare imports in `dist/` | `ts-morph`, `antlr4ng`, `yaml`, `@modelcontextprotocol/sdk`, `ajv`, `neo4j-driver`, `commander`, `@google/generative-ai`, `zod`, `dotenv`: all declared. `typeorm`/`express` appear only inside example strings. OK |
| `package-lock.json` | its root `bin` map was stale (two entries, `dist/cli/index.js`); `npm install --package-lock-only` synced it with `package.json`. No resolved version changed |
| size | 762 KB tarball / 91 MB installed. Most of the installed size is ts-morph's bundled TypeScript and the SDKs. Nothing obvious to cut without a src change (e.g. lazy-loading the LLM SDKs) |

Not fixed (out of scope: a src change, or a decision for the author):

- `daedalus --version` prints `1.0.0`, but the package is `0.1.0`. The string is hard-coded at `src/cli/cli.ts:197`.
- There is no `LICENSE` file. `package.json` says MIT, but the tarball carries no licence text.
- `npm warn deprecated node-domexception@1.0.0` appeared on install. It came from a transitive dependency of `openai@4`, and it is gone since `openai` moved to devDependencies (§7).

## 4. Per-project results

Reference: `tests/fixtures/v1.3-reference/clean-architecture`, compared with the committed Neo4j reference run
`results/v1.3-reference/after-member-facts/raw/clean-architecture/clean.json`, on rule, file and target.
External sets: wave 1 (PR #133, branch `v1.3-external-set` at `49c7e6c7`) and wave 2 (PR #181,
`v1.3-external-set-2` at `b1d05f7a`). Each project was cloned at the SHA pinned in its `selection.json` and
evaluated with the committed `specs/<id>.yaml`. The output was compared with the committed `findings/<id>.json`
after stripping the project root. Wave 1's committed runs used Neo4j 5.26.24. Wave 2's used `cypher-interp`, except
bank-server, which used Neo4j.

Command, run in the install directory:
`npx --no-install daedalus evaluate <root> --spec <spec> --symbolic-only --engine cypher-interp --format json`.
MCP: `npx --no-install daedalus-mcp --spec <spec> --project <root> --engine cypher-interp`, then `initialize`,
`notifications/initialized` and `tools/list`.

| project | set | result | wall ms | peak RSS MB | findings | committed | identical | MCP initialize ms (11 tools) |
|---|---|---|---:|---:|---:|---:|---|---:|
| ref:clean-architecture | reference | ok | 2,666 | 208 | 28 | 28 | yes | 1,601 |
| pvarentsov-clean | wave 1 | ok | 4,685 | 233 | 258 | 258 | yes | 1,737 |
| luizomf-clean-api | wave 1 | ok | 4,278 | 248 | 170 | 170 | yes | 2,090 |
| dannielhugo-clean | wave 1 | ok | 3,830 | 234 | 83 | 83 | yes | 1,854 |
| bulletproof-nodejs | wave 1 | ok | 3,067 | 208 | 13 | 13 | yes | 1,727 |
| w3tec-express-boilerplate | wave 1 | ok | 3,433 | 234 | 58 | 58 | yes | 1,736 |
| talento90-typescript-node | wave 1 | ok | 3,524 | 238 | 49 | 49 | yes | 1,545 |
| zeldaplay-api | wave 1 | ok | 3,875 | 245 | 77 | 77 | yes | 1,849 |
| neoteric-nestjs-auth | wave 1 | ok | 9,595 | 265 | 249 | 249 | yes | 1,825 |
| vivify-nestjs-boilerplate | wave 1 | ok | 3,925 | 234 | 35 | 35 | yes | 1,773 |
| conduit-ports-adapters | wave 1 | ok | 3,319 | 233 | 38 | 38 | yes | 1,738 |
| ddialar-hexagonal-boilerplate | wave 1 | ok | 3,172 | 230 | 8 | 8 | yes | 1,648 |
| nest-products-hexagonal | wave 1 | ok | 3,478 | 227 | 24 | 24 | yes | 2,037 |
| ddd-forum | wave 1 | ok | 12,712 | 231 | 102 | 102 | yes | 1,952 |
| finance-project-ddd | wave 1 | ok | 10,616 | 260 | 51 | 51 | yes | 1,872 |
| event-sourcing-ddd | wave 1 | ok | 3,932 | 233 | 23 | 23 | yes | 1,731 |
| jamielivingstone-clean | wave 2 | ok | 2,914 | 214 | 55 | 55 | yes | 1,640 |
| nutes-template-base | wave 2 | ok | 4,275 | 249 | 46 | 46 | yes | 1,688 |
| felixle-node-core | wave 2 | ok | 5,387 | 279 | 304 | 304 | yes | 1,738 |
| adilsonfuxe-auth | wave 2 | ok | 3,634 | 241 | 164 | 164 | yes | 1,737 |
| typeplate | wave 2 | ok | 24,946 | 255 | 103 | 103 | yes | 2,006 |
| geekyants-express | wave 2 | ok | 3,977 | 235 | 34 | 34 | yes | 1,788 |
| ngduc-node-rem | wave 2 | ok | 3,479 | 231 | 24 | 24 | yes | 1,722 |
| shihabmridha-repo-ioc | wave 2 | ok | 3,216 | 230 | 12 | 12 | yes | 1,781 |
| staart-api | wave 2 | ok | 5,085 | 259 | 135 | 135 | yes | 1,652 |
| bank-server | wave 2 | ok | 48,544 | 261 | 394 | 394 | yes | 1,947 |
| saluki-nestjs-template | wave 2 | ok | 3,579 | 233 | 27 | 27 | yes | 1,741 |
| monstarlab-nestjs-starter | wave 2 | ok | 3,726 | 239 | 60 | 60 | yes | 1,650 |
| hexapinod | wave 2 | ok | 3,878 | 250 | 56 | 56 | yes | 1,689 |
| ts-seed-hexagonal | wave 2 | ok | 3,582 | 233 | 34 | 34 | yes | 1,762 |
| remix-hexagonal | wave 2 | ok | 9,032 | 262 | 182 | 182 | yes | 1,706 |
| quiz4devs-backend | wave 2 | ok | 3,269 | 232 | 34 | 34 | yes | 1,665 |
| pezzetti-base-app | wave 2 | ok | 2,888 | 208 | 10 | 10 | yes | 1,723 |
| talyssonoc-node-api | wave 2 | ok | 3,377 | 214 | 4 | 4 | yes | 1,951 |
| camps-graphql-api | wave 2 | ok | 3,422 | 233 | 6 | 6 | yes | 1,931 |
| mustodon | wave 2 | ok | 4,151 | 235 | 7 | 7 | yes | 1,649 |

Totals: 36 succeeded and 0 failed. The 35 external projects have 2,929 findings. That equals the committed
283 + 955 (wave 1) and 342 + 1,349 (wave 2), blocking plus advisory.

## 5. Failure list

**None.** Every evaluation exited 0 (pass) or 1 (verdict fail), wrote a complete JSON report and matched the
committed results. Every MCP server answered `tools/list`.

**bank-server, compared with PR #181.** PR #181 killed it after 25 minutes because the interpreter did not finish
FF-S02 (the variable-length cycle query), so its committed findings come from Neo4j. Here it finished in 48.5 s on
`cypher-interp`, with all 394 findings and the verdict **identical to that Neo4j run**. Interpreter work merged
into v1.3 after #181 presumably explains the change; this run did not bisect it. It is still the slowest project,
at 13× the median.

## 6. Reproduce

```bash
npm pack --pack-destination /tmp/p && mkdir /tmp/app && cd /tmp/app && npm init -y && npm install /tmp/p/daedalus-arch-0.1.0.tgz
python3 -I <repo>/scripts/v1.3/npx-readiness.py --app /tmp/app --repo <repo> --external <dir with results/v1.3-external*/> \
  --clones <dir of clones named by id, at the pinned SHAs> --out <out>/run.json
```

`results/v1.3-external*/` live on the branches of PRs #133 and #181, which are not merged. Raw per-project results
from this run: `results/v1.3-npx-readiness/run.json`. No third-party source is committed.

## 7. Addendum: unused runtime dependencies moved to devDependencies; AHS on five projects

A second run of the same task (session 01NfLMeo) found this branch already pushed, with no PR. It merged
`origin/v1.3` (2db99b81) into the branch, keeping its history, and added one more packaging change.

**`openai`, `chalk`, `ora`, `p-limit` and `ajv-formats` moved from `dependencies` to `devDependencies`.** No file
under `src/` imports them, neither statically nor through `import()`. `openai` and `ajv-formats` are used only by
`scripts/`, which run from the repository, where `npm ci` still installs devDependencies. The lockfile resolves the
same versions; only `dev` flags changed.

| measure | before the move (A) | after the move (B) |
|---|---|---|
| `node_modules` after `npm install <tgz>` into an empty project | 92.9 MB, 170 top-level entries | **79.1 MB**, 130 top-level entries |
| `npm install <tgz>`, warm npm cache | 9.1 s | 4.8 s |
| cold `npx --yes --package <tgz> daedalus-arch --version`, empty npm cache | 13.9 s | 11.1 s, 11.7 s |
| 35 external projects, `evaluate`: median / max wall, median / max peak RSS | 3.3 s / 43.2 s, 237 / 279 MB | 3.3 s / 46.0 s, 236 / 279 MB |
| MCP stdio `initialize` + `tools/list` (11 tools) | 1.47 s | 1.77 s |

**No behaviour change.** For both tarballs, the 36 reports (the reference project plus 35 external projects) were
compared with `runId`, `durationMs`, `timings` and per-function `executionTimeMs` removed. They are byte-identical,
36 of 36. `git diff origin/v1.3 -- src` is empty. The cold `npx` rows were measured on the same tarball contents one
base earlier (ae0c8d57). The other rows come from this branch.

**AHS on five wave-2 projects.** §4 calls each run "identical" on its findings (rule, file, target, line and
message) and its verdict, and that holds for 35 of 35. `ahsDeterministic` is also identical for 30 of 35. On
nutes-template-base (0.508 vs 0.488), felixle-node-core (0.421 vs 0.401), staart-api (0.604 vs 0.584),
saluki-nestjs-template (0.721 vs 0.711) and monstarlab-nestjs-starter (0.475 vs 0.435), the committed wave-2 report
lists `FF-P05 … cypher-interp: unsupported: clause subqueryClause` under `functionExecution.failed`. The current
interpreter runs FF-P05's `CALL { … UNION … }`, and FF-P05 finds 0 violations there. The pattern dimension therefore
counts 6 functions instead of 5, and AHS rises. The cause is the tool version: wave 2 ran on 50a32841. It is not an
npx effect.

**One-liner.** The line in §1 is unchanged. Adding `--engine cypher-interp` makes it independent of a `NEO4J_URI`
that might be set in the caller's shell:
`npx daedalus-arch evaluate . --spec architecture.yaml --engine cypher-interp`.

Data: `results/v1.3-npx-readiness/dep-trim.json`, with both tarballs' runs, the A vs B comparison and the five AHS
rows.
