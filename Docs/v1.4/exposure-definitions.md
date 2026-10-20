# Stage C build note: per-rule exposure definitions (Layered)

**Date:** 2026-10-20 (written 2026-10-20T06:08Z, before the count was run on any study data). **Status:** fixed for Stage C; descriptive only.
**Registered by:** the changelog entry of 2026-10-20 in `Docs/v1.4/exploratory-study-registration.md` ("Stage C analysis addition: per-rule exposure").
**Script:** `scripts/v1.4/exposure-count.ts` (definitions in `scripts/v1.4/lib/exposure.ts`). Zero model calls, no Neo4j: the in-process `cypher-interp` engine only.

This note changes no rule, preset, answer, scorer, tier or pass criterion. It adds a denominator next to the violation counts the scorer already reports.

## 1. Which rules

The Layered blocking rules are the rules of `presets/layered.yaml` that the v1.3 tiers (`Docs/v1.3/rule-tiers.md`, `src/scoring-engine/rule-tiers.ts`) mark **blocking** for style `layered` **and** that the compiler compiles for that preset. The script reads both from the pipeline, it does not hard-code them.

| Rule | Template | Compiled for `layered` | Exposure reported |
|---|---|---|---|
| FF-S01 | dependency-direction | yes | yes |
| FF-S02 | no-cyclic-deps | yes | yes |
| FF-S03 | no-layer-skip (blocking only for `layered`) | yes | yes |
| FF-P01 | domain-purity | yes | yes |
| FF-S04 | no-domain-outward-dep | no: "not applicable to style layered" | listed as `not-compiled`, no count |
| FF-P03 | repository-pattern | no: "not applicable to style layered" | listed as `not-compiled`, no count |
| FF-P06 | domain-state-purity | no: "not applicable to style layered" (ADR-V13-02 draft) | listed as `not-compiled`, no count |

A `not-compiled` rule is not part of the Layered blocking verdict at all; it is neither "not exercised" nor "conformant". The post-seal rule FF-P07 has no `layered` row (`Docs/v1.4/rule-tiers-post-seal.md`) and is not compiled for this preset.

## 2. Method

1. The snapshot is evaluated exactly as the loop evaluator does (`evaluateProject`, scoring `v1.3`, engine `cypher-interp`, the harness tsconfig of `scripts/lib/generators/harness-tsconfig.ts`). The script injects the in-memory graph repository and keeps the pipeline context, so it reads (a) the scorer's counted blocking violations per rule (`report.tiers.blocking.rules`), (b) the compiled Cypher text and parameters of each rule (`getCompiledFunctions().symbolicQueries`), and (c) the evaluated graph itself.
2. Each opportunity query is **derived from the compiled rule text** by deleting its violation predicate (an exact text match that must occur once; the script fails if the compiled text has drifted). Nothing re-implements a rule in TypeScript. The edge-view filters, layer properties and parameters the compiler put into the text stay in the opportunity query unchanged.
3. On the same graph the script runs the rule's own compiled query (violation rows) and the opportunity query (opportunity rows), and checks that every violation row is an opportunity row (`violations <= opportunities` by construction, checked row by row).
4. Per rule: `opportunities`, `violations` (the scorer's counted blocking violations, the number Stages A and B report), `violationRows` (the raw rows of the compiled query; equal to `violations` unless a tier transform moved a row), and `violationsPerOpportunity = violations / opportunities`. When `opportunities = 0` the rule is reported as **`not-exercised`**, with a null rate, never as conformant.
5. For loop snapshots the recomputed per-rule counts are compared with the counts recorded in the step record (`snapshot.evaluation.blockingByRule`); a mismatch is reported per snapshot (`recordedMatch: false`), so a count from a graph that differs from the scored one is visible.

Below, the Cypher is the compiled text for `presets/layered.yaml` (sha256 `f0d9045d...`, the spec every Stage A and B step record names). `layerOrder = [persistence, business, presentation]`, `allowedTransitions = [business>persistence, presentation>business]`, `domainLayer = business`.

## 3. Definitions

### FF-S01 dependency-direction

**Opportunity:** one cross-layer import edge, i.e. a `File -[IMPORTS|RE_EXPORTS]-> File` edge (not a re-export hop view) whose two files lie in two different declared layers.
**Why it is the denominator:** the rule constrains exactly the direction of each cross-layer edge; an edge inside one layer or touching an undeclared file cannot break it.
**Derivation:** the compiled rule with `AND srcIdx < tgtIdx` deleted.

```cypher
WITH $layerOrder AS layerOrder
MATCH (src:File)-[i:IMPORTS|RE_EXPORTS WHERE NOT coalesce(i.viaReExport, false)]->(tgt:File)
WHERE src.layer IS NOT NULL AND tgt.layer IS NOT NULL
  AND src.layer <> tgt.layer
WITH src, tgt, i,
     apoc.coll.indexOf(layerOrder, src.layer) AS srcIdx,
     apoc.coll.indexOf(layerOrder, tgt.layer) AS tgtIdx
WHERE srcIdx >= 0 AND tgtIdx >= 0
RETURN src.filePath AS source, tgt.filePath AS target, src.layer AS srcLayer, tgt.layer AS tgtLayer,
       type(i) AS relType, ...
```

### FF-S03 no-layer-skip

**Opportunity:** the same cross-layer import edges as FF-S01 (every declared layer is in `layerOrder`, so the two sets coincide for this preset).
**Why:** strict layering constrains each cross-layer edge to the adjacent step down; every cross-layer edge could be a skip.
**Derivation:** the compiled rule with `AND NOT (src.layer + '>' + tgt.layer) IN $allowedTransitions` deleted.

```cypher
MATCH (src:File)-[i:IMPORTS|RE_EXPORTS WHERE NOT coalesce(i.viaReExport, false)]->(tgt:File)
WHERE src.layer IS NOT NULL AND tgt.layer IS NOT NULL
  AND src.layer <> tgt.layer
RETURN src.filePath AS source, tgt.filePath AS target, src.layer AS srcLayer, tgt.layer AS tgtLayer,
       type(i) AS relType, ...
```

### FF-P01 domain-purity

**Opportunity:** one package import edge from a file of the restricted layer (`business`), i.e. `File -[IMPORTS|RE_EXPORTS]-> Package` with `src.layer = $domainLayer`, any package.
**Why:** the rule forbids some packages in that layer; every package the layer imports is a place where a forbidden one could have been chosen. Imports of project files are not opportunities: they cannot match a package name.
**Derivation:** the compiled rule with the `AND ANY(fp IN $forbiddenImports WHERE ...)` line deleted.

```cypher
MATCH (src:File)-[i:IMPORTS|RE_EXPORTS WHERE NOT coalesce(i.reExportHop, false)]->(p:Package)
WHERE src.layer = $domainLayer
RETURN src.filePath AS source, p.name AS target, type(i) AS relType, ...
```

### FF-S02 no-cyclic-deps

**Opportunity:** one module dependency edge, i.e. a `File -[IMPORTS|RE_EXPORTS]-> File` edge between two distinct files, under the same edge view as the rule (any layer, declared or not, as the rule itself).
**Why:** a cycle is a closed chain of such edges; a snapshot with no file-to-file edge cannot hold a cycle, and every edge can close one. The rule's unit is a cycle, not an edge, so `violationsPerOpportunity` is "cycles per dependency edge": it is reported, but it is not a per-edge probability. The row check is that every edge of every reported cycle is an opportunity edge.
**Derivation:** the cycle predicate is the closed variable-length path `(f)-[*2..10]->(f)`; deleting it leaves its single step. The script takes the relationship types and the edge-view predicate from the compiled text and returns one row per edge:

```cypher
MATCH (f:File)-[r:IMPORTS|RE_EXPORTS]->(g:File)
WHERE (NOT coalesce(r.viaReExport, false)) AND f <> g
RETURN f.filePath AS source, g.filePath AS target, type(r) AS relType
ORDER BY source, target, relType
```

A self-import (`f = g`) is excluded: the rule's paths have length 2 or more, so it can never close a cycle.

## 4. Development-set validation (before any study data)

Run on the Layered v1.3 reference project: 13 trees, the clean project and its 12 variants (`tests/fixtures/v1.3-reference/layered`, each materialised by `scripts/v1.3/lib/materialise.ts`), with `npx tsx scripts/v1.4/exposure-count.ts --devset`, written to `results/v1.4-exposure-devset/exposure.json`. The results are in §6.

## 5. Stage C: the coordinator's command

The committed Stage A and B step records (`results/v1.4-exploratory/`) hold no snapshot trees (`snapshots.git`), so the count cannot be run in the repository. It is run locally on the loop out-roots, which hold `runs/<runId>/snapshots.git`:

```sh
npx tsx scripts/v1.4/exposure-count.ts --steps results/v1.4-exploratory \
  --snapshots-root <stage-a out-root> --snapshots-root <stage-b out-root> [--snapshots-root <stage-c out-root>] \
  --node-modules <skeleton install>/node_modules \
  --out results/v1.4-exposure-exploratory
```

`--node-modules` is the generator skeleton install the loop evaluated with (`scripts/generator/skeleton`); it is linked into each materialised tree. Every scored turn of every step record is counted; a snapshot whose tree is not found is listed with status `no-tree` and the script exits 3. The output gives one row per snapshot and rule and an aggregate per group (the run directory's parent, e.g. `stage-b/none-L3`) and rule; `recordedMatch` must be true on every row before the numbers are reported.

## 6. Results on the development set (2026-10-20)

Every row check passed on all 13 trees: no violation row lies outside the opportunity rows, and `violations <= opportunities` for every rule and tree. The rule's own rows equal the scorer's counted violations everywhere.

| Tree | FF-P01 v/o | FF-S01 v/o | FF-S02 v/o | FF-S03 v/o |
|---|---|---|---|---|
| clean | 0/0 not exercised | 0/17 | 0/62 | 0/17 |
| n01-controller-parses-money | 0/0 not exercised | 0/18 | 0/63 | 0/18 |
| n02-reporting-service-reads-database | 0/0 not exercised | 0/19 | 0/66 | 0/19 |
| n03-views-import-model-barrel | 0/0 not exercised | 0/17 | 0/67 | 0/17 |
| v01-gateway-returns-business-money | 0/0 not exercised | 1/18 | 0/63 | 1/18 |
| v02-service-renders-view | 0/0 not exercised | 1/18 | 0/63 | 1/18 |
| v03-controller-reads-gateway | 0/0 not exercised | 0/18 | 0/63 | 1/18 |
| v04-view-types-persistence-record | 0/0 not exercised | 0/18 | 0/63 | 1/18 |
| v05-business-model-cycle | 0/0 not exercised | 0/17 | 1/64 | 0/17 |
| v06-router-controller-cycle | 0/0 not exercised | 0/17 | 1/63 | 0/17 |
| v07-business-model-typeorm-decorator | 1/1 | 0/17 | 0/62 | 0/17 |
| v08-business-service-takes-express-request | 1/1 | 0/17 | 0/62 | 0/17 |
| v09-presentation-root-builds-database | 0/0 not exercised | 0/18 | 0/63 | 1/18 |

v = the scorer's counted blocking violations, o = opportunities. FF-P01 is not exercised on 11 of 13 trees: the reference business layer imports no package, so a zero there says nothing about framework purity. This is the case the registration entry anticipated.

**Hand check (independent of the graph).** A plain import scan of the source (relative specifiers resolved to `.ts` or `index.ts`, layers from the `src/<layer>/` prefix) on three trees gives the same numbers: clean 62 file-to-file edges, 17 cross-layer, 0 upward, 0 skips, no business package import; v03 63 edges, 18 cross-layer, 1 skip (`src/presentation/http/CatalogController.ts` to `src/persistence/ProductGateway.ts`); v07 one business package import (`src/business/model/Order.ts` to `typeorm`), which is the one FF-P01 violation; v05 64 edges and 17 cross-layer edges, with the scorer's one cycle.

**Loop path.** The `--steps` path was checked end to end on a synthetic out-root (one `snapshots.git` holding the v03 tree, one loop-step/v1 record naming `presets/layered.yaml` with its sha256 and a recorded `blockingByRule` of FF-S03 = 1): the harness tsconfig path gives the same counts as the dev set (FF-S01 0/18, FF-S02 0/63, FF-S03 1/18, FF-P01 not exercised) and `recordedMatch` is true. On `results/v1.4-exploratory` (60 scored snapshots in Stages A and B) every snapshot is `no-tree`, as expected: the trees live in the local out-roots (§5).

**Unit tests:** `tests/unit/scripts/v1.4/exposure-count.test.ts` (fixture graphs for each rule, a zero-opportunity rule, drift detection of the compiled text, the aggregate, and the derivation on the pipeline's own compiled text for `presets/layered.yaml`).
