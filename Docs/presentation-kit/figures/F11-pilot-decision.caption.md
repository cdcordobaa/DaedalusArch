# F11 · pilot-decision

**Title on slide:** Pilot decision, fixed before any run

**What it shows.** The decision rule the loop pilot memo commits to before any run. The pilot (3 tasks: Clean, Hexagonal, DDD; arms none and gate; k = 4; Claude Sonnet; one replicate) asks one question of the `none` arm: is there at least one new blocking finding after step 1 in at least one task (counted only if checked correct)? If no, Study 2's primary outcome moves to the advisory-tier erosion rate (per-run slope of advisory findings per KLOC, FF-CV05 excluded), with the stated costs. If yes, the primary outcome stays blocking violations per step.

**One idea.** The pilot can change exactly one thing, the primary outcome, and the rule for that is written down first.

**Source.** `Docs/v1.3/pilot-outcome-memo.md`: §2 (design table), §3 (primary outcome and the identity of a "new" finding), §4 (advisory slope per KLOC, also without FF-CV05), §5 (pre-committed decision, its reasons and costs, and "No other pilot result may change Study 2's primary outcome"). Context: every E1 finding is advisory under v1.3 (`Docs/DiagnosticRuns/v1.3-study1-rerun-2026-10-15.md` §1).

**Caveats to say.** The pilot has not run; single vendor; no test or interval with 3 runs. Task hashes are recorded in the memo and are deliberately not shown.
