# DaedalusArch user guide

DaedalusArch checks a TypeScript codebase against an architecture spec: a YAML file that says which folders are
which layers and which rules apply. It builds a graph of files, classes and imports, runs each rule as a query over
that graph, and tells you which rules are broken and where.

This guide is for people who want to run it on their own code. It covers the command line, the MCP server for coding
agents, and the CI gate. It does not cover the research instruments in `Docs/`.

## Chapters

1. [Quick start (no database)](01-quick-start.md)
2. [Writing a spec](02-writing-a-spec.md): one example per style (layered, clean, hexagonal, DDD, NestJS)
3. [Reading a report](03-reading-a-report.md): defining rules vs warnings, exit codes, JSON, fix hints
4. [Using it inside a coding agent (MCP)](04-mcp-coding-agents.md): Claude Code and any MCP client
5. [CI pull-request gate](05-ci-gate.md)
6. [The HTML report](06-html-report.md)
7. [Zero-config init for an existing codebase](07-init-existing-codebase.md): `init`, `--from-inferred`, rule mining
8. [FAQ and limitations](08-faq-and-limitations.md)

## What is merged and what is still in a pull request

The guide was written against branch `v1.3`. Some features are only on open pull requests. Each chapter says which
branch a command needs. Every command in the guide was run against the fixtures in this repository, on the branch
named next to it.

| Feature | Where | Notes |
|---|---|---|
| In-process graph engine (no database) | merged in `v1.3` | The default whenever `NEO4J_URI` is not set (PR #135) |
| MCP v2 tools (`check_file`, `check_diff`, `infer_spec`, `evaluate_project`, ...) | merged in `v1.3` | All tools work without a database |
| Hexagonal and DDD rule libraries | merged in `v1.3` | `presets/hexagonal.yaml`, `presets/ddd.yaml` |
| `npx` packaging, `daedalus` / `daedalus-mcp` commands | merged in `v1.3` (PR #135) | Not published to npm yet: install from a checkout or a packed tarball |
| CI gate (`check --base --head`) and GitHub Action | merged in `v1.3` (PR #138) | Its in-process engine is `lexical`, not `cypher-interp` (see chapter 5) |
| HTML report (`evaluate --html`) | merged in `v1.3` (PR #140) | |
| Fix hints (`--hints`) | available in PR #143 | |
| Rule mining (`mine-rules`) | available in PR #145 | |
| `init`, `evaluate --from-inferred`, MCP `propose_spec` | merged in `v1.3` (PR #150) | |

## Conventions in this guide

- Commands run from the root of a DaedalusArch checkout after `npm ci`, and use the repository entry point
  `npx tsx bin/firewall.ts`. The help text calls the program `firewall`. After a build, the same CLI is installed as
  `daedalus` (chapter 1).
- `--engine cypher-interp` appears on every `evaluate`. On `v1.3` it is already the default when `NEO4J_URI` is not
  set, so the flag is optional there. It is kept so that the commands mean the same thing on every machine, including
  one with `NEO4J_URI` in its environment or `.env`.
- `--symbolic-only` appears on every `evaluate`. Without it, `evaluate` also runs an LLM judge, which needs a pinned
  Claude CLI install and is meant for research runs. The rules described here are all symbolic.
- The human-readable report is written to **stderr**. JSON (`--format json`) is written to stdout.
- Paths such as `fixtures/variant-a-structural` are the reference projects shipped in this repository. Swap in your
  own project path.
