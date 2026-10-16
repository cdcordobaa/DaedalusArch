# 1. Quick start (no database)

You need Node.js 22 or later. You do not need Neo4j or Docker.

## From a checkout (branch `v1.3`)

```bash
git clone https://github.com/cdcordobaa/DaedalusArch.git
cd DaedalusArch
git checkout v1.3
npm ci
```

Check a project that breaks some rules:

```bash
npx tsx bin/firewall.ts evaluate \
  --project fixtures/variant-a-structural \
  --spec specs/clean-arch.yaml \
  --engine cypher-interp --symbolic-only
echo $?    # 1
```

Output (stderr, shortened):

```
  Verdict:             hard-block
  Mode:                symbolic-only

  v1.3 scoring:        FAIL (any-blocking-violation; v1.2E verdict hard-block)
  Blocking AHS:        0.462  (3 of 6 blocking rules violated, 5 violations)
    FF-S01   dependency-direction: 2
    FF-S02   no-cyclic-deps: 2
    FF-S04   no-domain-outward-dep: 1
  Advisory findings:   11 in 6 of 15 rules
    FF-C01   domain-stability: 1
    ...
  Top Violations:
    1. [critical] src/application/use-cases/CreateTaskUseCase.ts — src/application/use-cases/CreateTaskUseCase.ts (application) imports from src/infrastructure/repositories/InMemoryTaskRepository.ts (infrastructure)
    2. [critical] src/domain/entities/Task.ts — src/domain/entities/Task.ts (domain) imports from src/infrastructure/config/InfraConfig.ts (infrastructure)
    3. [critical] ... — Circular dependency: src/domain/entities/Task.ts,src/domain/repositories/ITaskRepository.ts,src/domain/entities/Task.ts
```

Now check a project that follows the rules:

```bash
npx tsx bin/firewall.ts evaluate \
  --project fixtures/correct-reference \
  --spec specs/clean-arch.yaml \
  --engine cypher-interp --symbolic-only
echo $?    # 0
```

```
  v1.3 scoring:        PASS (any-blocking-violation; v1.2E verdict pass)
  Blocking AHS:        1.000  (0 of 6 blocking rules violated, 0 violations)
```

On this small project a run takes about 4 seconds, most of it start-up.

`--engine cypher-interp` runs the rule queries in-process. On `v1.3` the default engine is still `neo4j`. If you
leave the flag out and have no database, the run stops with
`Error [CONFIG_MISSING_ENV]: NEO4J_PASSWORD is not set` and exit code 2.

To run against your own code, point `--project` at the folder that holds `src/` and `tsconfig.json`. Point `--spec`
at a spec (chapter 2), or start from an inferred one (chapter 7).

## With `npx` (available in PR #135)

PR #135 packages the tool. It adds the commands `daedalus` (CLI) and `daedalus-mcp` (MCP server). It also makes the
in-process engine the default whenever `NEO4J_URI` is not set. Each run prints one line saying which engine it used:

```
daedalus: graph engine cypher-interp (in-process, no database) [NEO4J_URI is not set; pass --engine neo4j for the reference engine]
```

The package is not on the npm registry yet, so build a tarball from the branch and run that:

```bash
git checkout v1.3-npx
npm ci
npm pack --pack-destination /tmp/daedalus      # -> /tmp/daedalus/daedalus-arch-0.1.0.tgz (runs the build first)

npx --yes --package=/tmp/daedalus/daedalus-arch-0.1.0.tgz \
  daedalus evaluate fixtures/variant-a-structural --spec specs/clean-arch.yaml --symbolic-only
echo $?    # 1
```

Notes from testing:

- Use `--package=<tarball> daedalus ...`. `npx ./daedalus-arch-0.1.0.tgz ...` fails with "Permission denied"
  (exit 126), because npx tries to execute the tarball itself.
- The first run takes about 12 seconds because it installs the package. Later runs start faster.
- The project can be positional (as above) or given as `--project`.
- From a checkout of that branch, `npm run build && node dist/cli/bin.js evaluate ...` works the same way.
- The CLI loads a `.env` file from the working directory. A `NEO4J_URI` there switches the default engine to Neo4j.

Once the package is published, the command becomes `npx daedalus-arch ...`. That form has not been tested.

## Exit codes

| Code | Meaning |
|---|---|
| 0 | No defining (blocking) rule is broken. Warnings may still be listed |
| 1 | At least one defining rule is broken |
| 2 | Usage, spec or configuration error (bad flag, invalid spec, missing database settings) |
| 3 | Only for runs with the LLM judge: the judge did not finish |

## Next

- [Write a spec](02-writing-a-spec.md) for your layout.
- [Read the report](03-reading-a-report.md): what "blocking" and "advisory" mean.
