# v1.3 snapshot measures: independent measures and gaming guards per snapshot (gate D13, D16)

**2026-10-16. Status: definitions and pass criterion fixed before any number was computed (this section is committed
first). Results are added in §5 by a later commit.** Tooling only. It is not a pre-registration, and nothing here
compares arms or reads a construct switch.

Code: `scripts/v1.3/snapshot-measures.ts` (entry), `scripts/v1.3/lib/snapshot-measures.ts` (pure parts).
Test: `tests/unit/scripts/v1.3/snapshot-measures.test.ts`.

## 1. What it is

A post-hoc scorer over a store of snapshots. It never runs inside a loop and never writes into an agent's working
directory, so the live loop, its step records and the replay digest are unchanged. It reads two store layouts:

- **Loop store** (`runLoop` output root, e.g. the loop replay's `out/`): every `runs/**/run.json` directory. The
  snapshots are the turn snapshots of `steps/step-NN.json` (`step-NN`, and `step-NN-repair` for the gate's repair
  turn), checked out from the run's `snapshots.git` with `git archive`. The spec is the step's `evaluatorSpec`
  (repository-relative when static, run-directory-relative when frozen after step 1). The tool's blocking rows are the
  turn snapshot's `evaluation.blockingFindings`.
- **Probe store** (`results/v1.3-floor-probe` layout: `tasks.json` plus `<task>/<arm>/snapshots/step-NN/src`): the
  `none` arm's record is `step-NN.json`, the `tool` arm's is `step-NN.post.json` (the snapshot is the post-fix tree).
  The spec is the record's `spec`; the tool's blocking rows are its `blockingFindings`.

Each snapshot is copied to a fresh scratch directory. A tsconfig is written there only when the tree has none: the
loop's pinned per-run tsconfig (`buildHarnessTsconfig`, BR-U5a-42), which is what the loop's own type-check and
evaluation use. Output goes to `--out` (default `<store>/measures`), one JSON per snapshot plus `summary.json` and
`summary.md`. Paths in the output are store-relative or tree-relative, never scratch paths.

## 2. Measure definitions

All file measures are over the **source files**: `src/**/*.ts` of the tree, `.d.ts` excluded (the BR-U5a-48 file set
the loop measures), sorted.

| Field | Definition |
|---|---|
| `files` | Number of source files. |
| `loc` | Non-blank lines of the source files (the SO5 rule, as `treeLoc`). |
| `unmatchedShare` | Share of source files that match no layer glob (directories or file patterns, `resolveLayer`), no DDD context root and no `outside_contexts` glob of the spec: the outline's "layer-coverage share" stated as the uncovered part (`unmatchedShare` of `pilot-metrics.ts`, reused). `coverageShare = 1 − unmatchedShare`. Null when there are no source files. |
| `importKinds.static` | Import declarations with a module specifier that are not `import type` (side-effect imports included; `import { type X }` counts here). |
| `importKinds.typeOnly` | `import type ... from` declarations. |
| `importKinds.dynamic` | `import(...)` call expressions. |
| `importKinds.require` | `require(...)` calls on the identifier `require`, plus `import x = require(...)`. |
| `importKinds.reexport` | `export ... from` declarations (reported; not one of the four gate kinds). |
| `barrels` | Files with at least one statement whose every top-level statement is an `export ... from` declaration (the file exports only re-exports). The list of barrel paths is kept. |
| `depcruise` | dependency-cruiser **18.4.0** (the pinned `experiments/tool-comparison/depcruise` lockfile), config = the ADR-030 translation (`translateSpec`, `TRANSLATION_VERSION` 1.0.0) of the snapshot's spec, run on `src` with the tree as cwd. Per translated function id: the number of violations and the sorted finding keys (`depcruiseFindings`, `findingKey` of `scripts/tool-comparison.ts`: function, file, target; a cycle keys on its canonical ring; a package target is the package name). The translated and skipped function lists of the translation are kept. |
| `heldOut` | **Left as a field (null) with the reason.** Which rules are withheld from the gate arm is the author's decision (night backlog job G1, gate line D16). The scorer computes nothing for it. |

Import counting uses the TypeScript parser (`ts.createSourceFile`), not a regex, so comments and strings never count.

## 3. Agreement table (tool vs dependency-cruiser)

Scope: the blocking functions the translation can express, **FF-S01, FF-S02, FF-S03, FF-S04, FF-P01**, and of these
only the ones the translation produced rules for on that spec (others are reported as "not translated here").

Per snapshot and per function: the tool's keys (its blocking rows mapped to the same key: rule id, file, target;
FF-S02 on the canonical cycle of the comma-separated file list) and dependency-cruiser's keys, then `both`,
`toolOnly`, `depcruiseOnly`. A key is the same function id under the same spec in both tools: the comparison is
"the same rule id of the same spec", not "the same construct", because the translation of a template can differ from
the template (e.g. a graph-direction template against the T2 spec-order direction); that is exactly what the table
should expose.

Every one-sided key gets one reason class. The graph-fidelity classes are used where they fit
(`scripts/v1.3/lib/graph-fidelity.ts` `ReasonClass`), decided from the source file's own imports of the target:

| Class | When |
|---|---|
| `type-only` | Every import of the target from the source file is `import type`. |
| `re-export/barrel` | The edge is only an `export ... from`, or it passes through a barrel file. |
| `dynamic-import` | The only import of the target is `import(...)`. |
| `require` | The only import of the target is `require(...)`. |
| `.d.ts` | The target is a `.d.ts` file. |
| `excluded-file` | The source file is excluded by the function's `exclude_paths` or the extractor excludes. |
| `rule-semantics` | (new here) A plain static import edge both sides can see, flagged by one side only: the translated rule and the template disagree on that edge. |
| `unexplained` | None of the above. |

## 4. Pass criterion (fixed before running)

1. **Coverage.** Every snapshot of both stores (the loop replay store: 9 runs, 39 snapshots; the floor probe:
   6 tasks × 2 arms, every `snapshots/step-NN`) has a measures file with every field of §2 (`heldOut` null with its
   reason). Pass = 100 %.
2. **Reproducibility.** Two runs of the scorer on the same store into two directories are byte-identical over every
   output file.
3. **Agreement reported.** The §3 table is in the output for every snapshot, both stores. No agreement threshold is a
   pass condition: the agreement figure is a measure to report, null or not.
4. **No regression.** The 71 reference results are byte-identical (rules block item 3); the new unit tests pass; the
   loop's own records and replay digest are untouched (the scorer only reads them).

The results section states every figure, including disagreements, and carries the development-set banner: the replay
tapes are scripted and the probe trees come from one Claude session, so nothing here is a validity estimate.

## 5. Results

(Added after the run.)
