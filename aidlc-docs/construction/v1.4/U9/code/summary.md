# U9 code summary: semantic paths (BUILD-S)

Plan: `aidlc-docs/construction/v1.4/U9/plan.md`. Built by a scheduled Claude Code cloud routine on 2026-10-19, with **zero model calls** (mock, estimate and replay only), no Neo4j (`cypher-interp`), no sealed read (no `*sealed*` path was opened; `Docs/v1.3/sealed-hashes.md` was not needed), and the MEAN-01 sample never opened.

## What was built

| Step | What | Where |
|---|---|---|
| S1 | One shared `AGY_EXPLORATORY_VERSIONS` (`1.3.6`, `1.4.2`) beside the frozen pin `1.3.2`; BF-01 re-exports it; the `gemini-agy` ontology route passes it **only** for a spec labelled `exploratory` (`--exploratory`), as C4-01 §3 gap 2 asks | `src/llm-critic/agy-cli-provider.ts`, `src/apg-enrich/ontology/routes.ts`, `scripts/v1.3/{bf-01-run,ontology-run}.ts` |
| S2 | C4 takes **every blocking finding**: symbolic A4 rows (any rule in the report's blocking tier) and Sem verdicts, as one `C4Finding`; advisory rows are refused. Context: code window around the edge, comments, graph slice, A2 facts, docs searched for every class of the finding's files, ADR heads (status) with every ADR excerpt. Schema `c4-v0.2` with no verdict field | `src/apg-enrich/ontology/{c4-findings,interpretation}.ts` |
| S3 | A5 contract (doc/comment citation grounding, two-run merge, proposals for C2), runner over the ontology `ModelCaller` (cassettes, budget, retry, stop codes; pass `interpret`), `--estimate`, `--replay`, routes `claude-cli`, `gemini-agy`, `gemini-api`, `mock`; the zero-call keyword baseline; the C4 scorer; the seeded set scaffold | `src/apg-enrich/ontology/{c4-contract,c4-runner,c4-scorer}.ts`, `scripts/v1.4/c4-run.ts`, `tests/fixtures/v1.4-c4/` |
| S4 | A2 loader smoke: `facts.json` from disk → graph → SEM-MISPLACED, SEM-DUP, SEM-FRAG through Cypher, with ablations | `tests/unit/apg-enrich/ontology/a2-graph-smoke.test.ts` |
| S5 | `semantic_facts`, an opt-in read-only MCP tool over the recorded A2 facts and Sem findings, re-checked against the current code; off by default; not in any arm | `src/mcp-server/semantic-facts.ts`, `server.ts`, `context.ts`, `tools.ts` |

## The seeded set (C4-01 §6)

Six cases and six twins; each target fires in C3 on `cypher-interp` (pairs 1 to 5) or in SEM-MISPLACED over scripted A2 (pair 6). Manifests are hashed in `set.json`.

- **All twelve are author/Claude-written** by this session, which also wrote the runner. That does **not** meet C4-01 §6 ("a separate session that never runs or scores C4"). Each manifest says so (`authorship.independentOfC4: false`, `signedByAuthor: false`). No C4 call was made. Before any call, the author signs them, or a separate session rewrites them.
- **X1, X2 (real external findings) and X3 (a Gemini-written pair) are `to-be-filled`**, with the selection rule and the fixed brief in `set.json` and `README.md`.
- Deviation: pair 3 uses the DDD preset's contexts (`ordering`, `billing`), not `sales`, `billing`.
- Pair 4 has three blocking findings (FF-S04 target, plus FF-S01 and FF-P06 on the same edge), within C4-01's "at most two others".

**Estimate** (`npx tsx scripts/v1.4/c4-run.ts --cases --provider claude-cli --estimate`, no call): 16 blocking findings, **32 calls expected per vendor at runs = 2**, upper bound 64, about 28k prompt tokens. Pilot (pairs 1 and 2): 8 calls per vendor (C4-01 cap 24). Six cases + twins: 32 per vendor (cap 80).

**Mock dry run** (`--cases --provider mock`, the scripted keyword-baseline stand-in; NOT a C4 result): every target found; the stand-in claims falsely on the near-miss twins 3 and 4, as the keyword baseline is built to.

## Behaviour changes to existing code

- `INTERPRETATION_PROMPT_VERSION` `c4-facts-v0.1` → `c4-v0.2`, and the schema changed (C4-01 §4.2). No C4 cassette existed, so nothing is invalidated.
- `buildInterpretationContext` returns `finding` and `c3Verdict` instead of `verdict`; it still accepts a `SemVerdict`. The ADR head now precedes an ADR excerpt that starts below line 1; `reading.test.ts` was updated for that one expectation.
- `docsSection` takes an optional hint; C1d prompts are byte-identical (default hint unchanged).
- `PassId` is unchanged; model calls use `CallPass = PassId | 'interpret'`. The C1d scripted responder returns null for `interpret`.
- MCP: `TOOL_NAMES`, `SPEC_TOOL_NAMES` and the default tool list are unchanged; `toolNamesFor` also reads `semanticFacts`.

## Checks

- `npx tsc --noEmit -p .`: clean. `npx tsc --noEmit -p tsconfig.scripts.json`: clean.
- ESLint on the changed `src/` and `scripts/` files: clean. `scripts/v1.3/bf-01-run.ts` is outside the ESLint project (as on `main`); its change is one import and one re-export line.
- New and changed suites: `routes` 10, `c4-contract` 15, `c4-cases` 22, `c4-invariance` 2, `a2-graph-smoke` 4, `semantic-facts` 8, `reading` 13: all pass.
- Full `npx jest --maxWorkers=2`: see the PR description (filled when the run finished).

## Open items for the author

1. Sign or have rewritten the twelve manifests (C4-01 §6) before the C4 pilot; fill X1 to X3.
2. The allowed severity sets are proposed (exception cases low/medium; contradicted twins high/medium; case 5 high only).
3. F3 wording (C4-01 §2.1) and the first-study scoring-only sample (§8) are untouched by this unit.
4. The `semantic_facts` tool is for an exploratory in-loop cell only; wiring it into a study is a protocol decision (C4-01 §8, REV-05 item 7).
5. The live smoke runs C4-01 §11 asks for (one tiny Gemini call; the NS-02 §2 Cypher on Neo4j) are not done here: they need calls or Neo4j.
