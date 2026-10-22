# PUZZLE-03: three more architecture puzzles, and where agents fall into them (exploratory, DEV split)

**Not Study 2b, not the frozen instrument.** Agent baseline: `Docs/DiagnosticRuns/puzzle-03-2026-10-23.md` (P3r 1/5, P5 0/5, P6 0/5 clean; provisional). Method: `ops/notes/puzzle-01-design.md` (retrograde construction from
the clean end state, the three properties, mechanical verification). Plan of the agent baseline on these puzzles:
`plan.md` (committed before any generator call). Nothing here changes `src/`, `presets/`, `scripts/lib/`,
`scripts/v1.3/`, the tag `v1.4-freeze-2026-10-20` or any Study 2b artefact.

## Puzzles

| Id | Style | Trap | Sub-goals | Frozen instrument | Rung (T, S, Dst, Pd, Dx) | Verdict |
|---|---|---|---|---|---|---|
| **P3r** `p3r-shipping-quotes` | Hexagonal | vendor types, fields and error in the port and the core (H5, H2) | 2 | invisible | 4 (2, 3, 2, 2, 0) | VALID |
| **P5** `p5-ferry-seats` | DDD, two contexts | a booking command changes a sailing synchronously through the sailings module (D4 across contexts) | 2 | invisible (DETECT-02 flags the trap) | 4 (2, 3, 3, 1, 1) | VALID |
| **P6** `p6-workshop-jobs` | Layered | the new report copies the existing one, a controller reading a gateway (H7 skip) | 1 | **visible** (FF-S03) | 3 (1, 3, 2, 2, 0) | VALID |

P3r is P3 of PUZZLE-01 **rebuilt** (its clean port could not be restored exactly; see its README). P5 and P6 are new.
Each puzzle directory holds `seed/` (with `ARCHITECTURE.md`), `tasks.json`, `solutions/clean`, `solutions/trap`,
`gaming/<name>` (a working end state that hides the trap; the oracle must fail it), `tests/behaviour.ts`,
`oracle.ts`, `spec.yaml`, `puzzle.json` and a README with the winning line and the trap line. P5 also has
`alternatives/` (another clean design the oracle must pass).

## Tools

| Path | What |
|---|---|
| `tools/verify.ts` | The PUZZLE-01 verification plus gaming fixtures, alternatives, the previous oracle (P3r) and DETECT-02's `check_consistency`. Writes `verification.json` |
| `tools/runtime-trace.ts` | Runtime tracing for oracles: records each aggregate change with its call stack (P5) |
| `hint-audit/architecture-md-audit.txt` | The R7-style audit of each seed's `ARCHITECTURE.md` (rung L3, puzzle vocabulary as FAIL terms): 0 FAIL |
| `case-bank/` | One card per puzzle |

The behaviour-test runner, the instrument scorer and the oracle helpers are PUZZLE-01's
(`experiments/puzzle-01/tools/`), unchanged.

```
npx tsx experiments/puzzle-03/tools/verify.ts        # zero calls, about 2 minutes
```

## Gaming fixtures (all fail their oracle; all pass the tests)

| Puzzle | Fixture | Shape | Previous checks |
|---|---|---|---|
| P3r | `renamed-vendor-shape` | rename: a copy of the vendor's rate shape declared in the port, the vendor error recognised by name | PUZZLE-01 P3 oracle passes it; instrument silent |
| P5 | `sync-event-handler` | fake event: the command hands an event to subscribers that run at once, inside the command | DETECT-02 and the instrument silent |
| P5 | `batch-unit-of-work` | "batch" wrapper: the other context's change and the own save committed as one unit | instrument silent; DETECT-02 flags it |
| P6 | `renamed-gateways` | rename: the business layer re-exports the gateways under new names | instrument silent (it even loses the planted finding) |
