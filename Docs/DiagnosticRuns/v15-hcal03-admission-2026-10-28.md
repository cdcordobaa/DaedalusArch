# v1.5 HCAL-03: per-rule admission of the Hexagonal confirmatory family, second sealed set

Date: 2026-10-28. Zero model calls. Scored once, under the bar in `ops/notes/cn-03-hex-catalog.md`.

## Order of events (from the commits)

| Step | Commit | Time (−05:00) |
|---|---|---|
| Row catalog H08–H10 and HCAL-03 design committed (before any rule change or case) | `b2defa3a4` | 2026-10-27 20:22 |
| Cases built by 2 blind sessions (museum loans, community solar co-op), brief `experiments/hcal-03/BRIEF.md` | — | 2026-10-28 |
| H03 and H07 revisions | `cbdd2d139` | 2026-10-28 12:11 |
| New rules R-LOCATOR, R-COREIO, R-ENTITY-OUT | `55ab574cd` (PR 409) | 2026-10-28 |
| Seal: SHA-256 of 215 files (`3beab71a…`), frozen rule sources and scorer (`RULES-FROZEN.sha256`, `b39b8b67…`) | `ebc6da90a` | 2026-10-28 |
| Scoring; case, rule and scorer hashes re-verified first | this report | after the seal |

Checks before the seal: both bases pass pre-flight with 0 errors and score clean under every rule; 10 rows × 5 cases
× 2 domains present. The solar co-op base first scored R-D3 on three inline calculations in use cases; its builder
moved them into the domain and updated the 16 overlays that carry a copy of those files. No case was opened by the rule
author for this.

Disclosure: the builders' completion summaries, read by the rule author before the seal, named the shapes of a few
cases (solar co-op H07-pos1 an `httpStatus` field, H08-pos2 a registry inside an adapter package, H06-legit; museum
loans H08 a `service-registry.ts` module in the application layer, H10-legit). The H03 and H07 revisions and the
R-LOCATOR design were written before those summaries arrived; R-ENTITY-OUT was tightened afterwards on two clean study
and CAL-03 cases (a domain read-model interface, a free helper function), not on HCAL-03.

## Result

Scorer: `experiments/cal-01/score.ts --dir experiments/hcal-03 --rows hex`. Record: `experiments/hcal-03/result.json`.

| Row | Recall | FP | Admitted | HCAL-02 |
|---|---|---|---|---|
| H01 domain depends outward | 4/4 | 0/6 | **yes** | yes |
| H02 use case imports an adapter | 4/4 | 0/6 | **yes** | yes |
| H03 adapter imports another adapter | 4/4 | 0/6 | **yes** | no |
| H04 vendor or handle type in an out-port | 4/4 | 0/6 | **yes** | yes |
| H05 use case constructs an adapter | 4/4 | 0/6 | **yes** | yes |
| H06 business rule in an adapter | 0/4 | 0/6 | no (no rule; cannot be admitted) | no |
| H07 transport concepts in the core | 4/4 | 0/6 | **yes** | no |
| H08 service locator outside the composition root | 3/4 | 0/6 | no | new |
| H09 I/O without a port in the core | 4/4 | 0/6 | **yes** | new |
| H10 entity as an inbound adapter's transport shape | 4/4 | 0/6 | **yes** | new |

- **Family bar: met.**
  - Admitted rows H01, H02, H03, H04, H05, H07, H09 and H10: pooled recall 32/32, Wilson lower bound ≈ 0.89 (bar
    0.80).
  - 0 false positives on their 48 clean cases, and no finding by an admitted rule on any clean case of the set.
- **8 of 10 rows admitted**, against 4 of 7 on HCAL-02. The four HCAL-02 rows pass again under the new rule hash.

## The H08 miss (read after scoring; nothing changed)

`museum-loans/H08-pos2`: the controller takes its clock from a free function, `resolve<Clock>('clock')`, that wraps
`ServiceRegistry.resolve`. R-LOCATOR sees member calls only, so it reports the lookup inside the wrapper
(`src/application/service-registry.ts:16`), not at the labelled controller. By the pre-registration the label
stands. A rule that follows calls into such a wrapper is development work and needs a new sealed set.

## What this means for the study

- **Hexagonal confirmatory outcome = findings of the rules of the 8 admitted rows:** FF-S01, FF-S03, FF-S04, FF-P01,
  FF-P02, FF-P03, R-INJ, R-AXA, R-H5, R-TRANSPORT, R-COREIO and R-ENTITY-OUT. R-LOCATOR runs and is reported as
  exploratory.
- **Two study-set consequences of H03 (R-AXA) entering**, open before registration:
  - `f24-hex-laundry-lockers`: its clean reference solution has 3 R-AXA findings (an inbound adapter imports
    out-adapter types; the MQTT adapter imports the HTTP adapter's reply helper). The clean solution is then not
    silent for an admitted rule.
  - `f19-hex-school-canteen` was set exploratory because its trap is visible only to R-AXA; it can move to the
    confirmatory set.
- Later rule changes change the rule hash: HCAL-03 is then re-run as a regression check; an identical record keeps
  this admission, any change reopens it.
