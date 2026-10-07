# Golden snapshot change log (C16, FR-30)

The snapshots in `tests/golden/__snapshots__/` record the observable output of the
symbolic pipeline for the five fixture projects against `specs/clean-arch.yaml`.

Rule: **every change to a snapshot file names the FR that causes it and the commit
that makes it.** A snapshot change without an entry here is a regression, not an
update. Regenerate only with `UPDATE_GOLDEN=1 GOLDEN_REQUIRED=1 npm run test:golden`
(never in CI) and add one line per change:

```
<date> <commit> <case id(s)> — <FR id>: <what changed and why>
```

Observations (verdict gaps against the spec header, truncated `no-cyclic-deps`
results, unexecuted functions) are recorded here too, marked `observation`.

## Entries

2026-10-07 baseline @7cd15b4 all — FR-30: snapshots of current behaviour (symbolic-only, `specs/clean-arch.yaml`); generated three times with Neo4j 5.26.24 restarted between runs, byte-identical.

2026-10-07 observation all — 17 of 24 compiled symbolic functions execute. FF-CV02, FF-CV03, FF-CV04, FF-P01, FF-SO01, FF-SO02 and FF-SO03 fail with `EVAL_001` (unbound parameters `pattern`, `forbiddenImports`, `maxPublicMethods`/`maxDependencies`, `maxInterfaceMethods`, `maxDepth`); fixed by FR-07 in U1. Each case also carries 26 `SPEC_002` override warnings. No `no-cyclic-deps` result reaches the 100-row cap (no `truncatedFunctions`).

2026-10-07 observation verdicts vs spec header (`specs/clean-arch.yaml:9-14`, figures from the spike repo):
- correct-reference: warning, AHS 0.787 (header: 0.85 pass)
- variant-a-structural: hard-block, 0.308 (header: 0.54 soft-block)
- variant-b-pattern: soft-block, 0.517 (header: 0.58 soft-block)
- variant-c-everything: hard-block, 0.396 (header: 0.33 hard-block)
- variant-d-subtle: hard-block, 0.362 (header: 0.66 warning)
Only variant-b and variant-c match the header verdict. U0 fixes nothing; the re-baseline in Build and Test explains the gaps.
