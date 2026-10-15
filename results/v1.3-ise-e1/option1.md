# ISE on E1: Option 1 self-deviations (POST-HOC, exploratory; scripts/v1.3/ise-e1-option1.ts)

Per spec level × model: cells; for each rule kind (applying rules only), `partial/applying` = applying rules with support below 1 (followed by the majority but broken somewhere in the same cell) over all applying rules, and the deviating instances over all instances; then the cells with at least one partial rule outside `framework-free`, and the pooled self-deviation rate outside `framework-free`.

| Spec level | Model | Cells | direction partial/applying (dev/inst) | acyclic partial/applying (dev/inst) | inject-interfaces partial/applying (dev/inst) | implements-port partial/applying (dev/inst) | framework-free partial/applying (dev/inst) | decorator-free partial/applying (dev/inst) | Cells with a partial rule (excl. framework-free) | Self-deviation rate (excl. framework-free) |
|---|---|---|---|---|---|---|---|---|---|---|
| none | haiku-4-5 | 3 | 0/12 (0/33) | 0/3 (0/25) | 0/1 (0/1) | 0/0 (0/0) | 0/8 (0/19) | 0/5 (0/12) | 0/3 | 0.000 |
| none | opus-5-5 | 6 | 0/18 (0/124) | 0/6 (0/66) | 0/6 (0/35) | 0/6 (0/15) | 6/18 (6/66) | 0/18 (0/80) | 0/6 | 0.000 |
| none | sonnet-5-5 | 6 | 0/18 (0/63) | 0/6 (0/46) | 0/3 (0/10) | 0/6 (0/15) | 6/18 (6/46) | 0/18 (0/39) | 0/6 | 0.000 |
| none | gpt-5.6-terra | 6 | 0/18 (0/45) | 0/6 (0/38) | 0/4 (0/8) | 0/4 (0/8) | 5/17 (5/36) | 0/17 (0/30) | 0/6 | 0.000 |
| **none** | **all** | 21 | 0/66 (0/265) | 0/21 (0/175) | 0/14 (0/54) | 0/16 (0/38) | 17/61 (17/167) | 0/58 (0/161) | 0/21 | 0.000 |
| minimal-prose | haiku-4-5 | 4 | 0/16 (0/129) | 0/4 (0/80) | 1/1 (6/15) | 0/4 (0/10) | 0/12 (0/58) | 0/12 (0/53) | 1/4 | 0.021 |
| minimal-prose | opus-5-5 | 6 | 0/18 (0/303) | 0/6 (0/205) | 5/5 (20/66) | 0/6 (0/15) | 3/15 (13/165) | 0/18 (0/154) | 5/6 | 0.027 |
| minimal-prose | sonnet-5-5 | 6 | 0/18 (0/266) | 0/6 (0/154) | 3/3 (18/55) | 0/6 (0/15) | 0/12 (0/96) | 0/18 (0/115) | 3/6 | 0.030 |
| minimal-prose | gpt-5.6-terra | 6 | 0/18 (0/93) | 0/6 (0/63) | 6/6 (9/28) | 0/6 (0/15) | 0/12 (0/44) | 0/18 (0/65) | 6/6 | 0.034 |
| **minimal-prose** | **all** | 22 | 0/70 (0/791) | 0/22 (0/502) | 15/15 (53/164) | 0/22 (0/55) | 3/51 (13/363) | 0/66 (0/387) | 15/22 | 0.028 |
| full-aac | haiku-4-5 | 4 | 0/15 (0/125) | 0/4 (0/78) | 1/2 (5/27) | 0/4 (0/10) | 0/11 (0/53) | 0/12 (0/59) | 1/4 | 0.017 |
| full-aac | opus-5-5 | 6 | 0/18 (0/290) | 0/6 (0/236) | 2/6 (9/79) | 0/6 (0/15) | 3/15 (14/191) | 0/18 (0/144) | 2/6 | 0.012 |
| full-aac | sonnet-5-5 | 6 | 0/18 (0/243) | 0/6 (0/160) | 3/3 (14/43) | 0/6 (0/15) | 1/13 (4/109) | 0/18 (0/101) | 3/6 | 0.025 |
| full-aac | gpt-5.6-terra | 6 | 0/18 (0/128) | 0/6 (0/80) | 4/6 (9/39) | 0/6 (0/15) | 1/13 (1/58) | 0/18 (0/66) | 4/6 | 0.027 |
| **full-aac** | **all** | 22 | 0/69 (0/786) | 0/22 (0/554) | 10/17 (37/188) | 0/22 (0/55) | 5/52 (19/411) | 0/66 (0/370) | 10/22 | 0.019 |

## Partial rules per cell (support < 1, excl. framework-free)

- **claude-opus-5-5_task-management_minimal-prose_run-0**: inject-interfaces: 11/14 cross-unit constructor injections target an interface [3 dev]
- **claude-opus-5-5_task-management_minimal-prose_run-1**: inject-interfaces: 10/19 cross-unit constructor injections target an interface [below 0.6: no majority, not a rule]
- **claude-opus-5-5_task-management_minimal-prose_run-2**: inject-interfaces: 8/12 cross-unit constructor injections target an interface [4 dev]
- **claude-opus-5-5_order-fulfilment_minimal-prose_run-0**: inject-interfaces: 10/14 cross-unit constructor injections target an interface [4 dev]
- **claude-opus-5-5_order-fulfilment_minimal-prose_run-1**: inject-interfaces: 11/16 cross-unit constructor injections target an interface [5 dev]
- **claude-opus-5-5_order-fulfilment_minimal-prose_run-2**: inject-interfaces: 6/10 cross-unit constructor injections target an interface [4 dev]
- **claude-opus-5-5_task-management_full-aac_run-2**: inject-interfaces: 9/15 cross-unit constructor injections target an interface [6 dev]
- **claude-opus-5-5_order-fulfilment_full-aac_run-0**: inject-interfaces: 6/9 cross-unit constructor injections target an interface [3 dev]
- **claude-sonnet-5-5_task-management_minimal-prose_run-0**: inject-interfaces: 12/18 cross-unit constructor injections target an interface [6 dev]
- **claude-sonnet-5-5_task-management_minimal-prose_run-1**: inject-interfaces: 12/18 cross-unit constructor injections target an interface [6 dev]
- **claude-sonnet-5-5_task-management_minimal-prose_run-2**: inject-interfaces: 13/19 cross-unit constructor injections target an interface [6 dev]
- **claude-sonnet-5-5_order-fulfilment_minimal-prose_run-0**: inject-interfaces: 6/13 cross-unit constructor injections target an interface [below 0.6: no majority, not a rule]
- **claude-sonnet-5-5_order-fulfilment_minimal-prose_run-1**: inject-interfaces: 7/15 cross-unit constructor injections target an interface [below 0.6: no majority, not a rule]
- **claude-sonnet-5-5_order-fulfilment_minimal-prose_run-2**: inject-interfaces: 7/15 cross-unit constructor injections target an interface [below 0.6: no majority, not a rule]
- **claude-sonnet-5-5_task-management_full-aac_run-0**: inject-interfaces: 10/16 cross-unit constructor injections target an interface [6 dev]
- **claude-sonnet-5-5_task-management_full-aac_run-1**: inject-interfaces: 10/12 cross-unit constructor injections target an interface [2 dev]
- **claude-sonnet-5-5_task-management_full-aac_run-2**: inject-interfaces: 9/15 cross-unit constructor injections target an interface [6 dev]
- **claude-sonnet-5-5_order-fulfilment_full-aac_run-0**: inject-interfaces: 8/14 cross-unit constructor injections target an interface [below 0.6: no majority, not a rule]
- **claude-sonnet-5-5_order-fulfilment_full-aac_run-1**: inject-interfaces: 5/12 cross-unit constructor injections target an interface [below 0.6: no majority, not a rule]
- **claude-sonnet-5-5_order-fulfilment_full-aac_run-2**: inject-interfaces: 6/15 cross-unit constructor injections target an interface [below 0.6: no majority, not a rule]
- **claude-haiku-4-5_order-fulfilment_none_run-0**: inject-interfaces: 0/7 cross-unit constructor injections target an interface [below 0.6: no majority, not a rule]
- **claude-haiku-4-5_order-fulfilment_none_run-1**: inject-interfaces: 0/2 cross-unit constructor injections target an interface [below 0.6: no majority, not a rule]
- **claude-haiku-4-5_task-management_minimal-prose_run-0**: inject-interfaces: 7/12 cross-unit constructor injections target an interface [below 0.6: no majority, not a rule]
- **claude-haiku-4-5_task-management_minimal-prose_run-2**: inject-interfaces: 9/15 cross-unit constructor injections target an interface [6 dev]
- **claude-haiku-4-5_order-fulfilment_minimal-prose_run-1**: inject-interfaces: 7/12 cross-unit constructor injections target an interface [below 0.6: no majority, not a rule]
- **claude-haiku-4-5_order-fulfilment_minimal-prose_run-2**: inject-interfaces: 7/14 cross-unit constructor injections target an interface [below 0.6: no majority, not a rule]
- **claude-haiku-4-5_task-management_full-aac_run-2**: inject-interfaces: 7/13 cross-unit constructor injections target an interface [below 0.6: no majority, not a rule]
- **claude-haiku-4-5_order-fulfilment_full-aac_run-0**: inject-interfaces: 7/15 cross-unit constructor injections target an interface [below 0.6: no majority, not a rule]
- **claude-haiku-4-5_order-fulfilment_full-aac_run-2**: inject-interfaces: 8/13 cross-unit constructor injections target an interface [5 dev]
- **gpt-5.6-terra_task-management_minimal-prose_run-0**: inject-interfaces: 3/4 cross-unit constructor injections target an interface [1 dev]
- **gpt-5.6-terra_task-management_minimal-prose_run-1**: inject-interfaces: 3/4 cross-unit constructor injections target an interface [1 dev]
- **gpt-5.6-terra_task-management_minimal-prose_run-2**: inject-interfaces: 4/5 cross-unit constructor injections target an interface [1 dev]
- **gpt-5.6-terra_order-fulfilment_minimal-prose_run-0**: inject-interfaces: 3/5 cross-unit constructor injections target an interface [2 dev]
- **gpt-5.6-terra_order-fulfilment_minimal-prose_run-1**: inject-interfaces: 3/5 cross-unit constructor injections target an interface [2 dev]
- **gpt-5.6-terra_order-fulfilment_minimal-prose_run-2**: inject-interfaces: 3/5 cross-unit constructor injections target an interface [2 dev]
- **gpt-5.6-terra_task-management_full-aac_run-1**: inject-interfaces: 3/4 cross-unit constructor injections target an interface [1 dev]
- **gpt-5.6-terra_task-management_full-aac_run-2**: inject-interfaces: 11/16 cross-unit constructor injections target an interface [5 dev]
- **gpt-5.6-terra_order-fulfilment_full-aac_run-0**: inject-interfaces: 3/5 cross-unit constructor injections target an interface [2 dev]
- **gpt-5.6-terra_order-fulfilment_full-aac_run-1**: inject-interfaces: 2/3 cross-unit constructor injections target an interface [1 dev]
