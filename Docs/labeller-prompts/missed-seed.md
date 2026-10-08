# Labeller prompt — missed-seed items (MS)

> **Requirements**: FR-v1.2E-27 (two pinned-model runs, root-cause codes from the fixed list, cassettes); BR-U5b-28, 29, 31, 32, 35, 36.
> **Status**: *draft until Step 32* (registered with the pre-registration, BR-U5b-51).

A deliberately introduced construct that the checker did not report (a false negative no mechanical rule explained) is labelled `FN` with the root cause of the miss.

`scripts/llm-label.ts` reads only the fenced machine block below. The prompt is rendered by replacing `{{context}}` with the item context built by `scripts/lib/label-context.ts` (source tree and item fields only, BR-U5b-35), `{{options}}` with the numbered label options and `{{rootCauses}}` with the numbered root-cause codes. Run 0 presents both lists in the canonical order below; run 1 presents them in a seeded permutation and the answer is mapped back to the canonical codes (BR-U5b-32). The answer is one JSON object `{"option": <number>, "rootCause": <number or null>, "note": <string>, "rationale": <string>}`. Validity (BR-U5b-29): the option must exist; a root cause is required for `FN`; `RC-GENUINE-UNSEEDED` only with `unseeded-TP`; `RC-OTHER` needs a non-empty note. An invalid answer is re-asked once, then recorded invalid.

## Root causes (closed list, `Docs/matching-rule.md` §6)

| Code | Definition |
|---|---|
| `RC-LAYER-MAP` | The spec's layer globs assign the file to the wrong layer, so a rule fires or stays silent for a mapping reason, not a code reason. |
| `RC-EXTRACT-ALIAS` | A non-relative alias specifier (`compilerOptions.paths` / `baseUrl`) is not resolved to a project file, so the import edge is missing. |
| `RC-EXTRACT-BARREL` | The dependency reaches its target only through a barrel re-export that the rule does not follow. |
| `RC-DYNAMIC-IMPORT` | The dependency is a dynamic `import()` or CommonJS require call the extractor does not model. |
| `RC-TYPE-ONLY` | The import is type-only and the rule excludes or includes type-only edges contrary to the construct's intent. |
| `RC-TEMPLATE-OVERAPPROX` | The rule matches more than the architectural rule it encodes, so a correct construct is flagged. |
| `RC-STYLE-INAPPLICABLE` | The rule does not apply to the project's architectural style. |
| `RC-SPEC-PARAM` | A spec parameter (threshold, pattern, limit) makes the rule fire or not fire independently of the construct. |
| `RC-GENERATED-CODE` | The finding lies in generated code (build output, codegen, migrations) rather than authored source. |
| `RC-TEST-CODE` | The finding lies in test code (specs, mocks, fixtures) that the rule should not judge. |
| `RC-GENUINE-UNSEEDED` | The finding is a real architectural violation that was not deliberately introduced (only with `unseeded-TP`). |
| `RC-OTHER` | None of the above; a non-empty free-text note is required. |

## Machine block

```yaml labeller-prompt
version: 1.0.0
kind: missed-seed
persona: |
  You are an independent software-architecture reviewer labelling one item for a measurement study.
  Judge only from the context given. Answer with one JSON object that follows the response schema.
options:
  - FN
rootCauseRequired: 
  - FN
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
template: |
  The construct below was introduced on purpose and the checker did not report it. Give the root cause of the
  miss from the list (RC-GENUINE-UNSEEDED is not valid here). Option: answer the only option.

  ## Item
  {{context}}

  ## Label options
  {{options}}

  ## Root causes
  {{rootCauses}}

  Answer with one JSON object: {"option": <number of the label option>, "rootCause": <number of the root cause or null>, "note": "<text, required with RC-OTHER>", "rationale": "<one or two sentences citing the code>"}.
```
