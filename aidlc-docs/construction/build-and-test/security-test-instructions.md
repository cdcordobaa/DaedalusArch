# Security Test Instructions — DaedalusArch v1.2E

> **New in v1.2E** (no v1.0 counterpart). **Cycle**: v1.2 Evaluation-Readiness, Build and Test (plan Steps 6, 8, 35, 39). **Date**: 2026-10-08.
> Security extension rules: requirements §6 (SECURITY-01..15), NFR-05, NFR-06, NFR-08, ADR-017 item 8, ADR-018.

## 1. Gate P — no secret in a commit

Run before every commit, with the lane preamble. Counts only; never print a match.

```bash
set -a; . ~/.daedalus-bt.env; set +a
git diff --cached | grep -cF -- "$NEO4J_PASSWORD"                                   # 0
git diff --cached | grep -cE "AIza[0-9A-Za-z_-]{35}|sk-ant-[0-9A-Za-z_-]{20,}"      # 0
```

Never `cat`, `echo` or `printf` an env file, a password, `~/.firewall/judge-claude-config` or `~/.claude`. Check a variable with `[ -n "${NAME:-}" ] && echo set`.

## 2. Scrub tests (NFR-05, NFR-08)

```bash
npx jest tests/unit/shared/errors/scrub.test.ts tests/unit/cli/batch-scrub.test.ts \
  tests/unit/llm-critic/cassette-provider.test.ts tests/unit/llm-critic/claude-cli-provider.test.ts
```

They cover warnings, cassettes and reports: no credential, token, connection string or raw environment survives `scrubDeep`. Every artefact the harness writes goes through `writeScrubbedJson` with the parent's `NEO4J_PASSWORD` and `GEMINI_API_KEY` values as known secrets (BR-U5b-70). For a written result file (FR-18), count matches of the Neo4j host:port and the password; both counts must be `0`.

## 3. Dependency audit (NFR-06, SECURITY-10)

```bash
npm audit --audit-level=high          # full report; report-only in CI (accepted residuals still count as high)
npx tsx scripts/audit-gate-cli.ts     # blocking in CI: fails on any high/critical advisory not in scripts/lib/audit-allowlist.json
npx tsx scripts/audit-gate-cli.ts --self-test   # exit 1
```

Triage record: `Docs/DiagnosticRuns /bt-audit-triage.md`. A new high advisory is triaged there (fixed by a lock-only update, not reachable, or accepted residual) and then added to the allow-list.

## 4. Judge isolation (ADR-018, U4 ISO rules)

- The Claude CLI judge runs with the judge config dir (`~/.firewall/judge-claude-config` by default, `--judge-config-dir`), the CLI pin `2.1.294`, `DISABLE_AUTOUPDATER=1`, a neutral cwd and an environment allow-list (ISO-03..05). The config-dir listing is checked against the ADR-018 allow-list (ISO-04) before any call; `src/llm-critic/claude-cli-provider.ts`.
- ISO-07 canary: the committed fixture `tests/fixtures/claude-cli/canary-result.json` records no token under the judge argv (`claude-cli-provider.test.ts`). The live canary is Build and Test Step 35 (at most 3 judge calls), counted on the ledger `Docs/DiagnosticRuns /bt-live-call-ledger.md`.
- Live judge calls in Build and Test: at most 40 in total, retries included (BR-U4-CAS-06), only in Steps 35, 37 and 38.

## 5. Generator confinement (SECURITY-11, ADR-017 item 8)

The SO5 generator (Claude Code sessions, U5a) runs with an exact argv and a restricted tool list, a confined output directory, a harness-owned tsconfig and tsc launcher, and an environment allow-list. The probe runner:

```bash
npx tsx scripts/generator/probes/confinement-cli.ts --help
```

The live probes (5 confinement probes, counted on the generator section of the ledger) are Build and Test Step 39. Until they run, SECURITY-11 for the generator is "compliant by design" (requirements §6 note of 2026-10-08).

## 6. Results guard

`tests/unit/scripts/u5b/guards.test.ts` (in `npm test`) fails when anything under `results/` is outside `results/pre-tag/**` or a registered plan directory with schema-valid `RunRecord`s, and when a test constructs the live Gemini provider (BR-U5b-44, 56).
