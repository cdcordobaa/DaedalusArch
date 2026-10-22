# HEXDDD-01 pilot results: how to do the blind hand read

Exploratory pilot, not Study 2b. Inputs: `experiments/pilot-hexddd-01/` (committed before any call). Design:
`ops/notes/hexddd-01-violation-elicitation-design.md` §5.3 (hand-read miss log).

The results are split so the hand read is blind to the instrument:

| Folder / file | Holds findings? | Open when |
|---|---|---|
| `diffs/<task>/step-NN.diff` | no | **first** |
| `hand-read-log.csv` | your entries only | while reading `diffs/` |
| `run/` | no (call ledger, smoke and probe verdicts, run and frame records) | any time |
| `counts.json` | counts only, no finding | any time (the run report quotes it) |
| `scores/` | **yes**: every blocking and advisory finding, D_seed, pass-bar evaluation | **only after** the log is complete |

## Procedure

1. Do not open `scores/` until step 4.
2. For each task (`s1-hotel-bookings` = Hexagonal seed, `s2-orders-invoices` = DDD seed) read `diffs/<task>/step-01.diff`
   to `step-05.diff` in order. Each diff is the tree after the step against the tree before it (step 1 against the
   seed). The seeds are in `experiments/pilot-hexddd-01/seeds/`; each carries one planted violation that never counts
   (S1: `RoomController` holds the in-memory room store; S2: billing's `IssueInvoice` imports ordering's `Order`).
   A copy of that pattern in another file does count.
3. For every place in a diff that you judge a violation of one of the families below, add one row to
   `hand-read-log.csv`:
   - `run`: `s1` or `s2`;
   - `step`: 1–5;
   - `file:line`: the file and the line in the **new** tree (the `+` side of the hunk);
   - `family`: one id, `H1`–`H7` or `D1`–`D11`;
   - `source sentence`: the P1–P4 sentence it breaks (paste one from the table below, or your own citation);
   - `notes`: free text (for example "copies the planted debt", "unsure").
   Write the row before looking at any instrument output for that step.
4. When both runs are logged, open `scores/`. For each log row, note in `notes` whether a finding matches
   (`match: <rule id>` or `no match`). Rows with no match are the instrument's construct gap (design §5.2, "separately
   recorded"). For pass-bar (b), confirm or reject each candidate in `scores/summary.json` → `runs[].advisoryB.candidates`.

## Families (design §3) and source sentences (design §1)

| Id | Family | Source |
|---|---|---|
| H1 | Domain imports a framework or ORM | P1 |
| H1b | Domain imports a vendor SDK (here `@paystream/node`, `sqlwell`) | P1 |
| H2 | Application imports an adapter (for example an HTTP error type, a header) | P1 |
| H3 | Adapter → adapter | P1 |
| H4 | Adapter with no port; use case on a concrete adapter | P1 |
| H5 | Port shaped by infrastructure (an ORM, SQL or HTTP type in a port signature) | P1 |
| H6 | Business logic in an adapter or controller | P1 |
| H7 | Cycles domain ⇄ infrastructure | P1 |
| D1 | Aggregate bypassed (outside code holds or changes an inner entity) | P4 |
| D2 | Repository for a non-root, or returning one | P4 |
| D3 | Anemic model / logic in application services | P2 |
| D4 | One transaction changes two aggregates | P4 |
| D5 | Invariant broken or checked outside the aggregate (setter, public field) | P4 |
| D6 | Bounded-context leakage (a context imports another's internals) | P3 |
| D7 | Shared kernel misused | P3 |
| D8 | Repository returning ORM entities | P4 |
| D9 | DTO/entity confusion at the boundary | P3 |
| D10 | One concept modelled twice; one rule duplicated across contexts | P3 |
| D11 | Domain events outside the domain | P4 |

Source sentences, as the design quotes them:

- **P1** Cockburn, *Hexagonal Architecture*: business logic "seeps into" UI and data code; each adapter talks to the
  application through a port.
- **P2** Fowler, *AnemicDomainModel*: "Bags of getters and setters" with the logic in services; the application layer
  stays thin (Evans).
- **P3** Fowler, *BoundedContext*: each context has its own model, with mappings between polysemic concepts.
- **P4** Vernon, *Effective Aggregate Design* I–II: "Model True Invariants In Consistency Boundaries", "Design Small
  Aggregates", modify one aggregate instance per transaction, "Use Eventual Consistency Outside the Boundary".

## What the scorer did (read after the log)

`experiments/pilot-hexddd-01/score-pilot.ts`, zero calls: each seed and step-final tree re-scored with the instrument
at main (`cypher-interp`, scoring v1.3, the signed construct switches), every blocking finding labelled by
check-correct, D_seed per `experiments/pilot-hexddd-01/pass-bar.md`. C1d and C4 were not run.
