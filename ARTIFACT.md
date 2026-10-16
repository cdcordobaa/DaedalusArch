# DaedalusArch: artifact guide for reviewers

This guide is for artifact evaluators. It gives two paths:

- **§2 Kick the tires (about 15 minutes, most of it reading):** install from a clean clone and evaluate reference
  projects with the in-process Cypher interpreter. You need no database, no Docker, no model, no credential and,
  after `npm ci`, no network.
- **§3 Full reproduction (hours):** regenerate the committed v1.3 results with the replication package.

Every command runs from the repository root. All timings come from a fresh clone of `v1.3` at `f66564ef` on
2026-10-16: Linux x86-64, Node v22.22.0, npm 10.9.4. The npm cache was warm, so `npm ci` takes longer on a cold
cache. The readiness assessment against the ACM badges is in
[`Docs/v1.3/artifact-eval-readiness.md`](Docs/v1.3/artifact-eval-readiness.md).

## 1. What the artifact is

DaedalusArch is an architectural firewall for TypeScript. A YAML spec declares layers, forbidden imports and fitness
functions (`specs/`, `presets/`). The tool extracts an architecture property graph (APG) from the project with
ts-morph and runs each rule as a Cypher template over that graph. It then scores the result as an Architecture
Health Score (AHS) and turns it into a verdict (`pass`, `warning`, `soft-block`, `hard-block`).

There are two graph engines:

| engine | needs | role |
|---|---|---|
| `cypher-interp` | nothing (in-process) | the default when `NEO4J_URI` is unset. It runs the same Cypher template text unchanged ([`Docs/v1.3/cypher-interpreter.md`](Docs/v1.3/cypher-interpreter.md), [`Docs/v1.3/npx-mode.md`](Docs/v1.3/npx-mode.md)) |
| `neo4j` | Neo4j 5.26 + APOC (`docker-compose.yml`) | **the reference engine for reported numbers** |

Parity between the two engines is checked offline against committed Neo4j golden outputs
(`tests/unit/cypher-interp/golden-parity.test.ts`, run in §2.3).

Requirements: **Node.js ≥ 22** (the results used v22.22.0), npm ≥ 10, git, bash, and about 1 GB of disk for
`node_modules`. Linux and macOS work. Windows needs WSL: one tracked docs folder, `Docs/DiagnosticRuns /`, ends in a
space, and Windows cannot check that path out.

## 2. Kick the tires (≈15 minutes)

### 2.1 Install (≈30 s warm cache; allow 2–3 min cold)

```bash
git clone https://github.com/cdcordobaa/DaedalusArch && cd DaedalusArch && git checkout v1.3
unset NEO4J_URI NEO4J_PASSWORD   # make sure the interpreter is chosen
npm ci                           # installs from the lockfile and builds dist/ (the prepare script)
```

Expected: `added 861 packages`, then the `tsc` build. Exit 0. Measured: 24.1 s (`npm ci` with the build). A
separate `npm run build` takes 10.9 s.

### 2.2 First result (≈2 s)

```bash
node dist/cli/bin.js evaluate fixtures/variant-a-structural --spec specs/clean-arch.yaml --symbolic-only
echo "exit $?"
```

Expected on stderr (abridged):

```
daedalus: graph engine cypher-interp (in-process, no database) [NEO4J_URI is not set; pass --engine neo4j for the reference engine]
║  Architectural Health Score: 0.44 (HARD-BLOCK)║
  v1.3 scoring:        FAIL (any-blocking-violation; v1.2E verdict hard-block)
  Blocking AHS:        0.462  (3 of 6 blocking rules violated, 5 violations)
    FF-S01   dependency-direction: 2
    FF-S02   no-cyclic-deps: 2
    FF-S04   no-domain-outward-dep: 1
    1. [critical] src/application/use-cases/CreateTaskUseCase.ts — ... (application) imports from src/infrastructure/repositories/InMemoryTaskRepository.ts (infrastructure)
```

The command exits with `1`. The exit codes are: 0 for `pass`/`warning`, 1 for `soft-block`/`hard-block`, and 2 for
a usage or configuration error. Add `--format json` to get the full report on stdout. The keys are `ahsDeterministic`,
`verdict`, `violations[]` (with `functionId`, `filePath`, `line`, `target`), `perDimensionScores` and `graphStats`.

**Time from a clean clone to the first result: about 30 s** with a warm npm cache.

### 2.3 Automated check (≈30 s)

```bash
npm run artifact:kick -- --parity        # = replication/kick-the-tires.sh --parity
```

The script evaluates seven projects, checks that every compiled query of `specs/clean-arch.yaml` parses on the
interpreter, and (with `--parity`) compares the interpreter with the committed Neo4j golden outputs. It exits 0 only
when every row matches. Expected output:

```
name                           verdict     ahs     exit secs   result
ref-clean-architecture         pass        0.954   0    2.2    OK
ref-hexagonal                  pass        0.908   0    2.3    OK
ref-layered                    pass        0.943   0    2.2    OK
ref-nestjs                     pass        0.954   0    2.0    OK
fixture-correct-reference      pass        0.954   0    3.4    OK
fixture-variant-a-structural   hard-block  0.438   1    2.9    OK
fixture-variant-b-pattern      hard-block  0.571   1    2.8    OK

== validate: every compiled query of specs/clean-arch.yaml parses on the interpreter
cypher-interp: 22/22 compiled queries parse
validate OK

== interpreter vs committed Neo4j golden outputs (tests/unit/cypher-interp/golden-parity.test.ts)
    ✓ correct-reference ... ✓ variant-d-subtle
Tests:       5 passed, 5 total

KICK-THE-TIRES: OK
```

The `ref-*` projects are the v1.3 reference projects (`tests/fixtures/v1.3-reference/<style>/project`, one per
architectural style, each with its own spec). Their only findings are advisory, so the verdict is `pass`. The
`fixture-variant-*` projects plant structural and pattern defects.

### 2.4 Use it like a user would: `npx` on your own project (≈1 min)

```bash
npm pack                                   # -> daedalus-arch-0.1.0.tgz (12.9 s)
mkdir /tmp/try && cd /tmp/try && npm init -y >/dev/null
npm install /path/to/DaedalusArch/daedalus-arch-0.1.0.tgz      # 7.6 s, 180 packages
cp -R /path/to/DaedalusArch/fixtures/variant-a-structural proj  # or any TypeScript project
cp /path/to/DaedalusArch/specs/clean-arch.yaml spec.yaml        # or a spec of your own
npx daedalus evaluate proj --spec spec.yaml --engine cypher-interp --symbolic-only   # 2.8–3.3 s
npx daedalus-mcp --spec spec.yaml --project proj                # MCP server on stdio (Ctrl-C to stop)
```

Expected: the same report as §2.2 (AHS 0.44, HARD-BLOCK, exit 1). Writing a spec for your own project: `npx daedalus
init` infers a draft spec. See `README.md` and `Docs/v1.3/init-infer.md`.

> Inside the checkout itself, prefer `node dist/cli/bin.js …` or `npm start -- …`. `npx daedalus` run in the
> repository root installs the checkout into the npx cache as a `file:` link, and every call then runs `prepare` (a
> full rebuild, 12–19 s per call). It works, but it is slow.

### 2.5 Optional: unit tests

```bash
env -i HOME="$HOME" PATH="$PATH" npx jest --testPathPattern=tests/unit --forceExit
```

`env -i` keeps an inherited agent or CI environment out of the suite. Measured on a fresh clone: 559 s; 5,140 passed,
40 skipped, 4 failed. One failure is a real script-guard test at the `v1.3` head (readiness doc, B11). The other three
need a full, non-shallow `git clone` (with the `origin/v1.2e` branch) run by a non-root user. They fail from a
tarball, a `--depth` clone or as root (B12). None of the four tests the evaluator.

## 3. Full reproduction

The replication package is [`replication/README.md`](replication/README.md). It lists every v1.3 result, the command
that regenerates it, and what that command needs. It sorts results into three kinds:

- **deterministic**: expected to come out byte-identical to the committed files;
- **model-dependent**: replayed from the committed cassettes (`tests/fixtures/judge-cassettes-v13/**`), with no model
  call;
- **live**: needs Neo4j, a model subscription of the reader's own, or inputs that are not distributed.

### 3.1 Offline deterministic results (≈5 min, no Neo4j, no model)

```bash
replication/setup.sh        # npm ci (root) + the pinned dependency-cruiser 18.4.0; checks versions
replication/smoke.sh        # git archive HEAD into a scratch dir, regenerate, compare byte for byte
```

**What to expect at `f66564ef` (measured 2026-10-16, 253 s): exit 1.**

| step | expected | observed at `f66564ef` |
|---|---|---|
| `gf` graph fidelity, 5 reference projects | IDENTICAL | 25/25 IDENTICAL |
| `gfagg` corpus aggregates | IDENTICAL | 2/2 IDENTICAL |
| `ise` ISE measure / downstream / E1 tables | IDENTICAL | **11 DIFF** (measure and inferred specs). Downstream and E1 tables are IDENTICAL |
| `apg2` APG v2 ablation (HEAD and `72fa9203`) | IDENTICAL or KNOWN | IDENTICAL + 2 KNOWN (finding C-1) |
| `cheap` cheap semantic proxies | IDENTICAL | **17 DIFF** (flags, `rows.csv`, `scores.json`) |
| `judge` judge catch, cassette replay | IDENTICAL or KNOWN | IDENTICAL + 2 KNOWN (finding D-5) |

Neither of the 28 DIFFs comes from the evaluator. The committed `results/v1.3-ise/2026-10-15` and
`results/v1.3-cheap-semantics` files were produced before later changes to ISE inference (commit `08c6cd8c`) and
before the cheap-proxy fixes became the default. Open PR #215 documents both. Until the committed files or the smoke
expectations are updated (readiness doc, blocker B4), run the steps that do reproduce:

```bash
replication/smoke.sh --only gf,gfagg,apg2,judge     # expected: SMOKE: OK, exit 0 (126 s; 69 IDENTICAL, 4 KNOWN)
```

### 3.2 Number-level replication runner (`npm run replicate:v1.3`)

This runner is **not yet on `v1.3`**. It is in open PR #215 (`replication/v1.3/run.mjs`). That PR's full run
registers 5,154 numbers from the v1.3 docs. Of these, 4,587 reproduce, 58 differ (each one explained) and 509 need
Neo4j, a model, sealed or external inputs, or cannot be checked. Once it is merged:

```bash
npm run replicate:v1.3 -- --fast     # quick subset
npm run replicate:v1.3               # every offline group (~80 min)
```

### 3.3 Results that need Neo4j (reference engine)

```bash
cp .env.example .env    # set NEO4J_PASSWORD (>= 8 chars); never commit .env
replication/setup.sh --neo4j
export NEO4J_URI=bolt://127.0.0.1:7687 NEO4J_USER=neo4j NEO4J_PASSWORD=...
```

The commands per result are in `replication/README.md` §3, for example `scripts/v1.3/ue-baseline-live.ts` for the
reference validation runs. The Neo4j image is pinned by digest. To get the reference engine on any CLI call, pass
`--engine neo4j`.

### 3.4 Results that are not reproducible by a reviewer

- **Live model calls** (judge, generator, labeller) need the pinned CLIs and the reader's own subscription. The
  committed cassettes replay every recorded answer.
- **Inputs not distributed:** the 72 generated E1 projects (`../daedalus-e1-outcomes`) and the SO4 corpus bases.
  Their derived per-project outputs are committed.
- **Blind reference manifests:** sealed by design. The scores computed from them are committed.

## 4. Layout

| path | content |
|---|---|
| `src/` | the tool: extractor (`apg-*`), rule compiler and Cypher templates (`fitness-compiler`), interpreter (`cypher-interp`), scoring, CLI, MCP server |
| `specs/`, `presets/` | architecture specs and presets |
| `fixtures/`, `tests/fixtures/v1.3-reference/` | sample and reference projects with expected findings |
| `tests/` | unit, integration and golden tests |
| `replication/` | setup, smoke test, kick-the-tires check, known divergences |
| `results/`, `Docs/DiagnosticRuns/` | committed results and their write-ups |
| `scripts/` | experiment and study harnesses (they always pass `--engine neo4j`) |

## 5. Licence

`package.json` declares MIT. **A `LICENSE` file is not yet in the repository** (readiness doc, blocker B1).
