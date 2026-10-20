# L1 per-snapshot coverage of generated code

Bar (TRUST-01 L1): unmapped ≤ 10 % and no unparsed file. Barrels, `require`, `import()` and files the extractor does not read are counted, not barred.

## <shared>/daedalus-exploratory/stage-a

| Generator | Arm | Snapshots | Pass | Fail | No data | Mean unmapped | Max unmapped | Unparsed | Not extracted | Barrels | require | import() | Non-literal |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| claude-code-cli/claude-sonnet-5-5 | none | 15 | 15 | 0 | 0 | 0.0 % | 0.0 % | 0 | 0 | 0 | 0 | 0 | 0 |

## <shared>/daedalus-exploratory/r2

| Generator | Arm | Snapshots | Pass | Fail | No data | Mean unmapped | Max unmapped | Unparsed | Not extracted | Barrels | require | import() | Non-literal |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| claude-code-cli/claude-sonnet-5-5 | none | 15 | 14 | 1 | 0 | 0.0 % | 0.0 % | 1 | 0 | 0 | 0 | 0 | 0 |

Snapshots not passing:

- `runs/claude-code-cli/claude-sonnet-5-5/youth-league/none/run-1/step-03`: fail (1 unparsed file(s))

## <shared>/daedalus-exploratory/l3

| Generator | Arm | Snapshots | Pass | Fail | No data | Mean unmapped | Max unmapped | Unparsed | Not extracted | Barrels | require | import() | Non-literal |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| claude-code-cli/claude-sonnet-5-5 | none | 30 | 30 | 0 | 0 | 3.6 % | 10.0 % | 0 | 0 | 0 | 0 | 0 | 0 |

## <shared>/daedalus-exploratory/mcp

| Generator | Arm | Snapshots | Pass | Fail | No data | Mean unmapped | Max unmapped | Unparsed | Not extracted | Barrels | require | import() | Non-literal |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| claude-code-cli/claude-sonnet-5-5 | daedalus-mcp | 30 | 30 | 0 | 0 | 0.0 % | 0.0 % | 0 | 0 | 0 | 0 | 0 | 0 |
