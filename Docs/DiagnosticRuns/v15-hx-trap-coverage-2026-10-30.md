# HX-COVERAGE: how many agent trap failures the Hexagonal study's counted rules see (v1.5.5, zero calls)

**Result: the candidate counted set sees 16 of the 19 agent trap failures that have kept trees, 0.84 [0.62, 0.95]
(Wilson 95 %).** R-MIRROR2 accounts for most of this: without it, rows H01–H10 alone see 4 of 19, 0.21 [0.09, 0.43].
The three misses are the transport detail passed positionally into a core error (p6 L2, 2 runs) and a lower-cased
one-to-one copy of the vendor's statuses (p3 L3, 1 run). On the 43 trees that passed the oracle, a counted rule reports
something new in 5 (0.12 [0.05, 0.25]). All 5 are R-MIRROR2 findings. A hand read leaves 3 of them as false positives
(0.07 [0.02, 0.19]) and finds that the other 2 are vendor field names the oracle does not look for. Rows H01–H10 report
nothing on any clean tree (0 of 43).

The scorer on `main` now has two ways of counting R-MIRROR2 (PR 452, `hxCounted`). Option (ii) counts every shape
word; the figures above are option (ii). The default, option (i), counts only `[literal]` and `[error]`. Under option
(i), coverage is 14 of 19, 0.74 [0.51, 0.88], and 1 of 43 clean trees has a counted finding, 0.02 [0.00, 0.12]. That
one is the lever-(e) false positive.

The study set's own reference solutions (`experiments/hx-study-set/`, which merged while this ran) give 6 of 9 traps
seen after the hand read. The three misses are one generic-word vendor literal task and both renamed-copy tasks. One
of the 9 clean references has a counted finding (§8).

This is exploratory input for the draft Hexagonal pre-registration (draft PR 451, power section, q). It is not study
data, and it changes nothing frozen.

- **Script:** `experiments/hx-coverage/coverage.ts` (zero calls; `DAEDALUS_MIRROR_SEM=off`). Record:
  `results/v1.5-hx-coverage/coverage.json` (one row per session, every new finding on the final tree with its rule,
  file, subject and R-MIRROR2 shape word, plus the oracle's evidence lines).
- **Scorer:** `experiments/v15-study/score-study.ts` `scoreSessionSteps`, unchanged. It runs the v1.5 rules with step-00
  as the baseline, the frozen file rules, and the task's tests and oracle on every step. R-MIRROR2's shape word is read
  from one more `scoreTreeV15` run on the final scored copy, because the scorer's `Hit` drops the evidence.
- **Rules root verified before scoring:** `(cd src/v15-instrument && shasum -a 256 -c ../../experiments/hcal-07/RULES-FROZEN.sha256)`
  passes on all 45 files. Root `098d67bd4fdc97c5` (the first 16 hex of the sha256 of the manifest) matches. `main`
  `3011ce082` has 44 tracked non-test instrument files plus `experiments/cal-01/score.ts`, the same list. Instrument
  `v1.5.5-hx-rules-v3`.
- **Date:** 2026-10-30, local. First run from `origin/main` `3011ce082`. Final run (the figures here and in
  `coverage.json`) on this branch merged with `main` `2bd8790ee` (PR 452's scorer with `Hit.shape` and `hxCounted`;
  PRs 449 and 450's study set). The rules root was verified again at that head: 45 of 45 OK. The agent-tree results of
  the two runs are identical.

## 1. Inputs

| Source | Trees | Trap failures (oracle, final tree) | Clean (oracle passes) |
|---|---|---|---|
| `results/v1.5-pilot-ladder/` (TRAP-PILOT-v2 ladder, 36 sessions) | committed step snapshots | 11 | 25 |
| `results/v1.5-traprate-01/`, Hexagonal sessions (26) | rebuilt from the committed seed and step diffs (`restoreSession`); 104 of 104 trees matched the driver's recorded tree hash | 8 | 18 |
| First final study, lane B (`results/v15-lane-b`) | **none kept**: the branch holds `run/sessions/*.json`, hub ledgers and scores only (DEV-2), so nothing could be scored | – | – |
| `experiments/hx-study-set/` parts A and B, reference trap and clean solutions (9 tasks) | each scored as a one-step session (step-00 = seed, step-01 = the reference); PRs 449 and 450 merged during this work | 9 | 9 |

The scorer reproduced every oracle verdict on the final tree: 11 and 8 trap failures, the same sessions as
`pilot-scores.json` and TRAPRATE-01's `sessions.json`.

## 2. Rule groups

- **Counted (candidate):** the rule ids of rows H01 H02 H03 H04 H05 H07 H08 H09 H10, without FF-S03 and FF-P02, plus
  R-MIRROR2. That gives FF-P01, FF-P03, FF-S01, FF-S04, R-AXA, R-COREIO, R-ENTITY-OUT, R-H5, R-INJ, R-LOCATOR, R-MIRROR2
  and R-TRANSPORT. FF-S03 and FF-P02 are advisory in the draft. They did not fire on any tree here, so including them
  would change nothing.
- **Reported separately, not counted:** R-MIRROR (status open, B3) and R-MIRROR-SEM. R-MIRROR-SEM needs the judge, which
  was off here, so it could not fire.
- **Two counting options for R-MIRROR2** (scorer `hxCounted`, PR 452): (ii) every shape word; (i), the draft's
  default, `[literal]` and `[error]` only.
- **"Seen":** a counted identity that is new against the seed on the final tree, in a file the oracle names in its
  failing evidence. Every row was then hand-read against the oracle evidence.

## 3. Per trap failure

| Source | Session | Task | Trap (oracle evidence, short) | Counted rule on the trap (shape word) | R-MIRROR | Seen |
|---|---|---|---|---|---|---|
| pilot | c033 | p1 L2 | service compares vendor value `requires_capture` | R-MIRROR2 `[literal]` | – | yes |
| pilot | c016 | p1 L3 | service compares `requires_action`, `requires_capture`, `canceled` | R-MIRROR2 `[literal]` ×2 | 1 (port in) | yes |
| pilot | c035 | p1 L3 | same as c016 | R-MIRROR2 `[literal]` ×2 | 1 (port in) | yes |
| pilot | c008 | p4 L2 | service holds `SLOT_TAKEN`, `RATE_LIMITED`; core error carries `retryAfterSec` | R-MIRROR2 `[error]` ×2, `[field]` ×1 | – | yes |
| pilot | c012 | p4 L3 | service holds `SLOT_TAKEN`, `RATE_LIMITED`, `CALENDAR_LOCKED`; `retryAfterSec` | R-MIRROR2 `[error]` ×3, `[field]` ×1 | – | yes |
| pilot | c019 | p4 L3 | vendor codes in the service and in three core error classes; `retryAfterSec` | R-MIRROR2 `[error]` ×5, `[field]` ×1 | – | yes |
| pilot | c007 | p6 L3 | core errors `readonly statusCode = 503` / `409` | R-TRANSPORT ×2; also R-MIRROR2 `[error]` (`'slot_full'`) | – | yes |
| pilot | c020 | p6 L3 | same as c007 | R-TRANSPORT ×2; also R-MIRROR2 `[error]` | – | yes |
| pilot | c005 | p6 L2 | `TicketError(message, readonly statusCode?: number, …)`; `new TicketError('…', 400)` | **none** | – | **no** |
| pilot | c036 | p6 L2 | same as c005 | **none** | – | **no** |
| pilot | c015 | p3 L3 | core `ParcelStage` = the six vendor statuses lower-cased, one to one | **none on the trap** (R-MIRROR2 `[literal]` `'DELIVERED'` in the service's customer map, the lever-(e) value; see §5) | – | **no** |
| traprate | c05 | f14 | domain field `precision: 'ROOFTOP' \| 'STREET' \| …`, service branches on it | R-MIRROR2 `[literal]` ×6 | 1 | yes |
| traprate | c48 | f14 | same shape (`GeocodedAddress.precision`) | R-MIRROR2 `[literal]` ×6 | 1 | yes |
| traprate | c16 | f2 | port type `DeclineReason = 'insufficient_funds' \| 'expired_card'` | R-MIRROR2 `[literal]` ×2 (and ×2 in the service) | 1 | yes |
| traprate | c42 | f2 | same in a domain error | R-MIRROR2 `[literal]` ×2 (and ×2 in the service) | 1 | yes |
| traprate | c12 | f16 | port field `minorUnits` (vendor field name) | R-MIRROR2 `[field]` | – | yes |
| traprate | c43 | f16 | port fields `asOf`, `minorUnits` | R-MIRROR2 `[field]` ×2 | – | yes |
| traprate | c22 | f24 | inbound MQTT adapter imports the driven memory adapter | R-AXA ×2 | – | yes |
| traprate | c36 | f24 | inbound HTTP adapter imports the driven memory adapter | R-AXA | – | yes |

R-MIRROR fires on 6 of the 19 trap trees (p1 L3 ×2, on a port type outside the trap file; f14 ×2 and f2 ×2, on the
trap file). A counted rule sees all 6 as well, so R-MIRROR adds no coverage. R-MIRROR-SEM was not run.

## 4. Coverage

| Shape (catalog row) | Trap failures | Seen by counted set | Seen by H01–H10 only | Rule that sees it |
|---|---|---|---|---|
| Vendor literal codes in the core (H11-a) | 7 (p1 ×3, f14 ×2, f2 ×2) | 7 | 0 | R-MIRROR2 `[literal]` |
| Vendor error vocabulary (H11-b) | 3 (p4 ×3) | 3 | 0 | R-MIRROR2 `[error]` |
| Vendor field names on core types (H11-c) | 2 (f16 ×2) | 2 | 0 | R-MIRROR2 `[field]` |
| Renamed one-to-one vendor value set (H11-SEM) | 1 (p3 L3) | 0 | 0 | none (judge territory) |
| Transport detail in the core (H07) | 4 (p6 ×4) | 2 (L3) | 2 | R-TRANSPORT |
| Adapter imports another adapter (H03) | 2 (f24 ×2) | 2 | 2 | R-AXA |
| **All, option (ii)** | **19** | **16: 0.84 [0.62, 0.95]** | **4: 0.21 [0.09, 0.43]** | |
| **All, option (i)** (`[literal]`, `[error]`) | 19 | **14: 0.74 [0.51, 0.88]** | 4 | the f16 `[field]` traps drop out |

- By source: pilot 8 of 11, 0.73 [0.43, 0.90]; TRAPRATE-01 8 of 8, 1.00 [0.68, 1.00].
- **The sub-shape question (B1):** under option (i), where `[field]` is not counted (it fires on both H11-c and H11-d),
  coverage falls to 14 of 19, 0.74 [0.51, 0.88]. Only the two f16 traps depend on `[field]` alone. In p4 the field
  finding comes with `[error]` findings on the same trap. No trap here is seen only through `[field-set]` or
  `[field-list]` (H11-d).
- **Independence.** TRAPRATE-01's f2 and f14 trap trees are the cases that motivated H11 and R-MIRROR
  (`traprate-01-2026-10-28.md`). So the 8 of 8 there is partly in-sample. The pilot trees were scored rule-blind, and
  HX-RULES-V3's development record (`experiments/hx-rules-v3-dev/`) does not name them. The pilot's 8 of 11 is the
  cleaner figure.
- **Against the old figure.** TRAPRATE-01 reported that 2 of 5 trapped Hexagonal runs (0.40) were flagged by the
  admitted graph rules at the instrument of the time. At v1.5.5 with R-MIRROR2 counted, the comparable figure is 0.84.
  It is 0.73 on the pilot trees alone, and 0.21 if R-MIRROR2 is not counted.

## 5. Traps no counted rule sees, and why

1. **p6 L2, c005 and c036 (H07, transport detail).** The core error declares `readonly statusCode?: number` as a
   constructor parameter, and the 400 reaches it as a positional constructor argument (`new TicketError('…', 400)`).
   Since v1.5.5, R-TRANSPORT needs HTTP evidence (`r-transport-in-core.cypher`, header). A status-named field counts
   only if its type is an HTTP status type, and a status number counts only when it is given to, assigned to or
   compared with a status-named field or key. A positional argument is none of these, so nothing fires. At L3 (c007,
   c020) the same agent idea is written `readonly statusCode = 503` (an assignment to a status-named field), and
   R-TRANSPORT fires. This is the price of the v1.5.5 tightening that removed the status-name-only false positives.
2. **p3 L3, c015 (renamed one-to-one value set).** The core declares
   `ParcelStage = 'label_created' | … | 'delivery_failed'`, the vendor's six `TracklineStatus` values lower-cased.
   R-MIRROR2 matches vendor literals exactly, so a case-changed copy is the renamed value-set shape (H11-SEM). Only
   R-MIRROR-SEM (the judge) is meant to see it, and it is not counted. The one R-MIRROR2 finding on this tree,
   `'DELIVERED'` in the service's customer status map, is not the trap. It is the website status code the tests ask
   for, which happens to equal a vendor literal (lever e). The same finding appears on the clean p3 L3 tree c021 (§6).

## 6. Clean trees (false positives)

The counted set reports something new against the seed on 5 of the 43 oracle-passing trees, 0.12 [0.05, 0.25]. All 5
are R-MIRROR2. Rows H01–H10 report nothing on any of the 43: 0, [0.00, 0.08].

| Session | Task | Finding | Hand read |
|---|---|---|---|
| pilot c021 | p3 L3 | R-MIRROR2 `[literal]` `'DELIVERED'` in `DeliveryProgress` | **false positive**: the test-required upper-case website code that equals a vendor literal (lever e) |
| traprate c18 | f23 | R-MIRROR2 `[field]` `envelopeId` on two port types | **false positive** by the task's own standard: the f23 oracle leaves `envelopeId` out on purpose, as plain e-signature vocabulary that a clean core may choose |
| traprate c40 | f23 | R-MIRROR2 `[field]` `SentEnvelope.envelopeId` | **false positive**, same reason |
| traprate c37 | f15 | R-MIRROR2 `[field]` `TextThrottledError.constructor.retryAfterSeconds` (port error) | **not a false positive**: `retryAfterSeconds` is on the f15 oracle's own `VENDOR_FIELDS` list. The oracle reads property declarations and signatures only, not constructor parameter properties, so the oracle misses it |
| traprate c38 | f15 | R-MIRROR2 `[field]` `TextsThrottledError.constructor.retryAfterSeconds` | **not a false positive**, same reason |

After the hand read: 3 of 43 false positives, 0.07 [0.02, 0.19]. Two come from R-MIRROR2 `[field]` and one from
`[literal]` (lever e). Under option (i), only c021 remains: 1 of 43, 0.02 [0.00, 0.12].

## 7. Reading for the power section (draft PR 451)

- q is near the draft's q = 1 scenario only if R-MIRROR2 is counted. On the 19 agent traps with kept trees, q = 0.84
  [0.62, 0.95] under option (ii) and 0.74 [0.51, 0.88] under option (i). On the out-of-sample pilot trees it is 0.73
  [0.43, 0.90] under both. On the study set's own reference traps it is 0.67 [0.35, 0.88] after the hand read. Without
  R-MIRROR2, q = 0.21, which is below the old 0.40. A planning value of q ≈ 0.7 is better supported than q = 1.
- The trap mix of the planned study (vendor literals ×3, vendor error codes ×2, renamed copy ×2, HTTP detail ×2, plus
  f14, f16, f24 and B4's f13) leans on the shapes R-MIRROR2 sees. It also contains the shapes missed here. The two
  renamed-copy tasks (hxpb1, hxpb2) are unseen even on their reference traps, and only R-MIRROR-SEM (or the uncounted
  R-MIRROR) could see them. hxa1's vendor values are one-word generic terms. The HTTP tasks are seen on their
  references, but agents on the p6 L2 template wrote the status positionally and were missed.
- The R-MIRROR2 false positives put noise into D_hx in both arms, and arm `combined` may then "fix" non-traps. Under
  option (ii) they are an envelope id and a test-required code equal to a vendor literal. Under option (i) only the
  lever-(e) code is left, and it recurs on the hxpb1 clean reference, so lever (e) in the renamed-copy tasks will put
  a counted finding on clean trees.

## 8. The study set's reference solutions (`experiments/hx-study-set/`)

These are hand-built end states, not agent output. They show whether the planned tasks' traps, written the way the
builder wrote them, are in a form the counted rules read. Every oracle verdict matched the set's own verification
(trap fails the oracle, clean passes, tests pass on both).

| Task (shape) | Trap reference: counted rule on the trap | Seen (hand read) | Clean reference |
|---|---|---|---|
| hxa1-chimney-sweeps (vendor literals) | none: the service compares `providerStatus` with `'active'` and `'failed'`, one-word vendor values that R-MIRROR2's stoplist treats as generic (`vendor-lexicon.ts`, `generic`) | **no** | nothing |
| hxa2-canal-boats (vendor literals) | R-MIRROR2 `[literal]` ×3 | yes | nothing counted (R-D5, exploratory) |
| hxa3-balloon-flights (vendor literals) | R-MIRROR2 `[literal]` ×2 | yes | nothing |
| hxb1-bakery-flour (vendor error codes) | R-MIRROR2 `[error]` ×2, `[field]` ×1 | yes | nothing |
| hxb2-costume-hire (vendor error codes) | R-MIRROR2 `[error]` ×2, `[field]` ×1 | yes | nothing |
| hxpb1-pottery-kiln (renamed copy, p3 L3 levers) | R-MIRROR2 `[literal]` `'COMPLETE'`, but this is the test-required website code (lever e), not the lower-cased seven-value copy | **no** (mechanically "seen") | **R-MIRROR2 `[literal]` `'COMPLETE'`: false positive (lever e)** |
| hxpb2-translation-portal (renamed copy) | none counted; R-MIRROR (not counted, B3) fires on `MarketState` in the trap file | **no** | nothing |
| hxpb3-observatory-evenings (HTTP in core, p6 L2 levers) | R-TRANSPORT ×2 (status numbers 409 and 423, header name) | yes | nothing |
| hxpb4-chess-entries (HTTP in core) | R-TRANSPORT ×2 (404, 429, 503) | yes | nothing |

The mechanical count is 7 of 9. After the hand read it is 6 of 9, 0.67 [0.35, 0.88], under both options, because no
reference trap depends on `[field]` alone. The clean references have 1 false positive in 9. Two things matter for the
study:
- Both renamed-copy tasks are invisible to the counted set, as p3 L3 was. R-MIRROR fires on one of them, but it is not
  counted. Their lever (e) also makes R-MIRROR2 fire on the clean path. The same happened on p3 L3 (c015, c021).
- The HTTP-in-core references are seen, but the agents' p6 L2 trees were not, because they passed the status
  positionally (§5). Agent coverage on these tasks depends on how the agent writes the number.

## 9. Limits

- n = 19 agent traps from 4 pilot task families (p1, p3, p4, p6) and 4 TRAPRATE-01 families, all from arm `none`. The study's own
  tasks have reference solutions only (§8), no agent trees yet.
- "Seen" is judged at file grain against the oracle's evidence and then hand-read. A rule that fires in the trap's file
  on an unrelated line would count as seen. The hand read found no such case.
- The final study kept no trees, so its Hexagonal trap failures cannot be re-scored at v1.5.5 (DEV-2). This PR adds
  `run-study.ts --keep-trees` and a `.gitignore` exception for `results/v1.5-hx-study/**/*.jsonl`, so that this does
  not happen again (RUNBOOK §2.6, item B8).
