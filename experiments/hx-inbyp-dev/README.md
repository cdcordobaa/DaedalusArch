# R-INBYP development check (2026-11-02, instrument v1.5.7, exploratory)

Queue item 14. The Hexagonal study's §4 hand read (`Docs/DiagnosticRuns/v15-hx-study-2026-11-02.md`) found 2 of 110
blocks (t11, c134 and c163) where a counted R-AXA finding was hidden rather than fixed. The new MQTT adapter kept its
bypass of the use case but swapped the import of the adapter `MemoryLockers` for the out-port `Lockers`. R-AXA matches
only adapter-to-adapter imports, so it could not see this.

**Rule.** `src/v15-instrument/rules/r-inbyp-driving-adapter-uses-out-port.cypher`: a file of a driving adapter package
(`adapters/in|inbound/<x>`) imports a driven port, by a value import or a type import. A port counts as driven when
either holds:
- its folder says so (`ports/out|outbound|driven|secondary/`);
- a driven adapter package imports it.

The rule is on no row, so the scorer does not count it and the hub does not deliver it. The registered study and its
rule list are unchanged.

**Message change.** For a driving importer, R-AXA's fix text no longer offers "depend on the port that `<target>`
implements (outbound)". That option is what the t11 agents took. Driven importers keep the old text.

**Result on the study's kept trees** (`evaluate.ts`, zero calls; seed and final step of all 220 counted sessions;
`result.json`):

| | sessions with a new R-INBYP identity | identities |
|---|---|---|
| seeds (11 tasks) | 0 | 0 |
| `none`, all tasks | 0 of 110 | 0 |
| `combined`, t01–t10 | 0 of 100 | 0 |
| `combined`, t11 | 5 of 10 | 13 |

Under `combined` in t11, R-INBYP agrees with the task's trap check in all 10 sessions. It fires in the 5 sessions where
the trap persisted (c006, c042, c090, c134, c163) and in none of the 5 where the trap was gone. The details:
- c090, c134 and c163 carry the MQTT bypass (`src/adapters/in/mqtt -> src/application/ports/out/Lockers.ts`).
- All five carry the seed's `ManagerRoutes.ts`, retyped from adapters to out-ports (`Lockers`, plus `LockerDoors`,
  `DoorLatch` or `Doors`).
- Under `none` the same bypasses stay in their adapter-to-adapter form, which R-AXA counts.

So the hand read's "not seen by a counted rule" for c006 and c042 stays true, because R-INBYP is not counted, but the
new rule sees them.

**Limits.**
- The rule was written after seeing these trees, so this table is a development fit, not admission evidence.
- Admission needs a blind sealed set with positives and clean twins, the same bar as HCAL-07.
- The tool-library fixture `tests/fixtures/v15-cn04/cases/adapter-rule-clean2` is clean for H06 but has a controller
  that reads through the out-port `ToolRepository`. R-INBYP reports it, as it should under this construct.
