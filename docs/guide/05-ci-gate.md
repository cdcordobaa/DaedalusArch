# 5. CI pull-request gate

`v1.3` has a `check` command and a GitHub Action (PR #138). The command compares a base commit with a head commit and fails
only on **new** blocking findings. Findings that were already on the base branch do not fail the pull request, so you
can switch the gate on in a codebase that has existing violations.

## Engines

| `--engine` | What it checks | Needs |
|---|---|---|
| `lexical` (the Action's default) | The single-file import rules of `check_file`: layer direction, layer skipping, core isolation, domain purity | nothing (in-process) |
| `neo4j` (the CLI's default) | The full rule set, including cycles, injection, port/adapter and DDD rules | a Neo4j service |

`check` does not accept `--engine cypher-interp` (`--engine must be one of neo4j | lexical`, exit 2), and unlike
`evaluate` its default stays `neo4j` even when `NEO4J_URI` is unset. Without a database, pass `--engine lexical`.
Otherwise you get `NEO4J_PASSWORD is not set` (exit 2).

`lexical` misses graph rules. In the test below it reported the 3 new layer findings, and missed the 2 import
cycles that the full evaluation reports for the same code.

## Run it locally

The test repository has `specs/clean-arch.yaml` and an `app/` folder holding `fixtures/correct-reference`, with three
branches:

- `main`: the base.
- `clean-change`: adds a value object in the domain.
- `violating-change`: replaces `app/src` with `fixtures/variant-a-structural/src`.

```bash
npx tsx bin/firewall.ts check --repo /path/to/test-repo --base main --head clean-change \
  --spec specs/clean-arch.yaml --project app --engine lexical
echo $?    # 0
```

```
Architecture gate: PASS (0 new blocking finding(s))
  base main ec7883a3976d: 0 finding(s)
  head clean-change 234164e92b36: 0 finding(s)
  engine lexical, spec specs/clean-arch.yaml, project app
  new 0 (0 blocking), fixed 0 (0 blocking), unchanged 0
```

```bash
npx tsx bin/firewall.ts check --repo /path/to/test-repo --base main --head violating-change \
  --spec specs/clean-arch.yaml --project app --engine lexical
echo $?    # 1
```

```
Architecture gate: FAIL (3 new blocking finding(s))
  new 3 (3 blocking), fixed 0 (0 blocking), unchanged 0
New:
  [blocking] FF-S01 dependency-direction  src/application/use-cases/CreateTaskUseCase.ts:2 -> src/infrastructure/repositories/InMemoryTaskRepository.ts
    application (position 1) may not import infrastructure (position 2): ...
    Fix: Do not import infrastructure from application (it may import: domain). Declare an interface for what you need in application, implement it in infrastructure, and inject the implementation from the composition root.
  [blocking] FF-S01 dependency-direction  src/domain/entities/Task.ts:2 -> src/infrastructure/config/InfraConfig.ts
  [blocking] FF-S04 no-domain-outward-dep  src/domain/entities/Task.ts:2 -> src/infrastructure/config/InfraConfig.ts
```

With base and head swapped, the gate passes and lists the 3 findings as `fixed`.

Useful options:

- `--base`, `--head`: branch names or SHAs.
- `--spec`: relative to the repository root.
- `--spec-from base|head`: which commit's spec to use. The default is `base`, so a pull request cannot relax its own
  gate.
- `--format human|markdown|json`, `--out <file>`, `--json-out <file>`: Markdown is what the Action posts as a PR
  comment. JSON has `new[]`, `fixed[]`, `unchanged[]`, `verdict` and `newBlocking`.

Exit codes: 0 no new blocking finding, 1 at least one new blocking finding, 2 usage, git, spec or engine error.

## GitHub Action

This is the example workflow in `Docs/examples/architecture-gate.yml` (comments trimmed). Save it as
`.github/workflows/architecture-gate.yml` in your repository:

```yaml
name: Architecture gate
on:
  pull_request:
permissions:
  contents: read
  pull-requests: write   # the summary comment; drop it (and set comment: 'false') for a summary-only gate
concurrency:
  group: architecture-gate-${{ github.event.pull_request.number }}
  cancel-in-progress: true
jobs:
  gate:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0               # the gate reads both the base and the head commit
          persist-credentials: false
      - name: Architecture gate (new blocking findings only)
        uses: cdcordobaa/DaedalusArch@v1.3   # pin a tag or a commit SHA you have reviewed
        with:
          spec: architecture/spec.yaml       # your spec, relative to the repository root
          project: .                         # the TypeScript project directory
          engine: lexical                    # in-process, no database
```

Inputs: `spec` (required), `project` (`.`), `base` / `head` (default to the pull request's SHAs), `engine` (`lexical`),
`spec-from` (`base`), `comment` (`'true'`), `fail-on-new-blocking` (`'true'`), `repository-path` (`.`), `github-token`.
Outputs: `verdict`, `new-blocking`, `new`, `fixed`, `unchanged`, `report-path`, `json-path`.

The Action installs the tool, runs `check` with Markdown output, adds the Markdown to the job summary, and posts or
updates one PR comment. On pull requests from forks the token cannot comment, so the Action only logs a warning.

What was and was not tested:

- The `check` command was run locally, as shown above.
- The Action itself has not been run on GitHub for this guide. `action.yml` is at the root of `v1.3`, so
  `uses: cdcordobaa/DaedalusArch@v1.3` points at it. Pin a commit SHA you have reviewed rather than the moving branch.
- For the full rule set, the example file also contains a commented-out job. It runs a `neo4j:5.26-community` service
  and sets `engine: neo4j` with `NEO4J_URI` and `NEO4J_PASSWORD` from a repository secret.
