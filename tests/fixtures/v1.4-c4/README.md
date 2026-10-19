# v1.4 C4 seeded interpretation cases (U9 scaffold)

The case set of `ops/notes/c4-01-interpretation-design.md` §6: six small TypeScript projects, each with exactly one
**target** blocking finding, plus six **twins** that keep the code and change only the prose. Every twin is
exception-negative, so any exception claim on a twin is false. `set.json` indexes the pairs and holds the SHA-256 of
every manifest (`expected-c4.json`); a unit test checks the hashes.

| Pair | Case (exception expected unless noted) | Twin (no exception) | Rule, spec | Tests |
|---|---|---|---|---|
| 1 | `c4-01-adr-permits-read-skip`: ADR-0004 (Accepted) lets controllers query read repositories | `c4-01t-no-adr` | FF-S03, `presets/layered.yaml` | an ADR that permits an import |
| 2 | `c4-02-legacy-exception`: `docs/legacy-exceptions.md` row with an end date, and a `// LEGACY:` comment | `c4-02t-no-legacy-record` | FF-DT04, `presets/ddd.yaml` | a documented legacy exception |
| 3 | `c4-03-shared-kernel`: the context map declares `Money` a shared kernel | `c4-03t-translate-through-acl`: "Money is not shared ... must translate" | FF-DS02, `presets/ddd.yaml` | a near-miss doc (built so the keyword baseline fails) |
| 4 | `c4-04-accepted-adr`: ADR-0002 (Accepted) permits a core-to-adapter import | `c4-04t-superseded-adr`: ADR-0002 Superseded by ADR-0009, which forbids it | FF-S04, `presets/hexagonal.yaml` | ADR status, not only text (built so the keyword baseline fails) |
| 5 | `c4-05-intent-contradicted`: README forbids skipping; **no** exception, intent contradicted, severity high | `c4-05t-readme-silent` | FF-S03, `presets/layered.yaml` | intent match without any permission |
| 6 | `c4-06-sem-documented`: the NS-02 case-02 code plus ADR-0003, a preview discount on purpose | `c4-06t-ns02-case-02` = `tests/fixtures/v1.3-ontology/case-02-misplaced-pricing`, unchanged | SEM-MISPLACED (A2 facts) | a SEM finding read with A2 facts |

Deviations from the C4-01 table, all visible in the manifests: pair 3 uses the DDD preset's contexts (`ordering`,
`billing`) instead of `sales`, `billing`; every C3 target was checked to fire on `cypher-interp` (no Neo4j) by
`tests/unit/apg-enrich/ontology/c4-cases.test.ts`, and pairs 1 to 5 carry no other blocking finding except
FF-S01 and FF-P06 beside the FF-S04 target in pair 4 (at most two others, as C4-01 allows).

## Who wrote what

| Rows | Written by | Meets C4-01 §6 "a separate session that never runs or scores C4"? |
|---|---|---|
| Pairs 1 to 6 (code, docs, manifests) | **Author/Claude-written**: the BUILD-S cloud routine session, 2026-10-19 (pair 6's twin code: the NS-02 session, 2026-10-18) | **No.** The same session wrote the C4 runner. No C4 call was made. The author reads and signs each manifest (`authorship.signedByAuthor`), or a separate session rewrites them, before any C4 call. |
| X1, X2 | **To be filled, non-author**: real external findings whose own docs mention the site (selection rule in `set.json`) | yes, when filled as specified |
| X3 | **To be filled, non-author**: a Gemini-written pair from the brief below | yes, when filled as specified |

The non-author row is scored separately and never pooled with the six (C4-01 §6.1).

### The fixed X3 brief (give it to the Gemini session verbatim)

> Write a small TypeScript project (5 to 8 files) in the Hexagonal style: `src/domain/**`, `src/application/**`,
> `src/adapters/inbound/**`, `src/adapters/outbound/**`. Plant exactly one import from the domain into an outbound
> adapter. Add an ADR under `docs/adr/` that permits that import, with its status and a reason. Then write a twin:
> the identical code, with the ADR changed so that it does not permit the import. For both, write
> `expected-c4.json` with: whether an exception is granted, the file and line range of the granting sentence, whether
> the code contradicts, is consistent with, or is not covered by the declared intent, and the allowed severity
> (high, medium, low). Do not run any tool on the code.

## Mock answers

There are no hand-written C4 mock answers. `--provider mock` uses `c4MockResponder`, a scripted stand-in (NOT model
output) that answers what the zero-call keyword baseline says. Its results show the pipeline end to end at 0 model
calls; they are not a C4 result.
