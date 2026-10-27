# f27 `f27-ddd-language-school`: one owner for the CEFR level, completions that follow the run (DEV split)

**Variant of:** `p2-loyalty` (same trap mechanism, own story and code). **Families:** D6 / D10 (the level rule reached
across the boundary or re-derived), D4 across contexts (completing a run also writes the learner). **Rung 5**
(T 2, S 3, Dst 3, Pd 2, Dx 0). **Instrument view (measured with `puzzle-01/tools/instrument-score.ts`):** seed and
clean 2 FF-DS02 (the planted file only); trap 6 FF-DS02 (the planted file plus the four new imports). So the D6 route of
SG1 is visible; the D10 route and all of SG2 are not.

## The seed

Two contexts. `placement` owns `Learner` (best placement test score; standing = that score; level from the standing:
A2 from 40, B1 from 60, B2 from 75, C1 from 90, in `LevelBands.ts`) and publishes `openPlacementDesk()` and the
`ProgressSheet` contract (`src/placement/published/`), which already carries the level. `enrolment` owns `CourseRun`
(capacity, minimum CEFR level, seats, completions), reaches placement through the `StudentRegistry` port and the
`PlacementGateway` ACL, and stores raised facts next to each run (`MemoryCourseRunStore`), handed on by `EventPump`
after each course desk command. Clean precedent: `CourseCompleted` is stored and a listener issues the certificate.

Refusals (all throw): unknown student (`no student`), unknown run (`no course run`), full run (`is full`), second seat
(`already joined`), unknown level or no seat when opening (`unknown CEFR level`, `at least one seat`), bad score
(`test score`), completing without a seat (`not enrolled`) or twice (`already completed`); after step 1, a level under
the run's level (`below the course level`), with no seat taken.

**Planted debt (Pd 2, trap-shaped precedent):** `enrolment/application/CertificateWording.ts` reads learners through
placement's domain `LearnerStore` to print the holder's name. It never counts; copying it does.

## The trap line (`solutions/trap/`)

1. `level-gate`: copy the precedent: inject placement's `LearnerStore` into `JoinCourse`, load the `Learner`, call
   `level()`, refuse in the service. **D6** (instrument-visible, FF-DS02).
2. `b1-bar`: change the B1 floor in `LevelBands.ts` (one place, because the trap reached into the owner).
3. `course-completion`: in `CompleteCourse`, after `runs.put(run)`, load the learner, `creditCompletion(runId)` and
   `learners.put(learner)`: one command, two aggregates in two contexts. **D4** (no finding of its own).

Untested alternative route (D10, instrument-invisible): read `ProgressSheet.standing` through the gateway and copy the
band table into enrolment; step 2 must then change both copies. The oracle's SG1 (c) catches it (checked by hand on a
scratch mutant: both the table and the standing comparison are reported).

## The winning line (order matters)

1. **First** give the `StudentRegistry` port `levelOf(studentId)` and map the published `ProgressSheet.level` in the
   gateway; the course-level rule (`reaches(held, needed)`) goes into `CourseRun.admit(studentId, level)`; `JoinCourse`
   confirms the level.
2. Change the B1 floor in `LevelBands.ts`: one place, and the sheet and the desk agree by construction.
3. **First** add the credit rule to `Learner` (`creditCompletion(runId)`, idempotent per run; standing = best score
   + 5 per completed run, at most 100) and a `courseCompleted` input to the published desk; **then** subscribe it to
   the stored `CourseCompleted` in the composition root. `CompleteCourse` still keeps only the run. The pump drains
   before the command returns, so the sheet shows the new standing at once.

## Oracle (`oracle.ts`)

- **SG1:** no enrolment import of placement internals (planted file excepted, exactly its two imports); no read or
  call of a level/standing/score/band member on a placement-internal type; no enrolment comparison of a score or
  standing, with a level floor (40, 55, 60, 75, 90), or a copied floor table.
- **SG2:** no function outside the domain folders with two store writes; at run time, a `Learner` change during
  `joinCourse` or `completeCourse` passes only when `EventPump.drain` delivered it and no enrolment frame started that
  drain. The tracer root is the real path of the tree (a symlinked path would hide every frame).
- **Limits:** textual and typed heuristics for SG1; SG2 sees only the scenario's reach; a moved or renamed pump fails
  SG2 and is hand-read. Every failure on an agent tree is hand-read before it counts.

## Verification (zero calls)

```
npx tsx experiments/puzzle-01/tools/run-tests.ts --puzzle experiments/trap-families/f27-ddd-language-school --tree <tree>
npx tsx experiments/trap-families/f27-ddd-language-school/oracle.ts <tree>
```

Seed: tsc clean, 5/5 regression, 0/5 feature, oracle pass. Clean: 10/10, oracle pass. Trap: 10/10, oracle fails SG1
and SG2. Change size against the seed: clean 9 files / 65 lines, trap 5 files / 50 lines.
