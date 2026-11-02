# H06 R-ADAPTER-RULE v1.5.7: development revision (2026-11-02)

Exploratory instrument work. Zero model calls, no Neo4j. **This is a development fit.** Every case set named below has
been read and the rule was tuned on it, so these numbers are not admission evidence. Admitting H06 needs a new blind,
sealed set built under the CN-04 procedure.

## What changed

The rule file (`src/v15-instrument/rules/r-adapter-rule-business-rule-in-adapter.cypher`) has a new dated header. The
Cypher query is the same. The change is in the `ADAPTER_DECIDES` fact (`src/v15-instrument/facts.ts`, section
"ADAPTER_DECIDES"). The v1.5.6 reading of domain-typed state runs first and is unchanged, so its findings read as
before. After it:

1. **Threshold.** A relational comparison (`<`, `<=`, `>`, `>=`) of a numeric value with a constant other than 0, 1
   or -1 counts as a decision even when the value is plain request or port data. The constant can be a literal, a
   constant expression (`30 * 86_400_000`), an UPPER_CASE const or a static readonly member. Not counted: values
   named as size, status, retry, paging, timing or position mechanisms (`length`, `status`, `attempts`, `pageSize`,
   `limit`, `*Ms`, `index`, ...), constants named for a mechanism (`*_MS`, `TIMEOUT`, `TTL`, `RETRY`, `PAGE_SIZE`,
   ...), and anything inside `typeof`, `isNaN`, `isInteger`, `parse*` or `test` (transport validation).
2. **Calendar.** A comparison of a Date's `get[UTC]Day/Hours/Month/Date()` with a constant, either directly or
   through a local const that holds it.
3. **One level down.** The rule also reads (a) the initializer of a local const that the condition names, for
   shapes 1 and 2 only (not inside callbacks, and not when the const is only tested for presence), and (b) the
   returned expression of an in-tree adapter function or method that the condition calls, for every reading.
4. **Nullable reads** (`order?.status`, `Tool | null`) are read without null and undefined (review hypothesis FN-2).
5. **Branch effects.** A numeric ternary arm other than 0, 1 or -1 is a price or rate (`tier === 'gold' ? 0.2 : 0`,
   review hypothesis FN-3). A string, boolean or enum literal arm counts only under a ranking condition (relational,
   threshold, calendar, or a call). A domain value made with its own operation (`invoice.amount.add(fee)`) counts as a
   computation. A code literal returned under an equality alone is a code mapping and is not reported, inbound or
   outbound. This covers a switch to column codes (review hypothesis FP-1).

## Correction to the brief

HCAL-05 has no H06 cases: it is the H11 round (`experiments/hcal-05/*/cases` holds only `H11-*`). The two blind
admission sets where H06 scored 0/4 are **HCAL-04**, which was scored with R-ADAPTER-RULE, and **HCAL-03**, which was
scored before the rule existed (H06 had no rule then). HCAL-01 and HCAL-02 also have H06 cases. All four sets are used
below.

## Cases: before and after

Records: `cases-before.json` and `cases-after.json`, from `run-cases.ts`. Each case is its domain's base with the case
overlaid, and the base is the baseline, as the admission scorer runs it.

| Set | Positives before | Positives after | FP on twins + legit + base before → after |
|---|---|---|---|
| HCAL-04 (radio-station, vet-clinic) | 0/4 | 4/4 | 0/6 → 0/6 (+ 2 bases clean) |
| HCAL-03 (museum-loans, solar-coop) | 3/4 | 4/4 | 0/6 → 0/6 (+ 2 bases clean) |
| **HCAL-03 + HCAL-04 (the 8)** | **3/8** | **8/8** | **0/8 twins → 0/8**, 0/4 legit → 0/4 |
| HCAL-02 (meters, recruitment) | 1/4 | 4/4 | 0/6 → 0/6 |
| HCAL-01 (subscriptions) | 0/2 | 2/2 | 0/3 → 0/3 |
| All 7 domains | 4/14 | 14/14 | twins 0/14 → 0/14, legit 0/7 → 0/7, bases 0/7 → 0/7 |

HCAL-03's 3/4 under "before" comes from the current v1.5.6 rule, which was developed with HCAL-03 as a development
check (CN-04). It is not the 0/4 recorded when HCAL-03 was scored.

Why each positive missed before, and what reads it now:

| Case | Shape | Before | After |
|---|---|---|---|
| HCAL-04 radio pos1 | controller: `dto.amountCents < 500` → 422 | DTO not domain-typed | threshold |
| HCAL-04 radio pos2 | gateway: `if (!isRoyaltyBearing(report))`, the helper reads `report.durationSeconds >= 30` | helper not followed | helper, domain read |
| HCAL-04 vet pos1 | controller: `startsAt.getUTCDay() === 0` → 422 | a Date, not domain state | calendar |
| HCAL-04 vet pos2 | gateway: helper `request.amountCents < MINIMUM_CLAIM_CENTS` on a port type | helper, port type | helper, threshold |
| HCAL-03 museum pos1 | controller: `days > 180` (computed from the body) → 422 | plain number | threshold |
| HCAL-02 meters pos1 | controller: `result.projectedKwh > 500 ? Math.round(...)`, `total > 15000 ? "high"` | port result type | threshold (+ ranked literal arm) |
| HCAL-02 meters pos2 | repository: `month === 11 \|\| month < 2`, month = `getMonth()` | a Date | calendar through a local const |
| HCAL-02 recruitment pos1 | controller: `yearsExperience < 2` → 422 | plain number | threshold |
| HCAL-01 subs pos1 | controller: `b.activeCount >= 5` → 422, `>= 3 ? Math.round(...*0.9)` | request body | threshold |
| HCAL-01 subs pos2 | repository: `overdue ? invoice.amount.add(...)`, overdue = `Date.now() - issuedAt > 30 * 86_400_000` | local const, `Money.add` not an effect | threshold through a local const, domain-value computation |

The twins that now stay clean are mostly transport checks: `typeof`, `Number.isInteger`, `Number.isNaN(getTime())`,
regex `test`, `.length === 0`, `daysInPeriod <= 0`. The others are the same rule placed in a domain policy, and error
translation in a catch clause.

Synthetic shapes (`tests/unit/v15-instrument/h06-adapter-rule.test.ts`, CN-04 tool-library fixture). Before: 0/6
positives found, and 1 of 7 hard clean twins was reported (the outbound enum-to-column switch, which confirms FP-1).
After: 6/6 found and 0/7 reported. The 7 clean twins: transport validation, string size, page size, vendor status and
timeout, a lookup callback followed by a presence test, a switch mapping, and a ternary code mapping.

## Hexagonal study trees (descriptive, not a gate)

Source: the kept trees on `origin/results/v15-hx-study`, 220 counted sessions. For each session the rule ran on the
seed (step 0) and on the final step, with the seed as baseline. Records: `study-before.json` and `study-after.json`,
from `evaluate.ts`. R-ADAPTER-RULE is not counted in that study.

| Arm | Sessions | Seed identities | New identities before | New identities after | Sessions with any new, before → after |
|---|---|---|---|---|---|
| none | 110 | 0 | 7 | 10 | 7 → 10 |
| combined | 110 | 0 | 0 | 0 | 0 → 0 |

- All 7 identities from before are unchanged: t02 `InMemoryHires.saveIfBoatFree`, which returns false on an overlap
  of `nights`.
- The 3 added identities are all t09 arm none (c062, c112, c218). In each, the vendor geocoding adapter rejects an
  address when `best.confidence >= MIN_CONFIDENCE` (0.8) fails. Whether that counts as an address-acceptance policy
  (H06) or as reading the vendor's own scale (translation) is not settled here. The oracle passed all three sessions.
- **Disclosure:** the study trees were also used for development. A first version of this revision reported 12 t11
  sessions (9 none, 3 combined), where an MQTT adapter does `const locker = list.find((l) => l.bay === bay); if
  (locker === undefined) throw ...`. That is a lookup and a presence test. It led to change 3a: shapes only, no
  callbacks, no presence tests. The same pass reported 1 t10 combined session (c145, `nowMs - fixedAt > MAX_AGE_MS`,
  a staleness check on a vendor rate), which led to the mechanism-named constant exclusion. So the counts above are
  not a clean held-out reading either.

**Counted Hexagonal rules unchanged.** R-AXA, R-COREIO, R-ENTITY-OUT, R-H5, R-INJ, R-LOCATOR, R-TRANSPORT and R-MIRROR2
were run on the final step of all 220 sessions (seed as baseline) with the old and the new `facts.ts`. Both runs gave
273 findings, and the sorted lists are byte-identical. This was expected: only R-ADAPTER-RULE reads `ADAPTER_DECIDES`,
and the change is local to that fact's section. The FF-* file rules do not read `facts.ts`.

## Limits

- **Development fit only.** Recall 14/14 and 0 FP are on sets this revision was built from. Admission needs a new
  blind sealed set.
- **Syntactic proxy for meaning.** "Threshold against a non-trivial constant" stands in for "business rule". It misses
  rules at 0 or 1 ("at least one item", "free if zero"). It also flags any non-mechanism numeric bound, for example a
  business-sounding limit that is really a transport cap but not named as one. Telling them apart in general is still
  the semantic layer's question (N2).
- **Mechanism names are a list.** A business constant named with a mechanism suffix (`GRACE_PERIOD_MS`) is missed. An
  unusual mechanism name is reported.
- **Mappings are judged by literal type.** A numeric code mapping (`case 'paid': return 1`) is still reported. A real
  decision that returns a string under an equality alone (`if (order.status === 'cancelled') return 'rejected'`) is
  now treated as a mapping and missed.
- **One level down only.** A helper that calls another helper, or a const built from another const, is not followed.
- **Vendor-scale thresholds** (the t09 confidence cut-off) are reported. Whether they belong to H06 needs a labelling
  decision.

## Files

- `run-cases.ts`: H06 cases of HCAL-01..04 → `cases-before.json`, `cases-after.json`
- `evaluate.ts`: Hexagonal study trees → `study-before.json`, `study-after.json`
- `tests/unit/v15-instrument/h06-adapter-rule.test.ts`: all H06 cases plus 13 synthetic positives and hard twins
