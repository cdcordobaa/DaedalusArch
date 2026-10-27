# v1.5 HCAL-02: per-rule admission of the Hexagonal confirmatory family

Date: 2026-10-27. Zero model calls. Scored once under `ops/notes/hcal-02-admission-design.md`.

## Order of events

| Step | Commit | Time (−05:00) |
|---|---|---|
| Admission design written (author time) and pushed, before any case existed | `54691642c` → on main as `ae4d2365f` (PR 395) | 00:37 |
| Cases built by 2 blind sessions; the meters base repaired to clean; per-row count 7 × 5 × 2 checked | — | 00:38–00:45 |
| Seal: SHA-256 of 157 files plus the frozen rule sources (same hash as CAL-02, `c8482e5c…`) | `7b7b0d146` | 00:45 |
| Scoring, after PR 395 merged; seal verified (0 mismatches) | this report | later |

**Integrity note.**
- The first scoring ran in a checkout where `graph.ts` already carried the merged pre-flight wiring (PR 393). Every
  rule file matched the seal, but `graph.ts` did not.
- So the set was scored again in a clean worktree at the seal commit, where every source matched the seal (17/17),
  using the hash-verified case files.
- The two runs agree on every row. The sealed run is the official one.

## Result

| Row | Recall | FP | Admitted |
|---|---|---|---|
| H01 domain depends outward | 4/4 | 0/6 | **yes** |
| H02 use case imports an adapter | 4/4 | 0/6 | **yes** |
| H03 adapter imports another adapter | 2/4 | 0/6 | no |
| H04 mechanism in an out-port | 4/4 | 0/6 | **yes** |
| H05 use case constructs an adapter | 4/4 | 0/6 | **yes** |
| H06 business rules in an adapter | 0/4 | 0/6 | no (no rule; cannot be admitted) |
| H07 transport concepts in the core | 1/4 | 0/6 | no |

- **Family bar: met.**
  - Admitted rows: pooled recall 16/16, Wilson lower bound ≈ 0.81 (bar 0.80).
  - 0 false positives on their 24 clean cases.
- **Hexagonal is confirmatory, scored on H01, H02, H04 and H05.** Their rules are FF-S01, FF-S04, FF-P01, FF-P02,
  R-INJ and R-H5. H03 and H07 are scored and reported as exploratory.
- **No row produced a false positive.**

## Repository defect found while scoring

The root `.gitignore` ignores `out/` (build output). That also ignored every `src/adapters/out/**` source file in the
Hexagonal case sets and tasks (HCAL-01: 10 files, HCAL-02: 25, trap families: 74). The local files were intact and
matched the seal. The fix is `experiments/.gitignore` with `!**/adapters/out/`, and the files are now committed.
