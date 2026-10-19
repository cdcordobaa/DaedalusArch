# v1.4 Instrument-Alignment: Units of Work

**Depth:** minimal. Each unit maps to parts of [`ops/01-instrument-map.md`](../../../ops/01-instrument-map.md) and items of [`ops/03-build-list.md`](../../../ops/03-build-list.md). FR ids are from [`requirements.md`](requirements.md). Every unit ends in an unmerged PR; mock or dry-run only; `jest --maxWorkers=2`; no Neo4j (in-process interpreter `src/cypher-interp`).

## Units

| Unit | Scope | Map parts | FRs | Decisions | Design input | Likely code area |
|---|---|---|---|---|---|---|
| **U1** | Extractor fixes N33 (`paths` alias) and N38 (optional constructor parameters). **Already in progress in its own PR**; not planned here | C1a/b | FR-1 | D6 | `ops/03-build-list.md` P1 | `src/apg-extractor/` |
| **U2** | Two declared post-seal norm rules: a DDD dependency-cycle rule, and application purity (Q26). Each with an ADR, seeded tests and a deviation entry | C2 declared (feeds C3) | FR-2, FR-3 | D5, N3 | `ops/notes/ns-01-what-rules-cannot-see.md` §4a; `ops/decisions.md` | style libraries and presets, `src/fitness-compiler/` |
| **U3** | Semantic layer writes facts (A2 facts file) through the query layer; one-context fragmentation; vendor-neutral model route with a Gemini adapter (mock-tested); replace case-06 with a true K3 case and twin | C1d (A2), C1c | FR-4, FR-5, FR-6, FR-7 | N1, M4, N4, CDX | `ops/notes/ns-02-facts-contract-and-cases.md` | `src/apg-enrich/ontology/`, `scripts/v1.3/ontology-run.ts`, `tests/fixtures/v1.3-ontology/ns02/` |
| **U4** | Violation identity across commits as a reusable module; the drift metric D computed from snapshots | C1e, C5 | FR-8, FR-9 | M3 | `ops/notes/g08-violation-identity.md`; `ops/notes/s2d-01-study2-drift-design.md` §1; `ops/notes/rev-03-study2-drift-fable.md`; `scripts/v1.3/drift-descriptive.py` | `scripts/v1.3/lib/`, `scripts/lib/loop/pilot-metrics.ts` |
| **U5** | Evasion check for Study 2; Gemini generator adapter for the Study 2 harness. Dry-run only | C6 | FR-10, FR-11 | M6, CDX | `ops/01-instrument-map.md` §6 risk 3; `ops/notes/s2d-01-study2-drift-design.md` §5; REV-03 finding 5 | `scripts/lib/loop/` |
| **U6** | Detection recall fixes: options and ADR drafts for Q5 D, Q6 B, Q10 C + Q12 B, each tied to the 9 spec-manifest disagreements. **Design only** until the author adjudicates the 9 rows | C3 | FR-12 | (pending author adjudication) | `Docs/DiagnosticRuns/v1.3-blind-recall-gap-2026-10-18.md` | ADR drafts under `Docs/`; no rule change |
| **U7** | Meaning analysis script: κ (author vs rater) and meaningful precision, with intervals, tested on a synthetic answer sheet | C3m | FR-13 | D3; L4 open | `ops/notes/mean-01-codebook-and-sample.md` §4, §9 | `scripts/v1.3/meaning/` |
| **U8** | Efficiency test harness: driver (dry-run) and scorer for graph tools vs raw files | C1c efficiency | FR-14 | M5 | `ops/notes/eff-01-efficiency-design.md`; `experiments/eff-01/` | `scripts/v1.3/`, `experiments/eff-01/` |

## Dependencies

| Unit | Depends on | Why | Blocks |
|---|---|---|---|
| U1 | none | | the hold-out (outside this cycle) |
| U2 | none | | U3 (soft: Q26 turns the 12 framework-leak seeds into rule hits, so they leave the K3 set); Study 2 tiers |
| U3 | U2 (soft) | see above | the C1d 2-case pilot (outside this cycle) |
| U4 | none | | U5 (evasion counts identities); Study 2 primary outcome D |
| U5 | U4 | evasion counts are over U4 identities | Study 2 pre-registration |
| U6 | author adjudication of the 9 rows | the fixes must be judged against the adjudicated reference | the freeze |
| U7 | none to build; L4 to use | | the meaning labels (outside this cycle) |
| U8 | none | | the efficiency test run (needs the author's OK for 150 sessions) |

```
U1 ---------------------------------> hold-out       
U2 ---(soft)--> U3 -----------------> C1d pilot      
U4 -----------> U5 -----------------> Study 2        
U6 (after 9-row adjudication) ------> freeze         
U7 (L4 before use) -----------------> meaning labels 
U8 ---------------------------------> efficiency test
```

## Unit done criteria (common)

- Tests pass with `--maxWorkers=2` on the in-process interpreter; any Neo4j-only test is skipped and listed in the PR.
- New behaviour is off by default; reference results byte-identical unless a declared deviation (D5, N3) says otherwise.
- Saved neural artifacts carry model id, prompt hash and date.
- No live model call; adapters tested on mocks or recorded fixtures.
- The PR is opened, not merged.
