# sdd-library-loans

A small library-loans service (hexagonal, TypeScript, no runtime dependencies) built in five OpenSpec changes by a
coding agent that checked every implementation step with the DaedalusArch MCP tools. It is an illustration of
spec-driven development with an architecture checker in the loop, not an experiment. The write-up is
`Docs/v1.3/sdd-demo.md` in the repository root.

| Path | What |
|---|---|
| `openspec/` | OpenSpec 1.14.0 project: `specs/` (five capabilities) and `changes/archive/` (the five changes: proposal, spec delta, design, tasks) |
| `.daedalus/architecture.yaml` | The DaedalusArch spec, generated from the `## Architecture` sections of the designs by `scripts/sdd/openspec-to-aac.ts` |
| `src/` | The service: `domain/`, `application/` (use cases, ports), `adapters/inbound/` (HTTP-style controllers), `adapters/scheduled/` (a daily job), `adapters/outbound/` (in-memory stores, clock, notifier), `config/` (composition root) |
| `scenarios.ts` | The 19 OpenSpec scenarios as executable checks |
| `transcript/transcript.jsonl` | Every file written, every derived spec, every MCP tool call with its result, every full evaluation, in order |
| `transcript/transcript.md` | The same, readable |

From the repository root:

```bash
npm ci
npm run demo:sdd                                    # rebuild from the transcript and re-check every step
npx tsx examples/sdd-library-loans/scenarios.ts     # run the scenarios
npx tsx scripts/sdd/openspec-to-aac.ts --project examples/sdd-library-loans \
  --out examples/sdd-library-loans/.daedalus/architecture.yaml --check
```
