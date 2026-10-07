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
