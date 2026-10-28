# DDD violations and the paths that can detect them (v1.5)

Status: working reference, 2026-10-27; statuses updated after CAL-01 (`Docs/DiagnosticRuns/v15-cal01-2026-10-27.md`). "(dev)" = development evidence only; admission is CAL-02. Intended as the source of a thesis table (Kap6 or Kap9). Every status is
development evidence unless stated; the sealed DETECT-02 hold-out is scored only in the final study.

## 1. The five detection paths

| Path | What it reads | Built from | Strength | Limit |
|---|---|---|---|---|
| **Imports** | module dependencies | the TypeScript compiler's import resolution (APG `IMPORTS`) | exact (1.000 agreement with `tsc` on external repositories) | sees only which file uses which; nothing about behaviour |
| **Structure** | calls, write footprints, type references, guards, field state | the TypeScript type checker (ts-morph): `CALLS`, `WRITE_FOOTPRINT`, `RULE_SITE`, `CONTRACT_EXPOSES`, `PORT_MECHANISM`, `HOLDS_STATE_OF`, `INVARIANT_SITE` | follows calls through ports and adapters to the writes | static: misses dynamic dispatch, ORM cascades, config wiring |
| **Spec** | what the architecture is meant to be | the declared spec: layers, contexts and public APIs, aggregates, repositories, invariants | turns design intent into checkable facts | covers only what the spec author declared |
| **Neural** | meaning the code does not state | a model labels candidate nodes (for example `:BusinessRule`), never a verdict; Cypher decides | sees "this is a revenue rule" | non-deterministic; needs its own validity check before it carries a claim |
| **Runtime** | what actually happens | traces of a fixed scenario through the app (`experiments/puzzle-03/tools/runtime-trace.ts`, used by the P2 and P5 oracles) | sees real transaction scope and real cross-context changes | only exercised paths; needs a runnable app |

The neuro-symbolic division of labour: imports, structure and spec give facts; the neural path adds labels where
meaning is needed; the rule (Cypher) is always the decision.

## 2. The Pareto set for DDD

Seven rules account for every violation in our evidence: the 9 HEXDDD-01 hand-read cases and the traps of P1, P2,
P3r, P5 and P6. Rules 3–5 and 7 are Vernon's aggregate rules; rules 1, 2 and 6 are the boundaries around them.

1. Context boundaries: another context only through its published API or an ACL.
2. Domain purity and dependency direction.
3. One aggregate per transaction.
4. Other aggregates change by event, not synchronously.
5. Invariants live inside the aggregate.
6. Ports and published contracts are technology-neutral.
7. Reference other aggregates by identity.

## 3. The matrix

● main path · ◐ partial or confirming · — not applicable

| ID | Rule | Violation | Imports | Structure | Spec | Neural | Runtime | Rule today | Status (dev) | Evidence |
|---|---|---|---|---|---|---|---|---|---|---|
| K01 | 1 | importing another context's internals | ● | — | ● contexts, public API | — | — | frozen DDD import rules | covered | P2 trap |
| K02 | 2 | domain depends on infrastructure or a framework; layer skip | ● | ◐ type leaks | ● layers | — | — | FF-S01–S03, R-H5 | covered | P6 gate 5/5 |
| K03 | 3 | a command saves two aggregate instances | — | ● write footprint | ● aggregate roots | — | ◐ transaction scope | R-D4 | covered | P1 gate 5/5; HEXDDD 5, 8 |
| K04 | 3 | a repository method persists two aggregates | — | ● through the port | ● roots, repositories | — | ◐ | R-D4 | covered (called methods only, ruling B1) | HEXDDD 2; CAL-01 positives mislabelled |
| K05 | 4 | synchronous write into another context's aggregate | — | ● | ● contexts | — | ◐ | R-XCTX | covered | HEXDDD 5, 8; DRIFT-01 gate 3/3 |
| K06 | 4 | the same write moved into the composition root's facade | — | ◐ if the facade is a command | ● | — | ● | R-D4 / R-XCTX (facade as command, CN-01) | covered (dev) | CAL-01 2/2; P5 c07 now caught |
| K07 | 4 | remote call inside a transaction or lock | — | ● | ◐ | — | ◐ | R-RTX (in-tree scopes, remote ports, CN-01) | covered | HEXDDD S1 step 5; CAL-01 2/2 |
| K08 | 5 | single-instance rule decided outside the aggregate | — | ● guard on root state | ● roots | ◐ | — | R-D5 | covered | HEXDDD 6, 7 |
| K09 | 5 | the same rule duplicated outside and inside | — | ● | ● | — | — | R-D5 (duplicated flag) | covered | HEXDDD 6 |
| K10 | 5 | declared set invariant checked outside its owner | — | ● | ● invariants | ◐ | ◐ concurrency | R-D5S (owner-first, CN-01) | covered (dev) | unseen 4/6 before CN-01; CAL-01 2/2 after |
| K11 | 5 | in-process lock standing in for a boundary | — | ● lock around a write | ◐ | — | ● concurrency | R-LOCK (CN-01) | covered (dev) | CAL-01 2/2 |
| K12 | 5 | business calculation (no throw) in an application service | — | ◐ feature envy | ◐ | ● business-rule tag | — | R-D3 (CN-01) | covered (dev) | CAL-01 2/2; fires on the P2 trap |
| K13 | 6 | vendor, adapter or transaction types in a port | ◐ vendor imports | ● | ● ports | — | — | R-H5 (ports wherever they live, CN-01) | covered | P3r; HEXDDD 4; CAL-01 2/2 |
| K14 | 6 | entity exposed in a published contract | — | ● typed form | ● contracts | ● inlined display fields | — | R-D9 | partial | HEXDDD 9 |
| K15 | 6 | concrete adapter injected into the application | ◐ | ● | ● layers | — | — | R-INJ | covered (dev) | precision fixtures; CAL-01 2/2 |
| K16 | 7 | aggregate holds another aggregate object, not its id | — | ● field state | ● roots | — | — | R-REF (declared roots, CN-01) | covered (dev) | CAL-01 2/2 |

## 4. Coverage by path, on the 9 HEXDDD-01 cases

| Instrument | Paths | Caught | Note |
|---|---|---|---|
| v1.4 (frozen) | imports | 0 of 9 | the violations are in rules 3–6 |
| v1.5 study rules (D_v15) | imports + structure + spec | 3 of 9 | fitted: rules written on these trees |
| all DETECT-02 rules | imports + structure + spec | 7 of 9 | fitted; misses K11 (lock) and K12 (calculation) |

The two remaining cases need a path the study rules do not yet use: K11 needs structure plus runtime, and K12 needs a
neural tag.

## 5b. CAL-02 admission (sealed, scored once, 2026-10-27)

Admitted to the DDD confirmatory family (4/4 recall, 0/6 FP): **K01, K03, K05, K07, K14, K15, K16** (pooled 28/28,
Wilson LB ≈ 0.88). Not admitted (exploratory): K02 3/4, K04 0/4 (location mismatch), K06 0/4, K08 2/4, K09–K13 0/4.
Rows marked "covered (dev)" above that were not admitted were fitted to CAL-01 and did not carry to fresh cases.
Source: `Docs/DiagnosticRuns/v15-cal02-admission-2026-10-27.md`.

## 5c. CAL-03 admission (sealed, scored once, 2026-10-28; replaces 5b)

Admitted (4/4 recall, 0/6 FP): **K01, K02, K03, K05, K10, K13, K14, K15, K16** (pooled 36/36, Wilson LB ≈ 0.90; all 7
Pareto rules). Not admitted: K04 3/4, K06 1/4, K07 2/4 (admitted on CAL-02, lost here), K08 3/4 with 2 FP, K09 3/4
with 1 FP, K11 0/4, K12 1/4. Source: `Docs/DiagnosticRuns/v15-cal03-admission-2026-10-28.md`.

## 6. Hexagonal rows (HCAL-01, development)

| ID | Violation | Imports | Structure | Spec | Neural | Runtime | Rule today | Status (dev) |
|---|---|---|---|---|---|---|---|---|
| H01 | domain depends on application, adapters or a framework | ● | ◐ | ● layers, allowed dependencies | — | — | FF-S01, FF-S04, FF-P01 | covered |
| H02 | use case imports an adapter | ● | ◐ | ● | — | — | FF-S01, R-INJ | covered |
| H03 | adapter imports another adapter | ● | — | ● adapter layers | — | — | R-AXA | covered (dev) |
| H04 | vendor, adapter or persistence-handle type in an out-port | ◐ vendor imports | ● | ● ports | — | — | R-H5 | covered (dev) |
| H05 | use case constructs a concrete adapter | — | ● | ● | — | — | R-INJ | covered |
| H06 | business rules in an adapter | — | ◐ | — | ● business-rule tag | — | none | gap |
| H07 | transport concepts (HTTP codes, HTTP/SQL errors) in the core | — | ● | ● layers | ◐ | — | R-TRANSPORT | covered (dev) |

Source: `Docs/DiagnosticRuns/v15-hcal01-2026-10-27.md`.

## 5. Sources

- `Docs/DiagnosticRuns/drift-01-rescores-2026-10-23.md` (HEXDDD-01 coverage)
- `Docs/DiagnosticRuns/puzzle-04-2026-10-23.md`; `v15-answer-keys-r6-2026-10-26.md`
- `Docs/DiagnosticRuns/v15-d5s-unseen-2026-10-26.md`
- `ops/notes/v15-combined-delivery-design-2026-10-26.md`
