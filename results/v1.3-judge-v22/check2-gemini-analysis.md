EXPLORATORY, NOT PRE-REGISTERED. Gemini rater and both ensemble rules were added after the decision rule was fixed and do not enter it.

| Rater | Catch | Paired catch | Twin false fail | Clean false fail (units) | Invalid units |
|---|---|---|---|---|---|
| Claude v1 (maj. of 3) | 40/40 = 1.00 [0.91, 1.00] | 27/40 = 0.68 [0.52, 0.80] | 12/40 = 0.30 [0.18, 0.45] | 16/48 = 0.33 [0.22, 0.47] | 0 |
| Claude v2.2 (maj. of 3) | 40/40 = 1.00 [0.91, 1.00] | 33/40 = 0.82 [0.68, 0.91] | 7/40 = 0.17 [0.09, 0.32] | 8/48 = 0.17 [0.09, 0.30] | 0 |
| Gemini v2.2 (1 run) | 40/40 = 1.00 [0.91, 1.00] | 34/40 = 0.85 [0.71, 0.93] | 7/40 = 0.17 [0.09, 0.32] | 6/48 = 0.13 [0.06, 0.25] | 1 |
| Ensemble BOTH fail (v2.2 + Gemini) | 40/40 = 1.00 [0.91, 1.00] | 34/40 = 0.85 [0.71, 0.93] | 7/40 = 0.17 [0.09, 0.32] | 6/48 = 0.13 [0.06, 0.25] | 0 |
| Ensemble EITHER fails (v2.2 + Gemini) | 40/40 = 1.00 [0.91, 1.00] | 33/40 = 0.82 [0.68, 0.91] | 7/40 = 0.17 [0.09, 0.32] | 8/48 = 0.17 [0.09, 0.30] | 1 |

Agreement, Claude v2.2 vs Gemini (unit verdicts, 137 units with a pass/fail from both; 1 excluded): observed 0.978, Cohen's kappa 0.954.

| | Gemini pass | Gemini fail |
|---|---|---|
| Claude v2.2 pass | 81 | 0 |
| Claude v2.2 fail | 3 | 53 |

| Family | Rater | Catch | Twin false fail |
|---|---|---|---|
| FRAMEWORK-LEAK | Claude v1 (maj. of 3) | 10/10 = 1.00 [0.72, 1.00] | 4/10 = 0.40 [0.17, 0.69] |
| FRAMEWORK-LEAK | Claude v2.2 (maj. of 3) | 10/10 = 1.00 [0.72, 1.00] | 0/10 = 0.00 [0.00, 0.28] |
| FRAMEWORK-LEAK | Gemini v2.2 (1 run) | 10/10 = 1.00 [0.72, 1.00] | 0/10 = 0.00 [0.00, 0.28] |
| FRAMEWORK-LEAK | Ensemble BOTH fail (v2.2 + Gemini) | 10/10 = 1.00 [0.72, 1.00] | 0/10 = 0.00 [0.00, 0.28] |
| FRAMEWORK-LEAK | Ensemble EITHER fails (v2.2 + Gemini) | 10/10 = 1.00 [0.72, 1.00] | 0/10 = 0.00 [0.00, 0.28] |
| PERSIST-IN-DOMAIN | Claude v1 (maj. of 3) | 10/10 = 1.00 [0.72, 1.00] | 0/10 = 0.00 [0.00, 0.28] |
| PERSIST-IN-DOMAIN | Claude v2.2 (maj. of 3) | 10/10 = 1.00 [0.72, 1.00] | 0/10 = 0.00 [0.00, 0.28] |
| PERSIST-IN-DOMAIN | Gemini v2.2 (1 run) | 10/10 = 1.00 [0.72, 1.00] | 0/10 = 0.00 [0.00, 0.28] |
| PERSIST-IN-DOMAIN | Ensemble BOTH fail (v2.2 + Gemini) | 10/10 = 1.00 [0.72, 1.00] | 0/10 = 0.00 [0.00, 0.28] |
| PERSIST-IN-DOMAIN | Ensemble EITHER fails (v2.2 + Gemini) | 10/10 = 1.00 [0.72, 1.00] | 0/10 = 0.00 [0.00, 0.28] |
| REPO-BYPASS | Claude v1 (maj. of 3) | 10/10 = 1.00 [0.72, 1.00] | 7/10 = 0.70 [0.40, 0.89] |
| REPO-BYPASS | Claude v2.2 (maj. of 3) | 10/10 = 1.00 [0.72, 1.00] | 7/10 = 0.70 [0.40, 0.89] |
| REPO-BYPASS | Gemini v2.2 (1 run) | 10/10 = 1.00 [0.72, 1.00] | 7/10 = 0.70 [0.40, 0.89] |
| REPO-BYPASS | Ensemble BOTH fail (v2.2 + Gemini) | 10/10 = 1.00 [0.72, 1.00] | 7/10 = 0.70 [0.40, 0.89] |
| REPO-BYPASS | Ensemble EITHER fails (v2.2 + Gemini) | 10/10 = 1.00 [0.72, 1.00] | 7/10 = 0.70 [0.40, 0.89] |
| LOGIC-IN-CONTROLLER | Claude v1 (maj. of 3) | 10/10 = 1.00 [0.72, 1.00] | 1/10 = 0.10 [0.02, 0.40] |
| LOGIC-IN-CONTROLLER | Claude v2.2 (maj. of 3) | 10/10 = 1.00 [0.72, 1.00] | 0/10 = 0.00 [0.00, 0.28] |
| LOGIC-IN-CONTROLLER | Gemini v2.2 (1 run) | 10/10 = 1.00 [0.72, 1.00] | 0/10 = 0.00 [0.00, 0.28] |
| LOGIC-IN-CONTROLLER | Ensemble BOTH fail (v2.2 + Gemini) | 10/10 = 1.00 [0.72, 1.00] | 0/10 = 0.00 [0.00, 0.28] |
| LOGIC-IN-CONTROLLER | Ensemble EITHER fails (v2.2 + Gemini) | 10/10 = 1.00 [0.72, 1.00] | 0/10 = 0.00 [0.00, 0.28] |

| Style | Rater | Catch | Twin false fail | Clean false fail |
|---|---|---|---|---|
| layered | Claude v1 (maj. of 3) | 24/24 = 1.00 [0.86, 1.00] | 10/24 = 0.42 [0.24, 0.61] | 11/27 = 0.41 [0.25, 0.59] |
| layered | Claude v2.2 (maj. of 3) | 24/24 = 1.00 [0.86, 1.00] | 6/24 = 0.25 [0.12, 0.45] | 7/27 = 0.26 [0.13, 0.45] |
| layered | Gemini v2.2 (1 run) | 24/24 = 1.00 [0.86, 1.00] | 6/24 = 0.25 [0.12, 0.45] | 6/27 = 0.22 [0.11, 0.41] |
| layered | Ensemble BOTH fail (v2.2 + Gemini) | 24/24 = 1.00 [0.86, 1.00] | 6/24 = 0.25 [0.12, 0.45] | 6/27 = 0.22 [0.11, 0.41] |
| layered | Ensemble EITHER fails (v2.2 + Gemini) | 24/24 = 1.00 [0.86, 1.00] | 6/24 = 0.25 [0.12, 0.45] | 7/27 = 0.26 [0.13, 0.45] |
| clean-architecture | Claude v1 (maj. of 3) | 4/4 = 1.00 [0.51, 1.00] | 0/4 = 0.00 [0.00, 0.49] | 0/5 = 0.00 [0.00, 0.43] |
| clean-architecture | Claude v2.2 (maj. of 3) | 4/4 = 1.00 [0.51, 1.00] | 0/4 = 0.00 [0.00, 0.49] | 0/5 = 0.00 [0.00, 0.43] |
| clean-architecture | Gemini v2.2 (1 run) | 4/4 = 1.00 [0.51, 1.00] | 0/4 = 0.00 [0.00, 0.49] | 0/5 = 0.00 [0.00, 0.43] |
| clean-architecture | Ensemble BOTH fail (v2.2 + Gemini) | 4/4 = 1.00 [0.51, 1.00] | 0/4 = 0.00 [0.00, 0.49] | 0/5 = 0.00 [0.00, 0.43] |
| clean-architecture | Ensemble EITHER fails (v2.2 + Gemini) | 4/4 = 1.00 [0.51, 1.00] | 0/4 = 0.00 [0.00, 0.49] | 0/5 = 0.00 [0.00, 0.43] |
| nestjs | Claude v1 (maj. of 3) | 4/4 = 1.00 [0.51, 1.00] | 2/4 = 0.50 [0.15, 0.85] | 3/5 = 0.60 [0.23, 0.88] |
| nestjs | Claude v2.2 (maj. of 3) | 4/4 = 1.00 [0.51, 1.00] | 1/4 = 0.25 [0.05, 0.70] | 1/5 = 0.20 [0.04, 0.62] |
| nestjs | Gemini v2.2 (1 run) | 4/4 = 1.00 [0.51, 1.00] | 1/4 = 0.25 [0.05, 0.70] | 0/5 = 0.00 [0.00, 0.43] |
| nestjs | Ensemble BOTH fail (v2.2 + Gemini) | 4/4 = 1.00 [0.51, 1.00] | 1/4 = 0.25 [0.05, 0.70] | 0/5 = 0.00 [0.00, 0.43] |
| nestjs | Ensemble EITHER fails (v2.2 + Gemini) | 4/4 = 1.00 [0.51, 1.00] | 1/4 = 0.25 [0.05, 0.70] | 1/5 = 0.20 [0.04, 0.62] |
| hexagonal | Claude v1 (maj. of 3) | 4/4 = 1.00 [0.51, 1.00] | 0/4 = 0.00 [0.00, 0.49] | 1/5 = 0.20 [0.04, 0.62] |
| hexagonal | Claude v2.2 (maj. of 3) | 4/4 = 1.00 [0.51, 1.00] | 0/4 = 0.00 [0.00, 0.49] | 0/5 = 0.00 [0.00, 0.43] |
| hexagonal | Gemini v2.2 (1 run) | 4/4 = 1.00 [0.51, 1.00] | 0/4 = 0.00 [0.00, 0.49] | 0/5 = 0.00 [0.00, 0.43] |
| hexagonal | Ensemble BOTH fail (v2.2 + Gemini) | 4/4 = 1.00 [0.51, 1.00] | 0/4 = 0.00 [0.00, 0.49] | 0/5 = 0.00 [0.00, 0.43] |
| hexagonal | Ensemble EITHER fails (v2.2 + Gemini) | 4/4 = 1.00 [0.51, 1.00] | 0/4 = 0.00 [0.00, 0.49] | 0/5 = 0.00 [0.00, 0.43] |
| ddd | Claude v1 (maj. of 3) | 4/4 = 1.00 [0.51, 1.00] | 0/4 = 0.00 [0.00, 0.49] | 1/6 = 0.17 [0.03, 0.56] |
| ddd | Claude v2.2 (maj. of 3) | 4/4 = 1.00 [0.51, 1.00] | 0/4 = 0.00 [0.00, 0.49] | 0/6 = 0.00 [0.00, 0.39] |
| ddd | Gemini v2.2 (1 run) | 4/4 = 1.00 [0.51, 1.00] | 0/4 = 0.00 [0.00, 0.49] | 0/6 = 0.00 [0.00, 0.39] |
| ddd | Ensemble BOTH fail (v2.2 + Gemini) | 4/4 = 1.00 [0.51, 1.00] | 0/4 = 0.00 [0.00, 0.49] | 0/6 = 0.00 [0.00, 0.39] |
| ddd | Ensemble EITHER fails (v2.2 + Gemini) | 4/4 = 1.00 [0.51, 1.00] | 0/4 = 0.00 [0.00, 0.49] | 0/6 = 0.00 [0.00, 0.39] |

Layered business clean units (n = 21), false fails:

- Claude v1 (maj. of 3): 10/21 = 0.48 [0.28, 0.68]
- Claude v2.2 (maj. of 3): 7/21 = 0.33 [0.17, 0.55]
- Gemini v2.2 (1 run): 6/21 = 0.29 [0.14, 0.50]
- Ensemble BOTH fail (v2.2 + Gemini): 6/21 = 0.29 [0.14, 0.50]
- Ensemble EITHER fails (v2.2 + Gemini): 7/21 = 0.33 [0.17, 0.55]

Units where Claude v2.2 and Gemini disagree:
- clean clean layered base:layered-clinic FF-N02 src/business/services/VisitNotesService.ts: v2.2 pass, Gemini invalid
- clean clean layered base:layered-fleet FF-N02 src/business/services/MaintenanceService.ts: v2.2 fail, Gemini pass
- clean clean nestjs base:nestjs-courses FF-N01 src/enrolments#application: v2.2 fail, Gemini pass
- seed LOGIC-IN-CONTROLLER layered layered-fleet__AP-FAT-CONTROLLER FF-N02 src/business/services/MaintenanceService.ts: v2.2 fail, Gemini pass
