# v1.5 HCAL-05: admission of Hexagonal row H11 (third round)

Date: 2026-10-29. Zero model calls. Scored once, under the bar in `ops/notes/cn-05-hex-h11.md`.

## Order of events (from the commits)

| Step | Commit |
|---|---|
| CN-05 design committed before the R-MIRROR revision and any case | `71d7f262d` |
| Cases built by 2 blind sessions (dental lab orders, electric scooter rental), brief `experiments/hcal-05/BRIEF.md` | — |
| Scooter base repaired by its builder before the seal: one aggregate saved per use case (2 case overlays updated) | — |
| R-MIRROR revision (a bare-specifier import is a vendor module wherever it resolves) | PR 417, merged `f60a441c6` |
| Seal: SHA-256 of 67 files (`fda76727…`), frozen rule sources and scorer (`761f37d9…`) | `29e1c2e56` |
| Scoring; hashes re-verified first | this report |

**Base check exception (recorded before scoring, in `SEAL.root`):** the scooter base scores clean except one R-LOCK
finding at `src/adapters/in/http/trip.controller.ts:19`, where the controller calls `LockScooterPort.lock(…)`, the
domain's own verb for locking a scooter. That is a false positive of R-LOCK (an exploratory DDD rule, row K11, not
admitted), not an architecture problem. The base was not renamed to hide it. R-LOCK is not mapped to H11, so the row's
score cannot be affected.

## Result

| Row | Recall | FP | Admitted |
|---|---|---|---|
| H11 vendor vocabulary in the core (R-MIRROR) | 3/4 | 0/6 | no |

The miss, `scooter-rental/H11-pos2` (read after scoring): the core compares plain strings against the vendor's codes
inside its logic instead of declaring a type or constant set of them. R-MIRROR reads type, enum and constant
declarations, so a literal used only in a comparison is not seen. Covering it means following string literals that are
values of a vendor literal type into core comparisons; that is development work and needs a fresh sealed set.

## Standing of H11

Not admitted. Development evidence: HCAL-04 4/4 and 0/6 with the CN-05 rule (opened for the revision), HCAL-05 3/4 and
0/6 sealed, and the four TRAPRATE-01 runs (f2, f14) in which the agent copied vendor codes into the core. R-MIRROR runs
in the final study, its findings are delivered by the tool like every other rule's, and it is scored as an exploratory
outcome. The Hexagonal confirmatory family stays H01–H05, H07, H08, H09, H10.

## Regression at the new rule hash

Re-run at `main` `ea0da2b61` (rules as sealed here), compared case by case with each sealed record:

- **CAL-03:** identical. The 9 DDD rows keep their admission.
- **HCAL-03:** identical except 4 violation cases of non-admitted rows (H06: 3 R-ADAPTER-RULE hits; H08-pos2: the
  via-helper hit), all from CN-04. The 8 admitted Hexagonal rows are unchanged.
- **HCAL-04:** identical except the 4 H11 positives, now found by R-MIRROR (CN-05; HCAL-04 is development evidence for
  H11). H08 unchanged (admitted).

**Final families for the registration:** DDD K01, K02, K03, K05, K10 (R-D5S), K13, K14, K15, K16 (36/36); Hexagonal
H01, H02, H03, H04, H05, H07, H08, H09, H10 (36/36). Exploratory and still delivered by the tool: the other DDD rows,
H06 (R-ADAPTER-RULE) and H11 (R-MIRROR).
