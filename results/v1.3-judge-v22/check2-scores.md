CHECK-2: 138 items ({"items":138,"targets":90,"seed":50,"twin":40,"clean":48,"layeredBusinessClean":21}); unit verdict = majority of 3 runs for both judges; items sha256 1c104ce17f2d2bc41933360f72d86ac8d851d61f672464141f4140d79bdd11c8.

| Judge | Catch | Paired catch | Twin false fail | Paired twin false fail | Clean false fail (units) | Invalid units |
|---|---|---|---|---|---|---|
| v1 | 40/40 = 1.00 [0.91, 1.00] | 27/40 = 0.68 [0.52, 0.80] | 12/40 = 0.30 [0.18, 0.45] | 0/40 = 0.00 [0.00, 0.09] | 16/48 = 0.33 [0.22, 0.47] | 0 |
| v2.2 | 40/40 = 1.00 [0.91, 1.00] | 33/40 = 0.82 [0.68, 0.91] | 7/40 = 0.17 [0.09, 0.32] | 0/40 = 0.00 [0.00, 0.09] | 8/48 = 0.17 [0.09, 0.30] | 0 |
| v1, layered bases | 24/24 = 1.00 [0.86, 1.00] | 14/24 = 0.58 [0.39, 0.76] | 10/24 = 0.42 [0.24, 0.61] | 0/24 = 0.00 [0.00, 0.14] | 11/27 = 0.41 [0.25, 0.59] | 0 |
| v2.2, layered bases | 24/24 = 1.00 [0.86, 1.00] | 18/24 = 0.75 [0.55, 0.88] | 6/24 = 0.25 [0.12, 0.45] | 0/24 = 0.00 [0.00, 0.14] | 7/27 = 0.26 [0.13, 0.45] | 0 |
| v1, other styles | 16/16 = 1.00 [0.81, 1.00] | 13/16 = 0.81 [0.57, 0.93] | 2/16 = 0.13 [0.03, 0.36] | 0/16 = 0.00 [0.00, 0.19] | 5/21 = 0.24 [0.11, 0.45] | 0 |
| v2.2, other styles | 16/16 = 1.00 [0.81, 1.00] | 15/16 = 0.94 [0.72, 0.99] | 1/16 = 0.06 [0.01, 0.28] | 0/16 = 0.00 [0.00, 0.19] | 1/21 = 0.05 [0.01, 0.23] | 0 |

| Family | Judge | Catch | Paired catch | Twin false fail |
|---|---|---|---|---|
| FRAMEWORK-LEAK | v1 | 10/10 = 1.00 [0.72, 1.00] | 5/10 = 0.50 [0.24, 0.76] | 4/10 = 0.40 [0.17, 0.69] |
| FRAMEWORK-LEAK | v2.2 | 10/10 = 1.00 [0.72, 1.00] | 10/10 = 1.00 [0.72, 1.00] | 0/10 = 0.00 [0.00, 0.28] |
| PERSIST-IN-DOMAIN | v1 | 10/10 = 1.00 [0.72, 1.00] | 10/10 = 1.00 [0.72, 1.00] | 0/10 = 0.00 [0.00, 0.28] |
| PERSIST-IN-DOMAIN | v2.2 | 10/10 = 1.00 [0.72, 1.00] | 10/10 = 1.00 [0.72, 1.00] | 0/10 = 0.00 [0.00, 0.28] |
| REPO-BYPASS | v1 | 10/10 = 1.00 [0.72, 1.00] | 3/10 = 0.30 [0.11, 0.60] | 7/10 = 0.70 [0.40, 0.89] |
| REPO-BYPASS | v2.2 | 10/10 = 1.00 [0.72, 1.00] | 3/10 = 0.30 [0.11, 0.60] | 7/10 = 0.70 [0.40, 0.89] |
| LOGIC-IN-CONTROLLER | v1 | 10/10 = 1.00 [0.72, 1.00] | 9/10 = 0.90 [0.60, 0.98] | 1/10 = 0.10 [0.02, 0.40] |
| LOGIC-IN-CONTROLLER | v2.2 | 10/10 = 1.00 [0.72, 1.00] | 10/10 = 1.00 [0.72, 1.00] | 0/10 = 0.00 [0.00, 0.28] |

**Decision (rule fixed in Docs/v1.3/judge-v22-plan.md §5): NOT CANDIDATE**

| Check | Rule | v1 | v2.2 | Holds |
|---|---|---|---|---|
| D0 | at most 2 units without a majority verdict (invalid, tied or missing) per judge | 0 | 0 | yes |
| D1 | layered business clean units: v2.2 false fails <= 1 and <= v1's | 10/21 | 7/21 | NO |
| D2 | catch: v2.2 >= v1 - 1 | 40/40 | 40/40 | yes |
| D3 | paired catch: v2.2 >= v1 - 1 | 27/40 | 33/40 | yes |
| D4 | twin false fail: v2.2 <= v1 + 1 | 12/40 | 7/40 | yes |
| D5 | clean false fail (all units): v2.2 <= v1 | 16/48 | 8/48 | yes |
| D6 | real construct (non-layered REPO-BYPASS and PERSIST-IN-DOMAIN seeds): v2.2 catch >= v1 catch | 8/8 | 8/8 | yes |

Items whose verdict differs (v1 → v2.2):
- clean clean base:layered-library FF-N02 src/business/services/LoanHistoryService.ts: fail → pass
- clean clean base:layered-library FF-N02 src/presentation/http/LoanController.ts: fail → pass
- clean clean base:layered-clinic FF-N02 src/business/services/VisitNotesService.ts: fail → pass
- clean clean base:layered-fleet FF-N02 src/business/services/MileageService.ts: fail → pass
- clean clean base:nestjs-courses FF-N02 src/courses/courses.service.ts: fail → pass
- clean clean base:nestjs-courses FF-N02 src/enrolments/enrolments.service.ts: fail → pass
- clean clean base:hexagonal-parking FF-N02 src/application/services/ReserveSpotService.ts: fail → pass
- clean clean base:ddd-insurance FF-N02 src/claims/application/FileClaim.ts: fail → pass
- twin FRAMEWORK-LEAK layered-library__AP-FRAMEWORK-LEAKn FF-N02 src/business/services/LoanHistoryService.ts: fail → pass
- twin LOGIC-IN-CONTROLLER layered-library__AP-FAT-CONTROLLERn FF-N02 src/presentation/http/LoanController.ts: fail → pass
- twin FRAMEWORK-LEAK layered-clinic__AP-FRAMEWORK-LEAKn FF-N02 src/business/services/VisitNotesService.ts: fail → pass
- twin FRAMEWORK-LEAK layered-fleet__AP-FRAMEWORK-LEAKn FF-N02 src/business/services/MileageService.ts: fail → pass
- twin FRAMEWORK-LEAK nestjs-courses__AP-FRAMEWORK-LEAKn FF-N02 src/courses/courses.service.ts: fail → pass
