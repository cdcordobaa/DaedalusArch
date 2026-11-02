# v1.5 rule set: independent adversarial review (2026-11-02)

Queue item 10. A reviewer with no part in writing the rules read the v1.5 rules (`src/v15-instrument/rules/*.cypher`)
and the code they rely on: `facts.ts`, `graph.ts`, `spec.ts`, `vendor-lexicon.ts`, `consistency.ts` and
`src/apg-enrich/cheap/{behaviour,guards}.ts`. It looked for false negatives (FN), false positives (FP) and identity
problems. The reviewer was a Fable model, worked read-only and made no model calls on the rules. It did not open
sealed or held-out sets. **CONFIRMED** means the reviewer traced the claim through the code. **PLAUSIBLE** means it
still needs a fixture. Line numbers refer to `main` at `7a9eb3737`. No finding has been reproduced on a fixture yet.

## Findings, most severe first

| # | Rule(s) | Kind | Shape (short) | Evidence | Verdict |
|---|---|---|---|---|---|
| 1 | R-D4, R-XCTX | FN | Partial writes by id (`orders.updateStatus(orderId, …)`), or saving a mapped row, are not sinks | `facts.ts:453-462` `isSink` needs a root-typed parameter; id types excluded (347-359) | CONFIRMED |
| 2 | R-D4 | FN | A loop over ids that loads and saves one root N times counts as one instance | `facts.ts:510-518` loops must iterate a collection *of roots*; `graph.ts:185` | CONFIRMED |
| 3 | R-AXA, R-ENTITY-OUT | FN | Adapter scope comes from a folder regex, not the spec's layers (`src/http`, `src/infrastructure/http`, `src/adapters/Flat.ts` unseen) | `facts.ts:1238` `ADAPTER_PKG`, `1505` `INBOUND` | CONFIRMED |
| 4 | R-ENTITY-OUT | FN | Inline route callbacks and exported arrow handlers are not handlers (`router.get(…, async (req,res) => res.json(order))`) | `facts.ts:1523-1530` classes' methods and exported functions only | CONFIRMED |
| 5 | R-AXA | FN | Re-exports, barrels and `import()` are not edges; an `export … from` in a shared folder launders an in→out edge through the shared-helper exemption | `facts.ts:1254-1267` reads `getImportDeclarations()` only; rule line 12 | CONFIRMED |
| 6 | R-INJ | FN | Functional use cases (no class), and port-shaped interfaces declared in adapter folders | `facts.ts:1158-1161` | CONFIRMED |
| 7 | R-INJ (also R-AXA, R-LOCATOR) | FP | Every spec layer that is neither domain, application nor composition gets role `adapter`, e.g. a `shared` layer | `spec.ts:114-120` | CONFIRMED (depends on spec) |
| 8 | R-COREIO, R-PURE | FP / FN | `import { type Pool } from 'pg'` is flagged; `import pg = require('pg')` is unseen by R-PURE; catalogue gaps (`postgres`, `kysely`, `@supabase/*`, `fs-extra`, `ky`, …) | `facts.ts:1329-1330`, `1479`; `behaviour.ts:18-25` | CONFIRMED |
| 9 | R-H5 | FP | Utility libraries (`neverthrow`, `decimal.js`, `luxon`) and Node builtins in a port signature count as vendor types | `facts.ts:613-639` | CONFIRMED (libraries); PLAUSIBLE (`Buffer`, `URL`) |
| 10 | R-D4, R-XCTX | FN | Units on owners matching `MESSAGING_OWNER` (e.g. `*Dispatcher`) and handlers called directly are dropped; string-keyed dispatch; depth > 4 | `facts.ts:117`, `565`, `697`, `30`; `277-285` | CONFIRMED |
| 11 | R-TRANSPORT | FN / FP | A positional `404`, a `{ NotFound: 404 }` table, Nest `NotFoundException` are unseen; a domain `ReservationStatusCode` class fires | `facts.ts:1339-1368`; `behaviour.ts:24` | CONFIRMED |
| 12 | R-LOCK | FP | Substring regex: `isBlocked()`, `serialize()` read as locks | `facts.ts:982-1000` | CONFIRMED |
| 13 | R-RTX | FN / FP | Imperative `BEGIN … COMMIT` and free `withTransaction()` are not scopes; a `ClockProvider` counts as a remote | `facts.ts:670-677`, `120`, `1223` | CONFIRMED |
| 14 | R-ADAPTER-RULE | FP / FN | Outbound enum→column mappers fire; `maybeOrder?.status` reads (union with `undefined`) and ternary pricing are missed | `facts.ts:1569`, `1649-1687` | CONFIRMED |
| 15 | R-LOCATOR | FN | `container.cradle.x`, `getOrThrow`, `app.get(TOKEN)`, module singletons imported from an adapter | `facts.ts:1382-1405` | CONFIRMED |
| 16 | R-D4R | FN | `saveAll(): Promise<Order[]>` (not void); a batch wrapper type holding roots | `facts.ts:1307-1309`, `139-152`, `759-763` | CONFIRMED |
| 17 | R-D9 | FN | `export * from './domain/order/Order'` from a published file | `facts.ts:1127` named exports only | CONFIRMED |
| 18 | R-XCTX | FN | A command outside every declared context root writes two contexts: R-D4 yes, R-XCTX never | `graph.ts:190`; `spec.ts:129-136` | CONFIRMED |
| 19 | R-D5S | FP | Filter loops (`continue`) and value-object guards that share two invariant terms | `facts.ts:928-964` | CONFIRMED |
| 20 | R-D5, R-D5S | FN | A guard block with more than a throw; `switch` cases that throw | `guards.ts:47-50`; `facts.ts:721`, `757`, `933` | CONFIRMED |
| 21 | R-MIRROR, R-MIRROR2 | FP | `[field-set]` has no generic-name filter (a core `Address` matches a vendor address); a core literal equal to a vendor declaration name; numeric vendor codes never tokenised | rule lines 10-11, 25-30; `vendor-lexicon.ts:84-105`, `183`, `277` | CONFIRMED (Address); PLAUSIBLE (decl name) |
| 22 | identity (several) | identity | File-keyed subjects (R-TRANSPORT, R-COREIO, R-LOCATOR, R-PURE); R-AXA keys on the target path (a rename makes a new identity); R-D4 instance keys are expression text (`order!` vs `order`); one copied type gives N + 2 identities; R-H5 and R-COREIO double-count one import | rule `RETURN` lines; `consistency.ts:141`; `facts.ts:499-506`, `617`, `1477` | CONFIRMED |
| 23 | R-D3 | FN | Arithmetic in a same-file helper; value-object arithmetic (`Money.plus`) | `facts.ts:1047-1057` | CONFIRMED (helper); PLAUSIBLE (value objects) |
| 24 | R-TRANSPORT vs R-COREIO | consistency | One rule counts type-only imports, the other does not | `facts.ts:1371-1374` vs `1330`, `1479` | CONFIRMED |

The reviewer's own summary of the weakest areas:
- Writes are recognised only when a root-typed value reaches a sink (#1, #2, #10, #16).
- Scope is bound by folder regexes, not by the spec (#3, #4, #7).
- Import facts read only `ImportDeclaration`s (#5, #8, #17).
- Name regexes do the deciding (#9, #11–#13).
- Identities are coarse or text-based (#22).

## What this means for the registered results

The registered outcomes count only new identities against the seed, in both arms, with the same rules.

**Missed shapes (FN).** A missed shape lowers D in both arms. It biases the contrast only if the treatment pushes
agents into the shapes the rules miss. The Hexagonal hand read found exactly one such case: the out-port bypass in t11,
2 of 110 blocks (R-INBYP, PR 476). The trap check is independent of the rules, so a bias of this kind would show up as
"D fell, trap persisted". The registered §4 hand read of the 8 such blocks found no shape from this review other than
that one.

**False positives (FP).** A false positive raises D in both arms. Under `combined` the hub also pushes the false
finding to the agent, which may then change code that was correct. The trap rate (87 → 12 of 110) and acceptance (103
vs 105) do not depend on the rules.

**Identity (#22).** This is the review's most relevant point for D. D can move without the architecture changing, for
example when a file is split, a target renamed or a `!` added. The registered evasion read and the trap rate are the
checks on it. The final study and the Hexagonal study both found 0 evasion candidates.

**DDD final study (H1).** R-D4 and R-XCTX are the DDD core. #1, #2, #10 and #18 mean the DDD `none` arm's ΣD of 85 is
a lower bound on multi-aggregate writes. They do not explain a fall to 0 under `combined`, because the trap rate fell
too (23/36 → 1/36).

None of this changes a registered number. It belongs in the threats to validity (Kap8/Kap9), stated as instrument
limits.

## Actions

| Findings | Action |
|---|---|
| #14 (R-ADAPTER-RULE), #21 (R-MIRROR2 field shapes) | Passed to the H06 and H11-d development agents (queue items 6 and 5) |
| #19, #20 (R-D5S, R-D5) | Input for queue item 7 (R-D5S) |
| #3, #5, #8, #17 (import and scope facts) | Proposed v1.5.8 fact work: spec-derived adapter packages; export-from, `import =`, `import()` and inline `type` modifiers. Every change needs the dev regression and a fresh blind admission before it is counted |
| #22 (identity) | Threats to validity; any identity change would alter D and needs its own registration |
| Others | Recorded here; fixtures to confirm before any change |
