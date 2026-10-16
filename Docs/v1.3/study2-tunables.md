# Study 2 frozen-tunables manifest: schema and pass criterion (tooling, not a pre-registration)

Status: tooling. This file defines what `scripts/v1.3/study2-tunables.ts` hashes and how `verify` decides. It is not a
registration and states no hypothesis, design or analysis. The author writes the registration later; this is the
mechanical half of readiness item 7 of `Docs/v1.3/study2-outline.md` ("the frozen tunables are hashed") and of
review finding R23 (the MCP arm's spec must equal the evaluator spec).

Night backlog job #13 (T1), `Docs/v1.3/night-backlog-2026-10-16.md`.

## 1. Commands

```
npx tsx scripts/v1.3/study2-tunables.ts write  <out.json>     # writes the manifest of the current tree
npx tsx scripts/v1.3/study2-tunables.ts verify <manifest.json> # exit 0 = no drift, 1 = drift, 2 = usage / unreadable
```

Both read only the repository (source exports and committed files). No network, no model, no Neo4j, nothing under
`../daedalus-sealed/`. The same tree always writes the same bytes (canonical JSON; no timestamp, no commit, no path).

## 2. Manifest schema

```json
{
  "schema": "daedalus.study2-tunables/1",
  "note": "Tooling output (hashes of the Study 2 tunables). Not a pre-registration.",
  "entries": { "<group>/<key>": "<64-hex sha256>", "...": "..." },
  "absent": { "<group>": "<reason>" }
}
```

`entries` is a flat map with keys sorted by code-unit order. Every value is the sha256 of either the raw bytes of a
committed file, or the canonical JSON (`scripts/lib/canonical-json.ts`) of an exported value. The judge anchors are
recorded twice: the committed anchor constant (`judge/frozen-anchor`, `judge/v2-anchor`) and the hash of the values
it anchors, so a value edit that forgets the anchor still shows as drift. `absent` lists groups the outline names
that have no source on this commit, with the reason; a group appearing or disappearing is drift.

| Group | Key | What is hashed |
| --- | --- | --- |
| `template` | `<catalogue>/<name>` | Cypher text of every catalogue template: `frozen` (`CYPHER_TEMPLATES`), `hexagonal`, `ddd`, `module-wiring`, `apg2`, `cheap2` (`V13_EXTENSION_TEMPLATE_CATALOGUES`), `ddd-member-fact`, `ddd-literal-view` |
| `template-meta` | `<catalogue>/<name>` | the rest of the template object (params, result mapping, tag, layer kinds, styles) |
| `template-tiers` | `apg2`, `cheap2` | the tier maps that ship with the APG v2 and cheap-proxy catalogues |
| `compiler` | `edge-views`, `role-exemptions`, `role-name-rewrites`, `field-state-purity-text`, `v13-compile-options` | compiler tables that change which rows a template returns |
| `library` | `<style>` | `resolveTemplate(style)` for clean-architecture, nestjs, layered, hexagonal, ddd (functions, weights, thresholds) |
| `preset` | `<file>` | raw bytes of every `presets/*.yaml` |
| `frame` | template names, `rule-plain`, `max-repair-findings`, `style-presets`, `style-sentence/<style>`, `layout-sentence/<style>`, `arm-tool-sentences` | the step frames (FIRST, NEXT, STYLED_FIRST, STYLED_NEXT), the repair frame, `RULE_PLAIN`, the style and layout sentences (DDD with no contexts), the per-arm tool sentence |
| `mcp` | `server-version`, `tool-names`, `spec-tool-names`, `denied-tools` | the server identity and the allow/deny lists |
| `mcp-tool` | `default/<tool>` | name, title, description and input schema (JSON Schema as listed by `tools/list`) of each tool of the default server |
| `judge` | `frozen-anchor`, `frozen-values`, `v2-anchor`, `v2-values` | `FROZEN_SHA256`, `FROZEN_VALUES`, `JUDGE_V2_SHA256`, `JUDGE_V2_VALUES` |
| `doc` | `rule-tiers.md`, `style-rule-sources.md` | raw bytes of the two sealed docs |
| `extractor` | option-set names | `V12E_DEFAULT_OPTIONS`, `V13_DEFAULT_OPTIONS`, `V13_FIELD_STATE_OPTIONS`, `V13_APG2_OPTIONS`, `DEFAULT_OPTIONS`, `DEFAULT_CHEAP_OPTIONS`, `DEFAULT_SPEC_PARSER_OPTIONS` |
| `labelling` | file names | raw bytes of `scripts/v1.3/lib/labelling/correctness.ts` (the checker) and `findings.ts` (the finding identity key) |

`absent` on `origin/v1.3` at this commit: `mcp-tool/neural` (the `--neural` tool set is on the unmerged
`v1.3-neural-mcp` branch; when it lands, the tool adds `mcp-tool/neural/<tool>` and drops the `absent` entry).

The PipelineConfig has no default object in code (the CLI builds it per call); its extractor-relevant defaults are
the option sets in the `extractor` group.

## 3. Pass criterion (fixed before the tool was written)

1. `write` lists every row of the table in §2 with a 64-hex sha256; the unit tests assert that each group is present
   and non-empty, and that two writes of the same tree are byte-identical.
2. `verify` exits 0 on the manifest just written; exits 1 when any entry is added, removed or changed, and names every
   drifting key (tests: one changed value, one missing key, one extra key, one changed `absent` group).
3. CI: a step in `.github/workflows/ci.yml` runs `verify Docs/v1.3/study2-tunables.json` only when that file exists.
   The file is NOT created by this change, so nothing changes in CI until the author writes it at the freeze.
4. R23: `loadLoopPlan` checks spec equality between the `daedalus-mcp` arm and the evaluator (§4).
5. The 71 reference results stay byte-identical (rules block item 3).

## 4. Spec equality for the `daedalus-mcp` arm (R23)

A plan that runs the `daedalus-mcp` arm already cannot carry `taskProfiles` (one MCP server, one spec), so one spec
covers every task of the plan. New optional plan field `specSha256` (64-hex):

- present: `loadLoopPlan` hashes the evaluator spec (`evaluatorSpec`, resolved against the repository root) and, when
  the plan runs `daedalus-mcp`, the server's spec (`daedalus.specPath`); each must equal `specSha256`, else
  `LOOP_PLAN_SPEC_MISMATCH` (or `LOOP_FILE_UNREADABLE` when a file cannot be read);
- absent: unchanged behaviour, unless `DAEDALUS_LOOP_REQUIRE_SPEC_SHA256=1` is set, in which case a plan with the
  `daedalus-mcp` arm and no `specSha256` is refused (`LOOP_PLAN_INVALID`). OFF by default, so the demo plan and every
  existing test keep working.

The Study 2 plan is expected to carry `specSha256` and to be run with the variable set; that is the author's call.

## 5. What this does not do

It writes no registration text, does not create `Docs/v1.3/study2-tunables.json`, does not hash anything under
`../daedalus-sealed/`, and does not hash the generator binary or model id (item S2/S3 of the readiness gate).
