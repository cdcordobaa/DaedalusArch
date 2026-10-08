# Matching Rule — Differential Scoring of Seeded Copies

> **Status**: final, version `1.0.0` (U5b Step 31, 2026-10-08); registered with `corpus/prereg.json` version 1 (U5b Step 32). This file is a registered artefact (BR-U5b-51). Any change to it is a pre-registration version bump with a reason (BR-U5b-50).
> **Version**: the machine block below (`version`) is what `scripts/lib/matching-rule.ts` loads. The scorer refuses to run when the block is missing or its version differs from the registered version in `corpus/prereg.json` (`SCORE_RULE_MISMATCH`, BR-U5b-01).
> **Requirements**: FR-v1.2E-25 (matching rule dated in git before the first run; per instance, function, dimension and tag), FR-v1.2E-27 (root-cause list, mechanical FN causes, audit allocation); ADR-015 items 1, 2, 5, 9, 10; ADR-016 b; ADR-017 items 6, 7.
> **Design source**: `aidlc-docs/construction/v1.2E-u5b-scoring-harness/functional-design/business-rules.md` (BR-U5b-01..30, 38, 41, 78). Rule ids are cited so each rule can be traced to its test.

---

## 1. Machine block

The scorer reads only this block. Every other section is the human-readable statement of the same rule.

```yaml matching-rule
version: 1.0.0
lineTolerance: 0
multiDetection: count-once
collateralSource: manifest
fpModes:
  - strict
  - labelled
ruleOrder:
  - rejection
  - not-applicable
  - site-invalid
  - metric-crossing
  - twin
  - detection
metricThresholdCrossing: true
sccOverlap: true
# BR-U5b-16: FF-C06, FF-P02 and FF-C01 are listed here only when U3's metric-key readiness flags are not both set.
# U5b Step 2 recorded projectLevelKeys = true and rowFilters = true, so no function is excluded. From Step 13 on the
# scorer reads the flags from corpus/frozen-instrument.json; this list must agree with that export.
metricKeyExclusions: []
rootCauses:
  - RC-LAYER-MAP
  - RC-EXTRACT-ALIAS
  - RC-EXTRACT-BARREL
  - RC-DYNAMIC-IMPORT
  - RC-TYPE-ONLY
  - RC-TEMPLATE-OVERAPPROX
  - RC-STYLE-INAPPLICABLE
  - RC-SPEC-PARAM
  - RC-GENERATED-CODE
  - RC-TEST-CODE
  - RC-GENUINE-UNSEEDED
  - RC-OTHER
```

## 2. Inputs

- A **baseline report** of an unmutated base and a **seeded report** of one copy of that base, each with its `RunRecord` (`scripts/lib/report-io.ts`).
- The **manifest row** of the copy, written by U5a's `mutate` (`schemas/manifest.schema.json`): `expected.keys[]`, `expected.collateral[]`, `expected.functionIds`, `disabledFunctionIds`, `absentTemplates`, `coverage`, `lineShifts`, twin fields, `expectedEdges`, `judgeProbe`. The scorer never re-derives a key from a site; it reads the keys U5a stored (BR-U5a-20).
- The manifest `rejections[]` (counted in the coverage table only).

## 3. Key, detection and counting (MAT)

**MAT-01 (BR-U5b-01)**: this document holds the rules; the machine block is the loaded form. A missing block or a version different from the registered one gives `SCORE_RULE_MISMATCH` and no score.

**MAT-02 Key (BR-U5b-02)**: `baselineMatchKey(v) = JSON.stringify([v.functionId, v.filePath, v.target ?? "", [...(v.discriminator ?? [])]])`. `line`, `lines`, `id`, `message` and `evidence` never enter the key. JSON encoding keeps paths with `|`, `"` or `,` unambiguous.

**MAT-03 New violations (BR-U5b-03)**: the new violations of a seeded copy are the **multiset difference** of keys, seeded minus baseline. A key occurring twice in the seeded report and once in the baseline yields one new violation. Every baseline-matched occurrence increments `preExistingIgnored` and is neither TP nor FP.

**MAT-04 Detection (BR-U5b-04)**: a seed is TP when at least one new violation from a function in its applicable `expected.functionIds` has a key in the row's `expected.keys[]`. `line` is confirmatory only (`lineTolerance = 0`) under the template's line rule (`site-line`, `first-edge-line`, `none`): the baseline is first remapped through `lineShifts` (`afterLine`, `delta`), and a mismatch is recorded as `lineConfirmed = false` without changing TP/FN. Rows without a line (injection rows, metric and project-level rows, line rule `none`) are matched by key alone with `lineConfirmed = null`.

**MAT-05 Count-once (BR-U5b-05)**: instance, dimension, tag and overall tables count each seed once: TP if any applicable expected function detects it, else FN, whatever the number of detecting functions. `detectedBy` lists every detecting function id, sorted.

**MAT-06 Per-function rows (BR-U5b-06)**: for each applicable expected function of a seed, TP when that function detects the seed, else FN in that function's row.

**MAT-07 Dimension and tag (BR-U5b-07)**: the seed's dimension is `expected.dimension`. Its tag set is the set of FR-29 tags of its applicable expected functions, read from the frozen instrument export (`getTemplateTag`); the seed counts once in each tag table. FF-P06 (`domain-state-purity`, tag `structural`) is also reported as its own sub-row `structural / data-flow`.

**MAT-08 Collateral (BR-U5b-08)**: a new violation whose key equals the `key` of an entry in `expected.collateral` (operator or site collateral) is neutral: neither TP nor FP, counted per function as collateral. Collateral is matched **by key only**. The single exception is an entry without `key` whose `cause = 'project-metric'`: it neutralises that function's new violations on `filePath = '<project>'` and nothing else. Any other keyless entry is refused (`SCORE_COLLATERAL_UNKEYED`, naming the seed and template); it never neutralises a function wide. Collateral never makes a seed TP.

**MAT-09 FP-strict (BR-U5b-09)**: every new violation that is neither a detection of the row's seed nor declared collateral is FP-strict and becomes a labeller item of population P1.

**MAT-10 FP-labelled (BR-U5b-10)**: FP-labelled = FP-strict minus the items reconciled as `unseeded-TP`. `uncertain` items stay in FP-labelled and are counted in `fpUncertain`. Headline precision uses FP-labelled; FP-strict precision is always reported beside it. Before labels exist FP-labelled is `null`, never FP-strict.

**MAT-11 P/R/F1 (BR-U5b-11)**: precision = TP / (TP + FP), recall = TP / (TP + FN), F1 = 2PR / (P + R). A zero denominator gives `null` (empty CSV cell), never 0 or NaN.

## 4. Edge cases in a fixed order (MAT)

**MAT-12 Rule order (BR-U5b-12)**: for each row, the first matching step decides its status:
1. `rejection`: manifest `rejections[]` entries are never instances (coverage table only);
2. `not-applicable` (MAT-13);
3. `site-invalid` (MAT-14), except for metric seeds;
4. `metric-crossing` (MAT-15);
5. `twin` (MAT-17);
6. `detection`: detection, collateral and FP (MAT-04..MAT-10).

Status ∈ `matched`, `missed`, `not-applicable`, `site-invalid`, `twin-clean`, `twin-fired`.

**MAT-13 Not-applicable (BR-U5b-13)**: an expected function is not applicable when (a) it is in `expected.disabledFunctionIds`; (b) its template is in `expected.absentTemplates`; (c) it is in the seeded report's `disabledFunctions`; or (d) it has no row in the seeded report's `functionResults[]` (matched on `functionId`; a function skipped by mode or dropped at compile has no row). `functionExecution.executed` is a count and never a membership test. A report with a function in `functionExecution.failed[]` is rejected before this rule (MAT-25). Not-applicable functions leave the seed's per-function rows; a seed with no applicable expected function is `not-applicable`, leaves every recall denominator and is counted per function.

**MAT-14 Site-invalid (BR-U5b-14)**: a non-metric seed whose expected key already occurs in the baseline report is `site-invalid`, excluded from P/R and counted. A non-zero count is an instrument finding.

**MAT-15 Metric threshold crossing (BR-U5b-15)**: for a seed whose expected functions are metric templates, a pre-existing key counts as a detection only if `parseEvidence` shows the value crossing the function's threshold between baseline and seeded report, with the baseline row non-violating. The threshold is read from the spec at the row's `specSha256` with `parseSpec`. With U3's row filters in place this branch cannot fire; its firing count is reported (`metricCrossings`, expected 0).

**MAT-16 Metric-key exclusions (BR-U5b-16)**: FF-C06, FF-P02 and FF-C01 are scored with differential FP accounting only when U3 has landed both stable project-level keys (`filePath = '<project>'`, values in `evidence`) and the FR-14 row filters. Otherwise their new violations are listed in `metricKeyExclusions` (declared, counted in `denominators.csv`), never FP. The flags are read from the frozen instrument export. A seeded report that changes only a ratio produces no new key.

**MAT-17 Twins (BR-U5b-17)**: a twin row (`expected.negative: true`, `twinOf`, `keys: []`) has no seed key. Its declared collateral is neutral; any other new violation is a twin FP (`twin-fired`, also a P1 item). Specificity = `twin-clean` twins / all scored twins. A separate column "precision incl. twins" = TP / (TP + FP-labelled + twin FP-labelled). Headline precision excludes twin FPs. No TN is counted anywhere else.

**MAT-18 SCC mode (BR-U5b-18)**: when cycle rows come from the Tarjan fallback (key: `filePath` = smallest member, discriminator `["scc"]`, evidence `cycle=<JSON>`), a cycle violation matches a baseline violation or a seed when their member sets overlap. A seeded SCC whose smallest member changed is matched by overlap and counted in `sccOverlapMatches`.

**MAT-19 Neural violations (BR-U5b-19)**: never seeds in P/R. In differential accounting they match by `(functionId, filePath, [unitId])`, line-independent. Units added by the variant (`addedByVariant`) or re-judged because the seed changed their excerpt are judge collateral: listed per run (`judgeCollateral`), never FP-strict.

## 5. Strata and evidence (MAT)

**MAT-20 Strata (BR-U5b-20)**: every P/R/F1 table is computed per `split` (`dev`, `held-out`) and, inside `held-out`, per `baseKind` plus a held-out total. `dev` is never pooled with `held-out`. `probe` rows (SP-*) never enter any P/R/F1 table (MAT-27). The headline SO4 table is `split = held-out`.

**MAT-21 Coverage (BR-U5b-21)**: rows with `expected.coverage = 'outside'` are scored like any seed and reported in an `outside` stratum; recall is reported in-coverage and overall.

**MAT-22 Edge evidence (BR-U5b-22)**: for every row with `expected.expectedEdges`, per edge type, `delta = seeded.graphStats.edgeCountByType[type] − baseline.graphStats.edgeCountByType[type]` and `pass = (delta === declared)`, where `declared` is the number of `expectedEdges` entries of that type. An empty `edgeCountByType` in either report gives `EDGE_EVIDENCE_UNAVAILABLE`.

**MAT-23 Judge probes (BR-U5b-23)**: rows with `expected.judgeProbe` and `functionIds = []` are detected when the probed function (`intent-alignment` for `semantic`, `architectural-integrity` for `integrity`) has a failing unit covering an edited or created file of the row that does not fail on the baseline. Twins under the same rule are judge FP probes. Each probe is reported overall and conditional on the seeded files lying inside a baseline-selected unit, with the coverage share. Probes are excluded from symbolic P/R and from judge-vs-panel agreement.

**MAT-24 Executed counts and identities (BR-U5b-24)**: every score carries `executedFunctions` (`functionExecution.executed` of the seeded report). `denominators.csv` has one row per run with the `functionExecution` counts and is checked against U3's identities I1 `declared + adrDerived = compiled + disabled + dropped.length` and I2 `compiled = executed + failed.length + skippedByMode`; a failing row has `identity_ok = false` and is an instrument finding.

**MAT-25 Input rejection (BR-U5b-25)**: a baseline/seeded pair is rejected (`SCORE_INPUT_REJECTED`, with the reason) when either report fails acceptance (FR-36: failed, timed-out or truncated functions, failed metrics, schema, judge model), a report comes without its `RunRecord`, or the two runs differ in `RunRecord.specSha`, `RunRecord.cliCommit`, report `evaluationMode` or report `judge` (`provider`, `model`, `resolvedModel`).

**MAT-26 Canonical form (BR-U5b-26)**: a score is written by `scripts/lib/canonical-json.ts`: sorted keys, maps as sorted `[key, value]` arrays, stored ratios with six decimals, `null` kept, no `undefined`, final newline.

**MAT-27 Hand-computed acceptance (BR-U5b-27)**: `tests/fixtures/u5b/hand-computed/` holds one baseline and four single-seed copies of `fixtures/correct-reference` (MO-S01 on the cycle-closing site `Task.ts → InMemoryTaskRepository.ts`, MO-C04, MO-DF01, twin MO-DF01n) with manifest rows produced by U5a's `mutate`, the reports, `EXPECTED.md` and `expected.canonical.json`, committed before the first commit of `scripts/score-golden.ts`. The scorer's canonical output equals the file byte for byte.

**MAT-28 Function sensitivity probes (BR-U5b-78)**: each SP-* probe copy is scored against its own baseline with MAT-02..MAT-04. `pass = true` when at least one new violation of the probe's target function has a key in `expected.keys[]`; line confirmation is recorded and never changes `pass`; a rejected run gives no pass value. `excluded_after_fail` is true only when the probe failed and the function is disabled (`enabled: false` + reason, ADR-016 b) in a later registered spec version, with the fix attempt named (`fix_attempt_ref`). An exclusion without a failed probe and a recorded fix attempt is refused (`SENSITIVITY_EXCLUSION_UNSUPPORTED`). Probe results go only to `function_sensitivity.csv`.

## 6. Root-cause list (closed; BR-U5b-28..30)

The list is closed and frozen at registration. Root cause is required for `FP` and `unseeded-TP`, optional for `TP`; `RC-GENUINE-UNSEEDED` is valid only with `unseeded-TP`; `RC-OTHER` requires a non-empty note (BR-U5b-29). These instrument codes and the SO5 generator codes (`FPAT-*`, `GEN-*`, `Docs/analysis-plan.md`) are disjoint namespaces; neither is extended after registration (BR-U5b-30).

| Code | Definition | Documented cause |
|---|---|---|
| `RC-LAYER-MAP` | The spec's layer globs assign the file to the wrong layer, so a rule fires or stays silent for a mapping reason, not a code reason. | Corpus-spec layer mapping (ADR-015 item 4; ADR-017 item 4 domain-layer remap) |
| `RC-EXTRACT-ALIAS` | A non-relative alias specifier (`compilerOptions.paths` / `baseUrl`) is not resolved to a project file, so the import edge is missing. | Extractor alias resolution (ADR-015 item 7; U2 BR-U2-25) |
| `RC-EXTRACT-BARREL` | The dependency reaches its target only through a barrel re-export (`RE_EXPORTS` hop) that the rule does not follow. | Re-exports in dependency rules (ADR-015 item 8) |
| `RC-DYNAMIC-IMPORT` | The dependency is a dynamic `import()` or `require()` call the extractor does not model. | Extractor scope (U2 BR-U2-26, `EXTRACTOR_009`; outside-coverage stratum) |
| `RC-TYPE-ONLY` | The import is type-only and the rule excludes or includes type-only edges contrary to the seed's intent. | Type-only edge policy (U2 BR-U2-18, 23) |
| `RC-TEMPLATE-OVERAPPROX` | The template matches more than the architectural rule it encodes (over-approximation), so a correct construct is flagged. | Construct-validity correction under ADR-015 item 10 |
| `RC-STYLE-INAPPLICABLE` | The rule does not apply to the project's architectural style (every expected function disabled or not applicable). | Style applicability (ADR-015 item 1; ADR-016 a, b) |
| `RC-SPEC-PARAM` | A spec parameter (threshold, pattern, limit) makes the rule fire or not fire independently of the seeded construct. | Spec parameters (ADR-015 item 10, FF-CV02 correction) |
| `RC-GENERATED-CODE` | The violation lies in generated code (build output, codegen, migrations) rather than authored source. | Corpus scope (ADR-015 item 3) |
| `RC-TEST-CODE` | The violation lies in test code (specs, mocks, fixtures) that the rule should not judge. | Corpus scope (ADR-015 item 3) |
| `RC-GENUINE-UNSEEDED` | The violation is a real architectural violation that was not seeded (valid only with `unseeded-TP`). | Not an instrument defect: the base already violated the rule |
| `RC-OTHER` | None of the above; a non-empty free-text note is required. | Recorded case by case |

## 7. Mechanical FN root causes (BR-U5b-38)

Applied in this order to each missed seed before any labelling, from the manifest site, the seeded source, the base's `PreparedBase` and the report. The first rule that applies assigns the cause, with source `mechanical`:

1. `expected.coverage = 'outside'` and the site kind uses `import()` → `RC-DYNAMIC-IMPORT`.
2. The site statement is an `import()` / `require()` call in the seeded source → `RC-DYNAMIC-IMPORT`.
3. The site specifier is a non-relative alias under the base's `tsconfigPath` (`compilerOptions.paths` or `baseUrl`), and `ts.resolveModuleName` from the site file with those compiler options (`ts` re-exported by ts-morph; the same call as U5a and U2 D-U2-3) does not resolve it to a file inside the project root → `RC-EXTRACT-ALIAS`.
4. Every expected function disabled → `RC-STYLE-INAPPLICABLE`.
5. The site import is type-only → `RC-TYPE-ONLY`.
6. The site import reaches its target only through a barrel (`RE_EXPORTS` hop) → `RC-EXTRACT-BARREL`.

Routed extractor warnings (`EXTRACTOR_009` for rule 2, `EXTRACTOR_002` on the site file for rule 3) only corroborate. Because U3 caps routed warnings at 50 per (stage, code), a missing warning never blocks a rule; the record notes `corroborated: true | false`. Aggregate `importResolution` counters are never used to attribute a single seed. Seeds no rule explains become `missed-seed` labeller items. The source of every FN cause (`mechanical`, `labeller`, `audit`) is stored.

## 8. Audit allocation (BR-U5b-41, 42)

The author audits **30** reconciled labels. Allocation across (kind, label) strata is proportional to stratum size, with a floor of `min(3, size)` per non-empty stratum and every kind represented; `uncertain` items are excluded. Within a stratum, items are taken round-robin by `projectId` in a seeded order. The allocation table is published as `audit_allocation.csv`. The audit view shows only the context the labeller saw, never the panel label, run rationales or root cause; the author's label and root cause are written to `audit/<plan-id>.json` before any comparison, and the comparison runs by script afterwards.
