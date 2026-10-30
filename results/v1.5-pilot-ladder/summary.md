| Task | Level | Trap failed | Functional | Feature cases | Oracle by step (seed, s1, s2, s3) | In band |
|---|---|---|---|---|---|---|
| p1-campsite-payments | L1 | 0/2 | 2/2 | 5/5, 5/5 | pppp, pppp | no |
| p1-campsite-payments | L2 | 1/2 | 2/2 | 5/5, 5/5 | pppp, pFFF | yes |
| p1-campsite-payments | L3 | 2/2 | 2/2 | 5/5, 5/5 | pFFF, pFFF | no |
| p2-bookshop-metadata | L1 | 0/2 | 2/2 | 3/3, 3/3 | pppp, pppp | no |
| p2-bookshop-metadata | L2 | 0/2 | 2/2 | 3/3, 3/3 | pppp, pppp | no |
| p2-bookshop-metadata | L3 | 0/2 | 2/2 | 3/3, 3/3 | pppp, pppp | no |
| p3-florist-tracking | L1 | 0/2 | 0/2 (flag) | 2/3, 2/3 | pppp, pppp | no |
| p3-florist-tracking | L2 | 0/2 | 0/2 (flag) | 2/3, 2/3 | pppp, pppp | no |
| p3-florist-tracking | L3 | 1/2 | 2/2 | 3/3, 3/3 | pFFF, pppp | yes |
| p4-dental-calendar | L1 | 0/2 | 1/2 (flag) | 1/3, 3/3 | pppp, pppp | no |
| p4-dental-calendar | L2 | 1/2 | 2/2 | 3/3, 3/3 | pFFF, pppp | yes |
| p4-dental-calendar | L3 | 2/2 | 2/2 | 3/3, 3/3 | pFFF, pFFF | no |
| p5-allotment-letters | L1 | 0/2 | 2/2 | 3/3, 3/3 | pppp, pppp | no |
| p5-allotment-letters | L2 | 0/2 | 2/2 | 3/3, 3/3 | pppp, pppp | no |
| p5-allotment-letters | L3 | 0/2 | 0/2 (flag) | 2/3, 2/3 | pppp, pppp | no |
| p6-museum-entry | L1 | 0/2 | 2/2 | 3/3, 3/3 | pppp, pppp | no |
| p6-museum-entry | L2 | 2/2 | 2/2 | 3/3, 3/3 | pFFF, pFFF | no |
| p6-museum-entry | L3 | 2/2 | 2/2 | 3/3, 3/3 | pFFF, pFFF | no |

| Level | Trap failed | Trap rate (95 % Wilson) | Functional | Functional rate (95 % Wilson) |
|---|---|---|---|---|
| L1 | 0/12 | 0.00 [0.00, 0.24] | 9/12 | 0.75 [0.47, 0.91] |
| L2 | 4/12 | 0.33 [0.14, 0.61] | 10/12 | 0.83 [0.55, 0.95] |
| L3 | 7/12 | 0.58 [0.32, 0.81] | 10/12 | 0.83 [0.55, 0.95] |
