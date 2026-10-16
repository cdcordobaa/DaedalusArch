| Label | Rows | Confirm (grounded) | Dismiss (grounded) | Rejected (ungrounded) | Invalid |
|---|---|---|---|---|---|
| true | 66 | 65/66 = 0.98 [0.92, 1.00] | 1/66 = 0.02 [0.00, 0.08] | 0 | 0 |
| false | 2 | 1/2 = 0.50 [0.09, 0.91] | 1/2 = 0.50 [0.09, 0.91] | 0 | 0 |
| unscored | 241 | 51/241 = 0.21 [0.16, 0.27] | 190/241 = 0.79 [0.73, 0.84] | 0 | 0 |

Scored rows: precision before 66/68 = 0.97 [0.90, 0.99], after 65/66 = 0.98 [0.92, 1.00] (gain 0.014); recall kept 65/66 = 0.98 [0.92, 1.00] (recall loss 1/66 = 0.02 [0.00, 0.08]).
Grounding: 309/309 = 1.00 [0.99, 1.00] of the valid answers grounded; invalid answers 0.
Distinct prompts: 114; grounded 114/114 = 1.00 [0.97, 1.00].

| Tier | Rows | Confirm | Dismiss | Rejected |
|---|---|---|---|---|
| advisory | 8 | 7 | 1 | 0 |
| advisory (unscored) | 249 | 58 | 191 | 0 |
| blocking | 52 | 52 | 0 | 0 |

| Rule | Label | Rows | Confirm | Dismiss | Rejected |
|---|---|---|---|---|---|
| FF-C01 | unscored | 3 | 3 | 0 | 0 |
| FF-C02 | unscored | 30 | 0 | 30 | 0 |
| FF-C03 | unscored | 120 | 4 | 116 | 0 |
| FF-CV03 | unscored | 2 | 0 | 2 | 0 |
| FF-CV05 | unscored | 86 | 44 | 42 | 0 |
| FF-DS01 | true | 1 | 1 | 0 | 0 |
| FF-DS02 | true | 2 | 2 | 0 | 0 |
| FF-DT01 | true | 1 | 1 | 0 | 0 |
| FF-DT02 | true | 1 | 1 | 0 | 0 |
| FF-DT03 | true | 2 | 2 | 0 | 0 |
| FF-DT04 | true | 1 | 1 | 0 | 0 |
| FF-DT05 | true | 1 | 1 | 0 | 0 |
| FF-DT06 | true | 1 | 1 | 0 | 0 |
| FF-P01 | true | 7 | 7 | 0 | 0 |
| FF-P02 | false | 1 | 0 | 1 | 0 |
| FF-P02 | true | 3 | 3 | 0 | 0 |
| FF-P03 | true | 4 | 4 | 0 | 0 |
| FF-P04 | false | 1 | 1 | 0 | 0 |
| FF-P04 | true | 1 | 1 | 0 | 0 |
| FF-P06 | true | 3 | 3 | 0 | 0 |
| FF-S01 | true | 17 | 17 | 0 | 0 |
| FF-S02 | true | 5 | 5 | 0 | 0 |
| FF-S03 | true | 8 | 7 | 1 | 0 |
| FF-S04 | true | 8 | 8 | 0 | 0 |
