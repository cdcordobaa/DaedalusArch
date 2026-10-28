# v1.5 HCAL-04: admission of Hexagonal rows H06, H08 and H11 (second round)

Date: 2026-10-28. Zero model calls. Scored once, under the bar in `ops/notes/cn-04-hex-catalog.md`.

## Order of events (from the commits)

| Step | Commit |
|---|---|
| CN-04 design (rows, rules, HCAL-04) committed before any rule change or case | `1a24d9cb6` |
| Cases built by 2 blind sessions (veterinary clinic, community radio station), brief `experiments/hcal-04/BRIEF.md` | — |
| Rules R-ADAPTER-RULE, R-LOCATOR (via helper), R-MIRROR | PR 415, merged `cd8072230` |
| Seal: SHA-256 of 116 files (`16fde34b…`), frozen rule sources and scorer (`070e082e…`) | `141d2d43f` |
| Scoring; case, rule and scorer hashes re-verified first | this report |

Disclosure, as the design note states: H11 was motivated by TRAPRATE-01 outputs of two study tasks (f2, f14), and the
R-MIRROR catch-all allowance (one generic value such as `other` next to at least two vendor codes) was added after
reading f2's outputs. Both were development checks; admission rests on this set alone.

## Result

Scorer: `experiments/cal-01/score.ts --dir experiments/hcal-04 --rows hex`. Record: `experiments/hcal-04/result.json`.

| Row | Recall | FP | Admitted |
|---|---|---|---|
| H06 business rule in an adapter (R-ADAPTER-RULE) | 0/4 | 0/6 | no |
| H08 service locator, also through a helper (R-LOCATOR) | **4/4** | 0/6 | **yes** |
| H11 vendor vocabulary in the core (R-MIRROR) | 0/4 | 0/6 | no |

## Regression at the new rule hash

- **CAL-03:** identical to its sealed record. The 9 DDD rows keep their admission.
- **HCAL-03:** identical except 4 violation cases of the revised rows (H06: 3 new R-ADAPTER-RULE hits; H08-pos2: the
  via-helper hit). The 8 admitted Hexagonal rows are unchanged and keep their admission.

**Hexagonal confirmatory family:** H01, H02, H03, H04, H05, H07, H08, H09, H10. Pooled recall 36/36 (HCAL-03 32/32,
HCAL-04 H08 4/4), Wilson lower bound ≈ 0.90; 0 false positives on their clean cases.

## Why H06 and H11 missed (read after scoring; nothing changed)

- **H11:** both domains vendor their SDK inside the project (`vendor/<sdk>/index.d.ts`, resolved through tsconfig
  `paths`). R-MIRROR counts as vendor types only declarations resolved outside the tree, so it saw no vendor at all.
  On the study tasks the SDKs resolve from `node_modules`, which is why the development checks fired. The construct is
  "an external SDK's types"; treating any module imported by a bare specifier as external would cover both layouts.
- **H06:** the adapters decide on request values that are not domain-typed (for example a booking refused when the
  requested date is a Sunday). R-ADAPTER-RULE reads only domain-typed state, by design. Telling a business decision on
  raw request data from transport validation needs meaning, which is the semantic layer's question (N2).

A revision of either rule is development work and needs a fresh sealed set.
