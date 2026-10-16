# v1.3 construct switches

**2026-10-15. Status: implemented, every switch at A (the status quo).** Nothing here answers a question of
`construct-decisions.md`. Every option that needs code, a template, a tier or a preset is pre-implemented behind
a named switch, so that the author's answers become configuration. No live development-set re-run was done; that
happens after the author decides. `rule-tiers.md` is not edited.

## How to answer

1. Fill the decision board (or write a JSON map such as `{"Q3": "C", "Q5": {"choice": "D", "note": "…"}}`).
2. Run `node --import tsx scripts/v1.3/apply-construct-answers.ts <answers.json>`. It accepts the plain map or the
   board's database export: documents with the question as id and fields `{choice, note}`, under `data`, `fields`
   or flat, as an array or in a `documents` envelope. It rewrites the generated block of
   `src/shared/construct-switches.ts`. An unanswered question stays at A. Then it prints:
   - the tier ADRs to write and sign. Until they are signed, the switch applies an override with a
     `TODO(ADR-V13-03, Qn)`;
   - the ADR-V13-03 "construct decisions" entries (applicability, rule definition, preset, policy);
   - the action items (Q13: the ADR-V13-02 / NestJS preset contradiction);
   - the next commands: the offline preview, then the one development-set re-run.
3. Preview offline: `node --import tsx scripts/v1.3/construct-rescore.ts --base results/v1.3-reference/after-member-facts --out <dir>`.
4. After the ADRs are signed, run the development-set re-run (`ue-baseline-live.ts`, `ue-graph.ts`, `ue-score.ts`,
   as printed). For Q16 B and Q25 B this is one run before the hold-out, with no second tuning loop.

## Where the switches act

The switch file is `src/shared/construct-switches.ts`: one entry `{ Q, option, kinds }` per question. `kinds` marks
each offered option `code` or `no-code`. The option data (summary, mechanism, ADR) is in
`src/shared/construct-switch-catalogue.ts`, and a unit test keeps the two equal. The switches are read only under
the v1.3 options:

| Hook | Where | Read when |
|---|---|---|
| compile | `src/construct-switches/compile.ts`, called first in `compileFunctions` | `CompileOptions.constructSwitches` (set by `V13_COMPILE_OPTIONS`) |
| rows | `src/construct-switches/rows.ts`, run by the evaluate commands on their symbolic results | pipeline `scoringMode: 'v1.3'` and a switch set |
| tiers | `src/construct-switches/tiers.ts`, via `TieredScoringInput.tierResolver` | v1.3 tiered scoring and a switch set |
| scoring | `scripts/v1.3/lib/construct-rescore.ts` | the reference re-score |

- **compile**: preset additions, the nestjs layer order, applicability, and *carriers*. A carrier is a declared
  function whose query returns no row. The row stage fills it, so a new rule is compiled and executed like any other
  rule, and the report's identities hold.
- **rows**: drops, moves (P2: the rule that owns the construct takes the row) and additions. Additions are computed
  from an in-memory graph of the run's APG, with the ingestion layer assignment (`src/construct-switches/graph.ts`).
  A row is only ever added to a function that executed.
- **tiers**: overrides on top of `ruleTier`, plus the row-level split of Q3 C.

The frozen template text is never edited. At the status quo every hook is the identity: the compile overlay returns
its input, the row stage returns the same array, the tier resolver is not wired, and `V13_COMPILE_OPTIONS`
compiles every preset byte for byte as before.

## The 25 questions

| Q | Option | Kind | Mechanism | What the switch does | ADR the author owes |
|---|---|---|---|---|---|
| 1 | A | no-code | | FF-P06 not applicable to layered (already in) | sign ADR-V13-02 |
| 1 | B | code | compile, tier | FF-P06 applies to layered, advisory there | applicability; **tier** |
| 1 | C | code | compile | FF-P06 applies to layered, blocking (v1.2E) | applicability |
| 2 | B | code | rows | drops rows whose `isTypeOnly` is true, and cycles closed by a type-only edge | rule |
| 3 | B | code | rows | drops cycles inside one layer and one module (nestjs feature folder, ddd context) | rule |
| 3 | C | code | tier (row) | those cycles are an advisory second row of FF-S02; crossing cycles stay blocking | **tier** |
| 4 | B | code | rows | FF-S02 row for an edge against the allowed direction between two layers that also depend on each other, outside any file cycle | rule |
| 5 | B | code | tier | FF-S03 blocking in hexagonal and ddd | **tier** |
| 5 | C | code | rows | adapter -> adapter rows move from FF-S03 to FF-S01 | rule |
| 5 | D | code | compile, rows, tier | new rule FF-S05 adapter-isolation (carrier) owns them, blocking in hexagonal and ddd | rule; **tier** (new row) |
| 6 | B | code | rows | hexagonal FF-S04 core = domain + application: application -> outside rows added, domain -> application rows dropped | rule |
| 7 | B | code | rows | FF-P03 row for a file outside the adapter layer and the composition roots that imports or injects a concrete adapter | rule |
| 8 | A | no-code | | as today (see the notes) | **tier**: amend the "partial" note |
| 8 | B | code | scoring | the FLOWS_TO rows of FF-P06 are listed N/A, with their manifest rows, not scored | policy |
| 9 | B | code | rows | each FF-P03 row also gets an FF-P02 row on the implementer | rule |
| 9 | C | code | rows | drops the FF-P03 row of a class with no `implements` whose methods cover a port's and that is imported somewhere | rule |
| 10 | B | code | rows | FF-P01 in layered keeps web/UI packages only (`CONSTRUCT_WEB_UI_PACKAGES`) | rule |
| 10 | C | code | compile, rows | FF-P01 not applicable to layered; the overlay mapping (`express` etc. -> presentation) makes FF-S01 rows | applicability; rule |
| 10 | D | code | compile | FF-P01 not applicable to layered | applicability |
| 11 | B | code | rows | drops FF-S01 and FF-S04 rows from a domain file to an application file (hexagonal, ddd) | rule |
| 12 | B | code | rows | drops layered FF-S03 rows whose reverse transition is allowed | rule |
| 13 | B | code | rows | drops an FF-P04 row whose violating dependencies all lie below the use case in the declared order | rule; action item |
| 13 | C | code | preset | nestjs layers in the Clean order (domain, application, presentation, infrastructure) | preset; action item |
| 14 | B | code | tier | FF-DT03 advisory | **tier** |
| 14 | C | no-code | | member facts, merged in #90; identical to A today | note |
| 15 | B | code | tier | FF-DS01 advisory (own row) | **tier** |
| 16 | B | code | preset | FF-S02 no-cyclic-deps added to the ddd preset | preset |
| 17 | B | code | rows | FF-DS02 row for the resolved target of a barrel import that is not public | rule |
| 17 | C | code | compile, rows | new advisory rule FF-DS03 (carrier): a public-API barrel that re-exports an application-layer file | rule; **tier** (new row) |
| 18 | B | code | rows | FF-DS02 row for an ACL file that imports another context outside its public API | rule (changes the sealed row's wording) |
| 19 | B | code | rows | keeps an FF-DT01 row only when a class of the importing file holds the inner entity (FLOWS_TO or CONSTRUCTOR_INJECTS) | rule |
| 20 | B | code | rows | domain-purity row for a domain file that reaches a forbidden package through project files | rule |
| 21 | B | code | tier | FF-DT05 blocking | **tier** |
| 22 | B | code | rows | FF-P02 ratio over dependencies in another layer only | rule |
| 23 | B | code | rows | FF-P05 entities = every class of the declared domain layer (reach unchanged) | rule |
| 24 | B | code | compile, rows | advisory FF-S03 row for a controller or inbound-adapter file importing a domain file (clean, nestjs: FF-S03 runs as a carrier) | rule |
| 25 | B | code | preset | composition-root globs (`**/main.ts`, `**/*.module.ts`, `**/*Container.ts`, …) excluded from the layer rules | preset |

Every option A, and Q14 C, is `no-code`: 26 options. The other 34 options are `code`. Every question has at least
one `code` option.

## Notes for the author

- **Q8 A is not exactly the status quo.** The pipeline's v1.3 verdict already reports the FLOWS_TO half N/A
  (`RULE_TIERS` FF-P06 `partial`, `tiered-scoring.ts`). Only the reference scorer counts those rows as blocking. B
  makes the scorer follow the sealed text. A keeps both readings as they are. Choosing A as worded ("score them as
  blocking") would also mean removing the `partial` entry by ADR. That change is not switched, because it would change
  the status quo.
- **Q14: the status quo is now C's behaviour.** After #90 (member facts), g01's set accessor is detected, so A
  ("accessor half N/A") no longer describes the tool, and A and C behave identically.
- **Q23 B does not recover v07 or v09.** The template reaches entities only through constructor injection (its
  `IMPORTS` hop joins Class nodes and never matches; `edge-views.md`). The controllers in v07 and v09 name the entity
  without injecting it, so changing only the selector moves no row. The CSV figure (16/16) assumed an import reach.
- **Q13 C needs Q25 B.** On its own, the Clean order makes every `*.module.ts` that wires a repository an FF-S01 row:
  4 distinct rows on each of the 14 variants, which gives nestjs blocking P 10/68. With Q25 B as well, the effect is
  the one the CSV states: v07 becomes an FF-S01 finding, v02 is no longer one, and blocking R and P are 10/11.
- **Q20 B is wide.** Transitive closure turns every outward edge into a purity finding, as P2 warns: 2 to 5 new rows
  per style, not only nestjs v10.
- **Q4 B** adds a row for every edge that closes a layer cycle on every variant. That is 5 rows in clean and
  hexagonal, more than the blind manifest's 4.
- **Q24 B** adds 17 hexagonal rows, mostly inbound adapters that use a domain value type, repeated across variants.
- **Q2 B** changes the rows of edge rules and cycles. The coupling metrics (advisory) still count type-only edges.

## Expected effect on the development set (offline)

Computed with `construct-rescore.ts --effects` from `results/v1.3-reference/after-member-facts` (saved rows and
evidence; graphs re-extracted in-process with the v1.3 defaults, no Neo4j). Each option is applied alone, with every
other question at A. The figures are compared with the **current author manifests**. The reference changes only where
the option renames a row (Q5 C or D), removes or adds a compared rule (Q10 C or D: FF-P01 leaves layered; Q5 D, Q16 B,
Q17 C: the new rule joins), or lists rows N/A (Q8 B). An added row the author manifest does not expect therefore shows
as a lower P. Under that option's redefined reference it might be a TP: see `construct-decisions-impact.csv` for the
redefined-reference figures. For Q1 B or C, Q13 C and Q16 B, the rows of the newly compiled template come from an
offline stand-in of its definition (`scripts/v1.3/lib/construct-simulate.ts`). These are development-set figures,
not validity estimates.

"Current" is after-member-facts: blocking clean R 13/13, layered 11/11, nestjs 11/11, hexagonal 13/13, ddd 9/9, all
at P 1.00. A style a row does not list is unchanged. "Rows" counts rows the switch added and dropped, moves included.

| Q | Option | Style | Blocking (current → option) | All rules (current → option) | Rows added / dropped | Scope |
|---|---|---|---|---|---|---|
| Q1 | B | layered | R 11/11, P 11/11 → R 11/11, P 11/11 | R 11/11, P 11/11 → R 11/11, P 11/64 | +0 / -0 |  |
| Q1 | C | layered | R 11/11, P 11/11 → R 11/11, P 11/64 | R 11/11, P 11/11 → R 11/11, P 11/64 | +0 / -0 |  |
| Q2 | B | clean-architecture | R 13/13, P 13/13 → R 12/13, P 12/12 | R 15/16, P 15/15 → R 14/16, P 14/14 | +0 / -1 |  |
| Q2 | B | layered | R 11/11, P 11/11 → R 9/11, P 9/9 | R 11/11, P 11/11 → R 9/11, P 9/9 | +0 / -2 |  |
| Q2 | B | nestjs | R 11/11, P 11/11 → R 10/11, P 10/10 | R 12/13, P 12/14 → R 11/13, P 11/13 | +0 / -1 |  |
| Q2 | B | ddd | R 9/9, P 9/9 → R 4/9, P 4/4 | R 12/12, P 12/12 → R 6/12, P 6/6 | +0 / -6 |  |
| Q3 | B | clean-architecture | R 13/13, P 13/13 → R 12/13, P 12/12 | R 15/16, P 15/15 → R 14/16, P 14/14 | +0 / -1 |  |
| Q3 | B | layered | R 11/11, P 11/11 → R 9/11, P 9/9 | R 11/11, P 11/11 → R 9/11, P 9/9 | +0 / -2 |  |
| Q3 | B | hexagonal | R 13/13, P 13/13 → R 12/13, P 12/12 | R 16/16, P 16/16 → R 15/16, P 15/15 | +0 / -1 |  |
| Q3 | C | clean-architecture | R 13/13, P 13/13 → R 12/12, P 12/12 | R 15/16, P 15/15 → R 15/16, P 15/15 | +0 / -0 |  |
| Q3 | C | layered | R 11/11, P 11/11 → R 9/9, P 9/9 | R 11/11, P 11/11 → R 11/11, P 11/11 | +0 / -0 |  |
| Q3 | C | hexagonal | R 13/13, P 13/13 → R 12/12, P 12/12 | R 16/16, P 16/16 → R 16/16, P 16/16 | +0 / -0 |  |
| Q4 | B | clean-architecture | R 13/13, P 13/13 → R 13/13, P 13/18 | R 15/16, P 15/15 → R 15/16, P 15/20 | +5 / -0 |  |
| Q4 | B | layered | R 11/11, P 11/11 → R 11/11, P 11/13 | R 11/11, P 11/11 → R 11/11, P 11/13 | +2 / -0 |  |
| Q4 | B | nestjs | R 11/11, P 11/11 → R 11/11, P 11/14 | R 12/13, P 12/14 → R 12/13, P 12/17 | +3 / -0 |  |
| Q4 | B | hexagonal | R 13/13, P 13/13 → R 13/13, P 13/18 | R 16/16, P 16/16 → R 16/16, P 16/21 | +5 / -0 |  |
| Q5 | B | hexagonal | R 13/13, P 13/13 → R 15/15, P 15/15 | R 16/16, P 16/16 → R 16/16, P 16/16 | +0 / -0 |  |
| Q5 | B | ddd | R 9/9, P 9/9 → R 10/10, P 10/10 | R 12/12, P 12/12 → R 12/12, P 12/12 | +0 / -0 |  |
| Q5 | C | hexagonal | R 13/13, P 13/13 → R 15/15, P 15/15 | R 16/16, P 16/16 → R 16/16, P 16/16 | +2 / -2 |  |
| Q5 | C | ddd | R 9/9, P 9/9 → R 10/10, P 10/10 | R 12/12, P 12/12 → R 12/12, P 12/12 | +1 / -1 |  |
| Q5 | D | hexagonal | R 13/13, P 13/13 → R 15/15, P 15/15 | R 16/16, P 16/16 → R 16/16, P 16/16 | +2 / -2 | +FF-S05 |
| Q5 | D | ddd | R 9/9, P 9/9 → R 10/10, P 10/10 | R 12/12, P 12/12 → R 12/12, P 12/12 | +1 / -1 | +FF-S05 |
| Q6 | B | hexagonal | R 13/13, P 13/13 → R 12/13, P 12/14 | R 16/16, P 16/16 → R 15/16, P 15/17 | +2 / -1 |  |
| Q7 | B | clean-architecture | R 13/13, P 13/13 → R 13/13, P 13/14 | R 15/16, P 15/15 → R 15/16, P 15/16 | +1 / -0 |  |
| Q7 | B | nestjs | R 11/11, P 11/11 → R 11/11, P 11/13 | R 12/13, P 12/14 → R 12/13, P 12/16 | +2 / -0 |  |
| Q7 | B | hexagonal | R 13/13, P 13/13 → R 13/13, P 13/17 | R 16/16, P 16/16 → R 16/16, P 16/20 | +4 / -0 |  |
| Q8 | B | clean-architecture | R 13/13, P 13/13 → R 12/12, P 12/12 | R 15/16, P 15/15 → R 14/15, P 14/14 | +0 / -0, N/A 1 |  |
| Q8 | B | nestjs | R 11/11, P 11/11 → R 10/10, P 10/10 | R 12/13, P 12/14 → R 11/12, P 11/13 | +0 / -0, N/A 1 |  |
| Q8 | B | hexagonal | R 13/13, P 13/13 → R 12/12, P 12/12 | R 16/16, P 16/16 → R 15/15, P 15/15 | +0 / -0, N/A 1 |  |
| Q9 | B | clean-architecture | R 13/13, P 13/13 → R 13/13, P 13/13 | R 15/16, P 15/15 → R 15/16, P 15/16 | +1 / -0 |  |
| Q9 | B | nestjs | R 11/11, P 11/11 → R 11/11, P 11/11 | R 12/13, P 12/14 → R 12/13, P 12/15 | +1 / -0 |  |
| Q9 | B | hexagonal | R 13/13, P 13/13 → R 13/13, P 13/13 | R 16/16, P 16/16 → R 16/16, P 16/18 | +2 / -0 |  |
| Q9 | C | clean-architecture | R 13/13, P 13/13 → R 12/13, P 12/12 | R 15/16, P 15/15 → R 14/16, P 14/14 | +0 / -1 |  |
| Q9 | C | nestjs | R 11/11, P 11/11 → R 10/11, P 10/10 | R 12/13, P 12/14 → R 11/13, P 11/13 | +0 / -1 |  |
| Q9 | C | hexagonal | R 13/13, P 13/13 → R 12/13, P 12/12 | R 16/16, P 16/16 → R 15/16, P 15/15 | +0 / -1 |  |
| Q10 | B | layered | R 11/11, P 11/11 → R 10/11, P 10/10 | R 11/11, P 11/11 → R 10/11, P 10/10 | +0 / -1 |  |
| Q10 | C | layered | R 11/11, P 11/11 → R 9/9, P 9/10 | R 11/11, P 11/11 → R 9/9, P 9/10 | +1 / -0 | -FF-P01 |
| Q10 | D | layered | R 11/11, P 11/11 → R 9/9, P 9/9 | R 11/11, P 11/11 → R 9/9, P 9/9 | +0 / -0 | -FF-P01 |
| Q11 | B | hexagonal | R 13/13, P 13/13 → R 11/13, P 11/11 | R 16/16, P 16/16 → R 14/16, P 14/14 | +0 / -2 |  |
| Q11 | B | ddd | R 9/9, P 9/9 → R 8/9, P 8/8 | R 12/12, P 12/12 → R 11/12, P 11/11 | +0 / -1 |  |
| Q12 | B | layered | R 11/11, P 11/11 → R 9/11, P 9/9 | R 11/11, P 11/11 → R 9/11, P 9/9 | +0 / -2 |  |
| Q13 | B | nestjs | R 11/11, P 11/11 → R 11/11, P 11/11 | R 12/13, P 12/14 → R 12/13, P 12/13 | +0 / -1 |  |
| Q13 | C | nestjs | R 11/11, P 11/11 → R 10/11, P 10/68 | R 12/13, P 12/14 → R 11/13, P 11/71 | +0 / -0 |  |
| Q14 | B | ddd | R 9/9, P 9/9 → R 7/7, P 7/7 | R 12/12, P 12/12 → R 12/12, P 12/12 | +0 / -0 |  |
| Q15 | B | ddd | R 9/9, P 9/9 → R 8/8, P 8/8 | R 12/12, P 12/12 → R 12/12, P 12/12 | +0 / -0 |  |
| Q16 | B | ddd | R 9/9, P 9/9 → R 9/9, P 9/10 | R 12/12, P 12/12 → R 12/12, P 12/13 | +0 / -0 | +FF-S02 |
| Q17 | B | ddd | R 9/9, P 9/9 → R 9/9, P 9/10 | R 12/12, P 12/12 → R 12/12, P 12/13 | +1 / -0 |  |
| Q17 | C | ddd | R 9/9, P 9/9 → R 9/9, P 9/9 | R 12/12, P 12/12 → R 12/12, P 12/14 | +2 / -0 | +FF-DS03 |
| Q18 | B | ddd | R 9/9, P 9/9 → R 9/9, P 9/10 | R 12/12, P 12/12 → R 12/12, P 12/13 | +1 / -0 |  |
| Q19 | B | ddd | R 9/9, P 9/9 → R 8/9, P 8/8 | R 12/12, P 12/12 → R 11/12, P 11/11 | +0 / -1 |  |
| Q20 | B | clean-architecture | R 13/13, P 13/13 → R 13/13, P 13/16 | R 15/16, P 15/15 → R 15/16, P 15/18 | +3 / -0 |  |
| Q20 | B | layered | R 11/11, P 11/11 → R 11/11, P 11/16 | R 11/11, P 11/11 → R 11/11, P 11/16 | +5 / -0 |  |
| Q20 | B | nestjs | R 11/11, P 11/11 → R 11/11, P 11/15 | R 12/13, P 12/14 → R 12/13, P 12/18 | +4 / -0 |  |
| Q20 | B | ddd | R 9/9, P 9/9 → R 9/9, P 9/11 | R 12/12, P 12/12 → R 12/12, P 12/14 | +2 / -0 |  |
| Q21 | B | ddd | R 9/9, P 9/9 → R 10/10, P 10/10 | R 12/12, P 12/12 → R 12/12, P 12/12 | +0 / -0 |  |
| Q22 | B | nestjs | R 11/11, P 11/11 → R 11/11, P 11/11 | R 12/13, P 12/14 → R 12/13, P 12/13 | +0 / -1 |  |
| Q23 | B | (all) | no change | no change | +0 / -0 | |
| Q24 | B | clean-architecture | R 13/13, P 13/13 → R 13/13, P 13/13 | R 15/16, P 15/15 → R 15/16, P 15/15 | +2 / -0 |  |
| Q24 | B | nestjs | R 11/11, P 11/11 → R 11/11, P 11/11 | R 12/13, P 12/14 → R 12/13, P 12/14 | +2 / -0 |  |
| Q24 | B | hexagonal | R 13/13, P 13/13 → R 13/13, P 13/13 | R 16/16, P 16/16 → R 16/16, P 16/33 | +17 / -0 |  |
| Q25 | B | (all) | no change | no change | +0 / -0 | |

Reading the table:

- **Recall moves for two reasons.** It moves when a switch drops a row the manifest expects (Q2 B, Q3 B, Q6 B,
  Q9 C, Q11 B, Q12 B, Q19 B). It also moves when a tier switch moves an expected row out of, or into, the blocking
  pool: Q3 C, Q8 B, Q14 B, Q15 B (out); Q5 B, C, D and Q21 B (in).
- **Row counts.** Q1, Q13 C and Q16 B show `+0 / -0` because their rows come from the compiled template, not from
  the row stage. Q24 B's clean and nestjs rows are not compared (FF-S03 is outside those styles' scope), so their
  figures do not move.
- **Combined answers.** Answers interact (Q13 C with Q25 B, above; Q2 B with every rule that reads import edges).
  Preview the full set with `construct-rescore.ts --answers <file>` before the live run.

## Byte identity

- `tests/unit/construct-switches/rescore.test.ts`: with the switch default, the row stage leaves all 71 saved
  outputs of `after-member-facts` byte-identical to `raw/`. The re-score's `report.json` and `report.md` are
  byte-identical to `validate-reference.ts --from-raw` of the same directory, and `report.md` equals the live
  `after-member-facts/report.md` apart from its header line. The transforming path, forced at the status quo, gives
  the same figures.
- `tests/unit/construct-switches/compile.test.ts`: for every preset, `V13_COMPILE_OPTIONS` (with the switch default)
  compiles byte for byte as the v1.3 options without switches. The v1.2E compile (no options) does not read a switch.
- `tests/unit/apg-extractor/v12e-byte-identity.test.ts` passes unchanged: the extractor is not touched.
