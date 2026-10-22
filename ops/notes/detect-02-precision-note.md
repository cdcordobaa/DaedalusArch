# DETECT-02 precision note: correct DDD patterns that look like violations

**Date:** 2026-10-22 (written 04:30Z, before any precision evaluation). **Status:** exploratory, zero model calls.
**Plan step:** V15-PLAN §1 (precision fixtures, a pass over real human DDD repositories, then the one-time held-out
check). **Branch:** `explore/detect-02-precision`. **Code:** `experiments/detect-02/` only. Nothing under `src/`,
`presets/`, `scripts/lib/`, `scripts/v1.3/`, the v1.4 tag or any registered Study 2b artefact changes.

## 1. Why

The DETECT-02 rules flag every PUZZLE-01 trap tree with no false positive on the dev set
(`experiments/detect-02/results/dev.json`). The dev negatives are puzzle clean solutions and agent trees, which use
few of the patterns a careful DDD codebase uses. Several correct patterns write more than one thing in one command, or
touch another context, and could look like R-D4 or R-XCTX violations to a rule that counts writes. A false positive in
a tool arm tells an agent to undo correct code, so precision is checked first, on purpose-built fixtures and on real
human repositories, before the held-out run.

## 2. The patterns, what each rule should do, and the prediction

Every fixture is a minimal TypeScript tree with a DDD spec (contexts, layers, aggregates declared). Each is run twice:
**declared** (the spec as written) and **fallback** (the same spec with `aggregates` removed, so roots are inferred;
this is the condition of the human repositories, which declare no aggregates). Predictions are for the code as it
stands at `origin/main` 07712e255.

| # | Pattern (legitimate) | What the rules should do | Prediction, declared | Prediction, fallback | Positive twin |
|---|---|---|---|---|---|
| P1 | Outbox record written with the aggregate, in the same transaction (repository stores events with the row; an `Outbox.add(event)` call inside a no-argument transaction runner) | Quiet: an event is not an aggregate | quiet (event types are not roots; `Outbox` is a messaging owner) | quiet | — (the outbox is the fix of R-D4) |
| P2 | Event-store append (event-sourced repository; a command appends the root's events to a stream) | Quiet | quiet | quiet | — |
| P3 | Audit record and idempotency record next to the aggregate save | Quiet: records are not aggregates | quiet (records are not declared) | **R-D4 false positive**: an `AuditEntry` with an `id` in the domain, taken by a store method, is inferred as a root | — |
| P4 | One aggregate saved twice in one command (save, change, save again; save through a private helper) | Quiet: one instance | quiet (same binding) | quiet | two different instances of the same root saved: R-D4 |
| P5 | Child entities mistaken for aggregates (an `OrderLine` with an `id`, saved by the root's repository implementation) | Quiet | quiet (inner entity, not a root) | quiet (the repository port takes only the root) | the command also saves a second aggregate: R-D4 |
| P6 | Declared batch command (one command imports many aggregates, declared in `detect02.allow.yaml`) | Reported as `allowed`, not as a violation | allowed | allowed | the same batch without the declaration: R-D4 (expected, the exception is undeclared) |
| P7 | Saga / process manager updating its own state on an event and sending the next command through a bus | Quiet | quiet (event handler; the bus is a messaging owner) | quiet | a plain command (not an event handler) that saves the saga state and another aggregate: R-D4 |
| P8 | Read-only cross-context query (sales reads a member card through membership's published module) | Quiet | quiet (no write) | quiet | the command calls membership's published write: R-XCTX and R-D4 |
| P9 | Anti-corruption translation (an ACL adapter behind a port that takes the root, translates it to a vendor shape and returns a decision; the command then saves a different root) | Quiet: the port call is a query, not a write | **R-D4 false positive**: a port method with a root-typed parameter counts as a sink whatever it does | **R-D4 false positive** (same) | the ACL port writes the other root (a `void` store into another aggregate's repository): R-D4 |
| P10 | Shared-kernel types (`Money`, a `CustomerRef { id }` used by two contexts in reads) | Quiet | quiet | **possible false positive**: a shared-kernel type with an `id` taken by a finder method is inferred as a root and the finder counted as a sink | — |

Other rules on these fixtures (R-D5, R-D9, R-H5, R-INJ, R-RTX): predicted quiet everywhere. Two design limits are
stated in advance and are not counted as false positives:
- A unit-of-work port that hands repositories to a callback (`uow.run((repos) => …)`) is an R-H5 scope mechanism by the
  rule's own definition. The fixtures use a no-argument transaction runner instead; a UoW port that hands
  repositories is not one of the patterns tested here.
- R-D4 exempts every domain-event handler. A handler that writes two aggregates is therefore not flagged (a recall gap,
  not a precision one); the saga twin is a plain command so that the rule can be tested at all.

## 3. Pass bars

1. **Fixtures:** 0 false positives on the legitimate trees, in both the declared and the fallback condition; the
   declared batch reported `allowed`; every positive twin flagged by the expected rule.
2. **Human DDD repositories:** every hit hand-read (true / false / unclear, with file:line). Pass = 0 hits read as false.
   An `unclear` hit is reported, never counted as a pass.
3. **Held-out (one time, after 1 and 2 are committed):** reported per family (TP / FP / FN), twin discrimination and
   negative-control false positives, **whatever they are**. No rule or fact changes after the held-out outputs are
   seen. The sealed manifest hash is checked before the run; a mismatch stops it.

## 4. Revision policy

If a predicted false positive appears, the fix goes into the facts (`experiments/detect-02/lib/`) as a concept (a sink
taxonomy by type or structure, never by name), is logged below as a dated revision **before the held-out run**, and
the dev set is re-run to show the 19/19 trap trees and the 0 dev false positives still hold.

## 5. Revisions

### R1, 2026-10-22: a write goes to the store of the root (sink taxonomy by structure)

**Seen on the fixtures (before R1, `results/precision-before.json`):** 4 false-positive runs of 20 legit runs, all
R-D4 and all predicted in §2: P3 fallback (the `AuditEntry` record counted as an aggregate), P9 declared and
fallback (the ACL question `CreditCheck.assess(customer, amount)` counted as a write of the Customer), and P10
fallback (finders that take the shared-kernel `CustomerRef` counted as writes of it). All 12 positive-twin runs were
flagged.

**Cause.** A sink was any storage-owner method with a root-typed parameter. A port that only *takes* a root (to ask a
question, to append a record that mentions it, or to find by a reference) was a write of that root.

**Change (`lib/facts.ts`).** A call writes root `T` only when its owner is a **store of `T`**: the owner (or an
interface it extends) has a method that returns a single `T` (`T`, `T | undefined`, `Promise<T | null>`; not a
collection), that is, it loads `T` by identity as a repository does. An owner that a spec `repositories` glob
declares and that loads no root keeps its old meaning (a declared, write-only repository). External-module calls with
a root argument (ORM and SDK writes) are unchanged. The test is by type and structure, never by name. Root inference
(fallback) is unchanged, so `AuditEntry` and `CustomerRef` are still listed as inferred roots; they are no longer
written by anything.

**Amendment R1b (same day, before any human-repository or held-out run).** The first form of R1 dropped one dev
case: HEXDDD-01 case 2 (`saveAudited(booking, entries)`, the Booking repository writing identity-bearing audit entries
in the same call), on 3 pilot step trees and its DETECT-01 positive fixture. The hand read labels that case D4 when
the audit record is its own aggregate. So a second structural prong is added: a method that **returns nothing** on an
owner that stores some root (a write method of a repository) writes every root it is handed. A question port
(returns a decision), an append-only log (stores no single root) and a finder (returns a collection) still write
nothing. This keeps P3 legitimate (a separate audit port) and case 2 a violation (the aggregate's repository
persisting a second identity-bearing record). Whether an audit record is an aggregate stays a declaration question:
with a declared spec it is not a root unless declared.

**Check.** The fixtures and the dev set are re-run after R1 (results below, §6).

## 6. Results after R1 (dev material; written before the human-repository pass)

- **Fixtures** (`experiments/detect-02/results/precision.json`): 0 false-positive runs of 20 legit runs (10 patterns
  × declared/fallback); the declared batch reported `allowed` in both conditions; 12/12 positive-twin runs flagged by
  the expected rule (R-D4; P8 also R-XCTX). Before R1 the same fixtures gave 4 false-positive runs
  (`results/precision-before.json`), each one predicted in §2.
- **Dev set** (`results/dev.json`, 91 trees): identical to before R1, tree by tree. D4 33/0/0, D5 11/0/5, D9 3/0/0,
  H5 4/0/0 (TP/FP/FN); 54 of 62 labelled cases hit, as before. R1 only removes sinks, so it cannot add a finding on
  any guard set (the 520 Layered trees were not re-run).
- **Observed, not changed (recall, not precision):** a loop that saves a newly created root per element of a
  non-root collection (`for (const row of rows) save(Customer.register(row))`) is counted as one instance, because the
  loop is not over a root collection. P6 uses the `saveAll(rows.map(…))` form, which is counted as many.
