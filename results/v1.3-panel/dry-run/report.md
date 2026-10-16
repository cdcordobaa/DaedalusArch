# v1.3 model panel: DRY RUN with fake raters (not a result)

Rule: **panel-authority-v1** (Docs/v1.3/model-panel.md §5). Verdict: **authoritative**.

Decoys in the run: 10 known-correct, 10 known-wrong. Qualified vendors: google:fake-gemini, openai:fake-gpt.

## 1. Rater accuracy on decoys

A rater qualifies with decoy accuracy ≥ 0.85, each class ≥ 0.7, valid labels on ≥ 0.9 of items. `uncertain` and invalid runs count as wrong. Intervals are 95% Wilson.

| Rater | Decoy accuracy | Known-correct (`yes`) | Known-wrong (`no`) | Decoys `uncertain` | Valid items | Runs disagree | Qualified |
|---|---|---|---|---|---|---|---|
| google:fake-gemini | 0.950 (19/20) [0.764, 0.991] | 0.900 (9/10) [0.596, 0.982] | 1.000 (10/10) [0.722, 1.000] | 1 | 1.000 (40/40) [0.912, 1.000] | 0.075 (3/40) [0.026, 0.199] | yes |
| openai:fake-gpt | 0.850 (17/20) [0.640, 0.948] | 0.800 (8/10) [0.490, 0.943] | 0.900 (9/10) [0.596, 0.982] | 2 | 1.000 (40/40) [0.912, 1.000] | 0.075 (3/40) [0.026, 0.199] | yes |
| anthropic:fake-claude | 0.750 (15/20) [0.531, 0.888] | 0.700 (7/10) [0.397, 0.892] | 0.800 (8/10) [0.490, 0.943] | 4 | 1.000 (40/40) [0.912, 1.000] | 0.100 (4/40) [0.040, 0.231] | no: decoy accuracy 0.750 < 0.85 |

## 2. Pairwise agreement

Binary = `yes` vs not `yes`. Targets are the non-decoy items.

| Pair | Scope | n | Observed binary [95% Wilson] | κ binary | AC1 binary | κ three-way | AC1 three-way |
|---|---|---|---|---|---|---|---|
| google:fake-gemini – openai:fake-gpt | targets | 20 | 0.850 [0.640, 0.948] | 0.681 | 0.718 | 0.619 | 0.729 |
| google:fake-gemini – openai:fake-gpt | decoys | 20 | 0.800 [0.584, 0.919] | 0.596 | 0.604 | 0.648 | 0.721 |
| google:fake-gemini – anthropic:fake-claude | targets | 20 | 0.700 [0.481, 0.855] | 0.450 | 0.400 | 0.313 | 0.348 |
| google:fake-gemini – anthropic:fake-claude | decoys | 20 | 0.750 [0.531, 0.888] | 0.490 | 0.511 | 0.508 | 0.571 |
| openai:fake-gpt – anthropic:fake-claude | targets | 20 | 0.650 [0.433, 0.819] | 0.340 | 0.302 | 0.313 | 0.344 |
| openai:fake-gpt – anthropic:fake-claude | decoys | 20 | 0.650 [0.433, 0.819] | 0.286 | 0.315 | 0.355 | 0.422 |

### google:fake-gemini (rows) × openai:fake-gpt (columns), targets, three-way

| | yes | no | uncertain |
|---|---|---|---|
| yes | 11 | 0 | 2 |
| no | 0 | 5 | 0 |
| uncertain | 1 | 1 | 0 |

### google:fake-gemini (rows) × anthropic:fake-claude (columns), targets, three-way

| | yes | no | uncertain |
|---|---|---|---|
| yes | 7 | 3 | 3 |
| no | 0 | 3 | 2 |
| uncertain | 0 | 1 | 1 |

### openai:fake-gpt (rows) × anthropic:fake-claude (columns), targets, three-way

| | yes | no | uncertain |
|---|---|---|---|
| yes | 6 | 3 | 3 |
| no | 0 | 4 | 2 |
| uncertain | 1 | 0 | 1 |

## 3. Multi-rater agreement (targets)

Fleiss' κ over items every rater in the scope answered; Krippendorff's α (nominal) allows missing labels. The panel gate is Fleiss' κ binary among qualified vendors ≥ 0.6.

| Scope | Raters | Items (all answered) | Fleiss κ binary | Fleiss κ three-way | Krippendorff α binary | Krippendorff α three-way |
|---|---|---|---|---|---|---|
| all model raters | 3 | 20 | 0.464 | 0.387 | 0.473 | 0.397 |
| qualified vendors | 2 | 20 | 0.680 | 0.618 | 0.688 | 0.628 |

## 4. Panel labels on targets

An item is authoritative when ≥ 2 qualified vendors give the same definite label and it is a strict majority of the qualified vendors (and the panel verdict is not `no-panel`).

| Origin | Targets | Authoritative `yes` | Authoritative `no` | Unresolved | Authoritative and unanimous |
|---|---|---|---|---|---|
| wild | 20 | 11 | 5 | 4 | 16 |

## 5. Per item

Majority over all model raters (ties are `uncertain`) with its confidence (share of answering raters); the qualified majority is the panel label. Truth is shown for decoys only.

| Item | Origin | Source id | google:fake-gemini | openai:fake-gpt | anthropic:fake-claude | Majority (confidence) | Qualified majority (agree/voting) | Authoritative | Truth |
|---|---|---|---|---|---|---|---|---|---|
| P001 | decoy | c78933132f72 | yes | yes | yes | yes (1.000) | yes (2/2) | yes, unanimous | yes |
| P002 | wild | W04 | yes | yes | no | yes (0.667) | yes (2/2) | yes, unanimous |  |
| P003 | wild | W13 | yes | yes | uncertain | yes (0.667) | yes (2/2) | yes, unanimous |  |
| P004 | wild | W17 | uncertain | no | no | no (0.667) | uncertain (1/2) | no |  |
| P005 | wild | W01 | yes | uncertain | yes | yes (0.667) | uncertain (1/2) | no |  |
| P006 | decoy | e318c5be0e49 | yes | uncertain | yes | yes (0.667) | uncertain (1/2) | no | yes |
| P007 | decoy | 2d87ed773d7d | no | no | no | no (1.000) | no (2/2) | yes, unanimous | no |
| P008 | wild | W11 | no | no | no | no (1.000) | no (2/2) | yes, unanimous |  |
| P009 | wild | W09 | yes | yes | yes | yes (1.000) | yes (2/2) | yes, unanimous |  |
| P010 | decoy | 483590ce2234 | no | no | no | no (1.000) | no (2/2) | yes, unanimous | no |
| P011 | decoy | e6c66acddd19 | no | no | uncertain | no (0.667) | no (2/2) | yes, unanimous | no |
| P012 | decoy | 862748d9ea03 | yes | yes | uncertain | yes (0.667) | yes (2/2) | yes, unanimous | yes |
| P013 | decoy | 01d49cb2c3a8 | no | no | no | no (1.000) | no (2/2) | yes, unanimous | no |
| P014 | wild | W03 | no | no | no | no (1.000) | no (2/2) | yes, unanimous |  |
| P015 | wild | W02 | yes | uncertain | uncertain | uncertain (0.667) | uncertain (1/2) | no |  |
| P016 | decoy | 51bf86b54035 | yes | uncertain | yes | yes (0.667) | uncertain (1/2) | no | yes |
| P017 | decoy | bf4bbd088f5f | no | no | no | no (1.000) | no (2/2) | yes, unanimous | no |
| P018 | decoy | e22668719447 | uncertain | yes | yes | yes (0.667) | uncertain (1/2) | no | yes |
| P019 | decoy | 42a779e99920 | yes | yes | uncertain | yes (0.667) | yes (2/2) | yes, unanimous | yes |
| P020 | decoy | 0b6077bbf525 | no | yes | no | no (0.667) | uncertain (1/2) | no | no |
| P021 | decoy | 122c471430e6 | yes | yes | yes | yes (1.000) | yes (2/2) | yes, unanimous | yes |
| P022 | wild | W06 | no | no | uncertain | no (0.667) | no (2/2) | yes, unanimous |  |
| P023 | decoy | a11426f4e932 | yes | yes | yes | yes (1.000) | yes (2/2) | yes, unanimous | yes |
| P024 | decoy | a2e64767b1a2 | no | no | no | no (1.000) | no (2/2) | yes, unanimous | no |
| P025 | wild | W16 | uncertain | yes | uncertain | uncertain (0.667) | uncertain (1/2) | no |  |
| P026 | wild | W14 | yes | yes | yes | yes (1.000) | yes (2/2) | yes, unanimous |  |
| P027 | wild | W19 | yes | yes | yes | yes (1.000) | yes (2/2) | yes, unanimous |  |
| P028 | wild | W05 | yes | yes | no | yes (0.667) | yes (2/2) | yes, unanimous |  |
| P029 | decoy | 8e9b6caece54 | no | no | yes | no (0.667) | no (2/2) | yes, unanimous | no |
| P030 | wild | W12 | yes | yes | uncertain | yes (0.667) | yes (2/2) | yes, unanimous |  |
| P031 | wild | W10 | yes | yes | yes | yes (1.000) | yes (2/2) | yes, unanimous |  |
| P032 | wild | W07 | yes | yes | no | yes (0.667) | yes (2/2) | yes, unanimous |  |
| P033 | decoy | 755ce3350726 | no | no | no | no (1.000) | no (2/2) | yes, unanimous | no |
| P034 | decoy | f63d84a4f732 | yes | yes | yes | yes (1.000) | yes (2/2) | yes, unanimous | yes |
| P035 | wild | W15 | yes | yes | yes | yes (1.000) | yes (2/2) | yes, unanimous |  |
| P036 | decoy | c31f7b9547a0 | yes | yes | uncertain | yes (0.667) | yes (2/2) | yes, unanimous | yes |
| P037 | decoy | 9279bb132ffe | no | no | no | no (1.000) | no (2/2) | yes, unanimous | no |
| P038 | wild | W08 | yes | yes | yes | yes (1.000) | yes (2/2) | yes, unanimous |  |
| P039 | wild | W20 | no | no | uncertain | no (0.667) | no (2/2) | yes, unanimous |  |
| P040 | wild | W18 | no | no | no | no (1.000) | no (2/2) | yes, unanimous |  |

## 6. Calls and tokens

| Rater | Provider | Model | Calls | From cassette | Input tokens | Output tokens |
|---|---|---|---|---|---|---|
| google:fake-gemini | fake | fake-gemini | 84 | 84 | 31092 | 1600 |
| openai:fake-gpt | fake | fake-gpt | 84 | 84 | 31092 | 1600 |
| anthropic:fake-claude | fake | fake-claude | 80 | 80 | 30968 | 1600 |
