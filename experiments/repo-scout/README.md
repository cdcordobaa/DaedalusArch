# REPO-SCOUT for COMPREHEND-02 (v1.5-exp, exploratory, zero model calls)

The scout looks for large TypeScript repositories for a comprehension test at scale. It also compares the DETECT-02
graph tools with compiler truth on 3 sample questions per tree. Report:
`Docs/DiagnosticRuns/repo-scout-comprehend-02-2026-10-23.md`.

No third-party source is committed: only URL plus commit (`candidates-*.json`) and derived numbers (`results/`).
Clone into a scratch directory outside this repository. Nothing under `src/`, `presets/`, `scripts/lib/` or
`scripts/v1.3/` is changed; the extractor, the graph-fidelity harness, `flattenTsconfig` and the DETECT-02 tools are
imported read-only.

| File | What |
|---|---|
| `candidates-v13.json` | the 74 repositories of the v1.3 external (1–3) and wild sets, at their pins |
| `candidates-new.json` | Medusa, Backstage, Novu, Amplication, Twenty, Immich, Unleash, Vendure: pin, analysis root, extra `include`, `paths` and `exclude` |
| `clone.sh` | shallow fetch of one pinned SHA; checks HEAD |
| `measure.ts` | files, LOC, tsc without dependencies (missing-module errors split out), boundary signals, licence |
| `extract-time.ts` | `extractAPG` with the v1.3 defaults, timed (no Neo4j) |
| `fidelity-summary.mjs` | tsc-scoped coverage per view from a `scripts/v1.3/graph-fidelity.ts` aggregate |
| `truth.ts` | compiler truth: `writers`, `callers`, `crossCalls` through the ts-morph language service; imports nothing from DETECT-02 |
| `compare.ts` | the graph index and `context_map`, `who_writes`, `trace`, `impact` against that truth |
| `specs/`, `questions/` | hand-written specs (roles and contexts from each project's own declarations) and the 9 sample questions |
| `rank.mjs` | merges everything with `results/judgements.json` (hand judgements, with evidence) into `results/ranked.json` |

```bash
C=<scratch>/clones                      # outside this repository
node -e 'for (const e of require("./experiments/repo-scout/candidates-v13.json")) console.log(e.id, e.url, e.sha)' \
  | xargs -P 8 -L 1 sh -c 'experiments/repo-scout/clone.sh "$1/v13" "$2" "$3" "$4"' _ "$C"
npx tsx experiments/repo-scout/measure.ts $C/v13 experiments/repo-scout/candidates-v13.json experiments/repo-scout/results/measure-v13.json
# new candidates: clone each entry of candidates-new.json into $C/<id>, then
NODE_OPTIONS=--max-old-space-size=9000 npx tsx experiments/repo-scout/measure.ts $C experiments/repo-scout/candidates-new.json experiments/repo-scout/results/measure-new.json
#   (SCOUT_NO_TSC=1 skips the type check; SCOUT_ONLY=a,b limits the ids; SCOUT_TYPES=node adds @types after an install)
npx tsx experiments/repo-scout/extract-time.ts $C/medusa $C/medusa/tsconfig.scout.json experiments/repo-scout/results/extract/medusa.json
npx tsx scripts/v1.3/graph-fidelity.ts project --root $C/medusa --tsconfig $C/medusa/tsconfig.scout.json --id medusa --views --out <scratch>/gf-medusa
NODE_OPTIONS=--max-old-space-size=7500 npx tsx experiments/repo-scout/compare.ts --tree $C/medusa \
  --tsconfig $C/medusa/tsconfig.scout.json --spec experiments/repo-scout/specs/medusa.yaml \
  --questions experiments/repo-scout/questions/medusa.json --out experiments/repo-scout/results/compare-medusa.json
node experiments/repo-scout/rank.mjs
```

For Novu, `compare.ts` and the fidelity run use a tsconfig at the clone root (`tsconfig.scout-root.json`). It has the
same options as `apps/api/tsconfig.scout.json`, with `include` set to `apps/api/src`, `libs/dal/src` and
`libs/application-generic/src`, and `paths` rebased to the root, because the index reads only files under its tree.
