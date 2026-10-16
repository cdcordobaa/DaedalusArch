/**
 * v1.3 third manifest (key writer K-G, Docs/v1.3/role-separation-plan.md §4.1; Docs/v1.3/third-manifest.md): the
 * frozen prompt and the output schema. Both are committed and hashed in Docs/v1.3/third-manifest.md before any
 * adapter is wired; the harness refuses to run when the computed hashes differ from the doc's (`checkFrozenHashes`).
 *
 * Changing any text in this file changes a hash. That needs a new dated row in the doc's hash table, and every
 * manifest written under the old hash stays labelled with it.
 */
import { createHash } from 'node:crypto';

export const THIRD_MANIFEST_PROMPT_VERSION = 'tm-1';

export const SYSTEM_PROMPT = [
  'You are a software architect writing an expected-findings key for a TypeScript project.',
  'Judge only from the material in the message: the style rules and their sources, the rule tiers, the layer and context declarations, and the source files.',
  'You have no tools. Reply with one JSON object that matches the response schema, and nothing else.',
].join(' ');

/** The task text. `{{...}}` slots are filled by `renderPrompt`; nothing else varies between cases. */
export const TASK_TEXT = [
  '## Task',
  '',
  'Write the expected findings for this project, before any checking tool has run on it.',
  '',
  '1. Give every source file its layer, and for DDD its bounded context, from the declarations. A file that no declaration covers gets layer null.',
  '2. List every internal import edge between the source files (from, to, kind "import" or "re-export"). An import of a package outside the project is not an edge. Mark an edge `typeOnly` when it imports types only, and `viaReExport` when it reaches the file through a barrel (an index file that re-exports it); then list the barrel files in `through`.',
  '3. List every place where the project breaks one of the rules in the tier table. One finding per rule, file and target:',
  '   - `ruleId`: the rule exactly as the tier table names it (the Rule column, for example `FF-S01`, or the rule name of the second table, for example `core-isolation` or `DDD aggregate boundary`). A problem that no listed rule states is named `OTHER: <the construct in a few words>`.',
  '   - `file`: the project-relative path of the file that holds the problem.',
  '   - `target`: for an import rule, the imported project file (or the package name for a framework import); for a class rule, null.',
  '   - `tier`: the tier the table gives the rule for this style (`blocking` or `advisory`).',
  '   - `reason`: one or two sentences: which declaration or source statement the code breaks, and how.',
  '   - `confidence`: `high`, `medium` or `low`.',
  '   - `alsoMatches`: other rule names from the table that the same problem also breaks (may be empty).',
  '4. List near misses in `nearMissOk`: files (or globs) that look like a break of a rule but are not, with the reason.',
  '5. `verdict` is `fail` when at least one finding is on a blocking rule, otherwise `pass`.',
  '',
  'Do not guess what a checking tool would report. Write what an architect following the sources would expect. A clean project has no findings.',
].join('\n');

/**
 * The response schema (JSON Schema, the subset Gemini's `responseSchema` accepts: no `additionalProperties`, no
 * formats). The parser (`parseManifestAnswer`) checks the same shape strictly after the call.
 */
export const OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['pass', 'fail'] },
    expectedGraph: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: {
            type: 'object',
            properties: { file: { type: 'string' }, layer: { type: 'string', nullable: true }, context: { type: 'string', nullable: true } },
            required: ['file', 'layer'],
          },
        },
        edges: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              from: { type: 'string' }, to: { type: 'string' }, kind: { type: 'string', enum: ['import', 're-export'] },
              typeOnly: { type: 'boolean' }, viaReExport: { type: 'boolean' }, through: { type: 'array', items: { type: 'string' } },
            },
            required: ['from', 'to', 'kind'],
          },
        },
      },
      required: ['files', 'edges'],
    },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          ruleId: { type: 'string' },
          file: { type: 'string' },
          target: { type: 'string', nullable: true },
          tier: { type: 'string', enum: ['blocking', 'advisory'] },
          reason: { type: 'string' },
          confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
          alsoMatches: { type: 'array', items: { type: 'string' } },
        },
        required: ['ruleId', 'file', 'tier', 'reason', 'confidence'],
      },
    },
    nearMissOk: {
      type: 'array',
      items: { type: 'object', properties: { nearMissOk: { type: 'string' }, reason: { type: 'string' } }, required: ['nearMissOk', 'reason'] },
    },
  },
  required: ['verdict', 'expectedGraph', 'findings', 'nearMissOk'],
} as const;

/** Canonical schema text (sorted keys, no spaces): the form that is hashed and sent. */
export const OUTPUT_SCHEMA_TEXT = canonical(OUTPUT_SCHEMA);

function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  if (v !== null && typeof v === 'object') {
    return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`).join(',')}}`;
  }
  return JSON.stringify(v);
}

export const sha256 = (s: string): string => createHash('sha256').update(s).digest('hex');

/** The hashed prompt text: version, system prompt and task text (the per-case bundle is hashed separately). */
export const PROMPT_TEXT = `${THIRD_MANIFEST_PROMPT_VERSION}\n${SYSTEM_PROMPT}\n\n${TASK_TEXT}`;
export const PROMPT_SHA256 = sha256(PROMPT_TEXT);
export const SCHEMA_SHA256 = sha256(OUTPUT_SCHEMA_TEXT);

/** The sections of one case's bundle (built by bundle.ts from allow-listed inputs only). */
export interface BundleSections {
  readonly caseId: string;
  readonly style: string;
  readonly styleRules: string;
  readonly tierTable: string;
  readonly declarations: string;
  readonly files: readonly { readonly path: string; readonly content: string }[];
}

export function renderPrompt(b: BundleSections): string {
  const parts = [
    TASK_TEXT,
    '',
    '## Case',
    '',
    `Case ${b.caseId}. Style: ${b.style}.`,
    '',
    '## Style rules and their sources',
    '',
    b.styleRules,
    '',
    '## Rule tiers (rule names and constructs)',
    '',
    b.tierTable,
    '',
    '## Layer and context declarations',
    '',
    '```yaml',
    b.declarations.trimEnd(),
    '```',
    '',
    `## Source files (${String(b.files.length)}, every comment removed)`,
  ];
  for (const f of b.files) parts.push('', `### ${f.path}`, '', '```ts', f.content.trimEnd(), '```');
  parts.push('', '## Response schema', '', OUTPUT_SCHEMA_TEXT);
  return parts.join('\n');
}
