# L1 per-snapshot coverage of generated code

Bar (TRUST-01 L1): unmapped ≤ 10 % and no unparsed file. Barrels, `require`, `import()` and files the extractor does not read are counted, not barred.

## results/v1.3-floor-probe

| Generator | Arm | Snapshots | Pass | Fail | No data | Mean unmapped | Max unmapped | Unparsed | Not extracted | Barrels | require | import() | Non-literal |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| opus-by-hand | none | 28 | 28 | 0 | 0 | 0.0 % | 0.0 % | 0 | 0 | 0 | 0 | 0 | 0 |
| opus-by-hand | tool | 28 | 28 | 0 | 0 | 0.0 % | 0.0 % | 0 | 0 | 0 | 0 | 0 | 0 |

## results/v1.3-floor-probe-2

| Generator | Arm | Snapshots | Pass | Fail | No data | Mean unmapped | Max unmapped | Unparsed | Not extracted | Barrels | require | import() | Non-literal |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| opus-by-hand | C1 | 8 | 8 | 0 | 0 | 0.0 % | 0.0 % | 0 | 0 | 0 | 0 | 0 | 0 |
| opus-by-hand | C2 | 8 | 1 | 7 | 0 | 37.2 % | 66.7 % | 0 | 0 | 0 | 0 | 0 | 0 |
| opus-by-hand | C3 | 8 | 8 | 0 | 0 | 3.7 % | 10.0 % | 0 | 0 | 0 | 0 | 0 | 0 |

Snapshots not passing:

- `market-vendors/C2/step-01`: fail (unmapped 15.4 % > 10 %)
- `market-vendors/C2/step-02`: fail (unmapped 11.8 % > 10 %)
- `market-vendors/C2/step-03`: fail (unmapped 11.1 % > 10 %)
- `shelter-adoptions/C2/step-01`: fail (unmapped 66.7 % > 10 %)
- `shelter-adoptions/C2/step-02`: fail (unmapped 61.5 % > 10 %)
- `shelter-adoptions/C2/step-03`: fail (unmapped 61.1 % > 10 %)
- `shelter-adoptions/C2/step-04`: fail (unmapped 60.9 % > 10 %)

## experiments/loop-pilot/run-2026-10-16/outputs

| Generator | Arm | Snapshots | Pass | Fail | No data | Mean unmapped | Max unmapped | Unparsed | Not extracted | Barrels | require | import() | Non-literal |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| claude-code-cli/claude-sonnet-5-5 | gate | 12 | 12 | 0 | 0 | 2.3 % | 7.1 % | 0 | 0 | 0 | 0 | 0 | 0 |
| claude-code-cli/claude-sonnet-5-5 | none | 12 | 12 | 0 | 0 | 2.5 % | 8.3 % | 0 | 0 | 0 | 0 | 0 | 0 |
