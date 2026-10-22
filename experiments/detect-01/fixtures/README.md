# DETECT-01 fixtures: DEVELOPMENT SPLIT

**These fixtures are development material, not an evaluation set.** They were written by the same session that wrote the
detectors and the semantic questions, after reading the pilot diffs and the hand-read log, and the detectors were
adjusted while looking at them and at the pilot trees. Any figure measured on them (TP/FP/FN/TN, twin discrimination,
semantic verdicts) shows only that a detector does what it was built to do on the shapes it was built from. **A
confirmatory evaluation needs fresh, held-out cases** written by someone else (or mutation-seeded from trees the
detectors have not seen), labelled before any detector runs on them.

## Layout

```
<fixture>/fixture.json   split, case, family, provenance, what pos and twin differ in
<fixture>/pos/src/...    minimal TypeScript tree that holds the violation
<fixture>/twin/src/...   the same tree with only that violation fixed
<fixture>/clean/src/...  negative controls only
```

Every variant typechecks with `tsc --strict` (ES2022, no `@types`).

| Fixture | Case (hand-read row) | Family | Pilot snapshot (task, step, run commit) |
|---|---|---|---|
| `c1-s1-d5-lock` | 1, `src/application/services/BookRoomService.ts:37` | D5 | s1-hotel-bookings, 2, `28ebb3d4` |
| `c2-s1-d4-saveaudited` | 2, `src/application/ports/out/BookingRepository.ts:11` | D4 | s1-hotel-bookings, 3, `d3e50376` (see `deviation`) |
| `c3-s1-d3-revenue` | 3, `src/application/services/OccupancyReportService.ts:39` | D3 | s1-hotel-bookings, 4, `da7876a7` |
| `c4-s1-h5-lockport` | 4, `src/application/ports/out/BookingRepository.ts:16` | H5 | s1-hotel-bookings, 5, `e4cf6cff` |
| `c5-s2-d4-recordpayment` | 5, `src/billing/application/RecordPayment.ts:15` | D4 | s2-orders-invoices, 1, `57a5f335` |
| `c6-s2-d5-placeorder` | 6, `src/ordering/application/PlaceOrder.ts:35` | D5 | s2-orders-invoices, 2, `a48b66ab` |
| `c7-s2-d5-settaxrate` | 7, `src/ordering/application/SetTaxRate.ts:8` | D5 | s2-orders-invoices, 4, `02238e72` |
| `c8-s2-d4-issueinvoice` | 8, `src/billing/application/IssueInvoice.ts:20` | D4 | s2-orders-invoices, 5, `5d16cf62` |
| `c9-s2-d9-lineviews` | 9, `src/ordering/domain/order/Order.ts:89` | D9 | s2-orders-invoices, 5, `5d16cf62` |
| `c4v-h5-vendor-type` | variant of 4 (not a hand-read row) | H5 | — |
| `c9v-d9-entity-in-contract` | variant of 9 (not a hand-read row) | D9 | — |
| `n1-hex-clean-guests` | negative control | — | — |
| `n2-ddd-clean-outbox` | negative control | — | — |
| `n3-hex-clean-vendor-adapter` | negative control | — | — |

Provenance: branch `pilot/hexddd-01`, commit `c1805364`; the step diffs are
`results/v1.4-pilot-hexddd-01/diffs/<task>/step-NN.diff` there, and the run commits are the `commit` field of
`results/v1.4-pilot-hexddd-01/scores/<task>/step-NN.json`. File:line is on the new side of the step diff.

Folders named `ports/out` are kept by a negation in the root `.gitignore` (the generic `out/` rule would drop them; the
same rule dropped `src/application/ports/out/` from the committed S1 pilot seed on `pilot/hexddd-01`, which
`build-seeds.mjs` regenerates).
