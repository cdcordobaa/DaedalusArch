/**
 * Study 2 frozen-tunables manifest (TOOLING, NOT A PRE-REGISTRATION; `Docs/v1.3/study2-tunables.md`).
 *
 * `buildTunablesManifest(repoRoot)` hashes every tunable the outline names (readiness item 7): the Cypher catalogues,
 * the style libraries, the presets, the step and repair frames, the MCP tool names and descriptions, the judge freezes,
 * the sealed tier and source docs, the extractor option defaults and the correctness checker. Each entry is the sha256
 * of a committed file's bytes or of an exported value's canonical JSON. `diffManifests` names every key that drifted.
 * The same tree always gives the same bytes (no timestamp, no commit, no path). Reads nothing outside the repository.
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { canonicalize } from '../../lib/canonical-json.js';
import { CYPHER_TEMPLATES } from '../../../src/fitness-compiler/cypher-templates.js';
import { V13_EXTENSION_TEMPLATE_CATALOGUES } from '../../../src/fitness-compiler/extension-templates.js';
import { DDD_LITERAL_VIEW_TEMPLATES, DDD_MEMBER_FACT_TEMPLATES } from '../../../src/fitness-compiler/ddd-templates.js';
import { APG2_TEMPLATE_TIERS } from '../../../src/fitness-compiler/apg2-templates.js';
import { CHEAP2_TEMPLATE_TIERS } from '../../../src/fitness-compiler/cheap2-templates.js';
import { TEMPLATE_EDGE_VIEWS } from '../../../src/fitness-compiler/edge-views.js';
import { COMPOSITION_ROOT_GLOBS, DECLARATION_ONLY_GLOBS, INSTRUMENT_VERSION, ROLE_EXEMPTIONS } from '../../../src/fitness-compiler/role-exemptions.js';
import { V13_ROLE_NAME_REWRITES } from '../../../src/fitness-compiler/v13-role-names.js';
import { FIELD_STATE_PURITY_TEXT } from '../../../src/fitness-compiler/v13-rewrites.js';
import { V13_COMPILE_OPTIONS } from '../../../src/fitness-compiler/fitness-compiler.js';
import type { CypherTemplate } from '../../../src/fitness-compiler/types.js';
import { resolveTemplate } from '../../../src/spec-parser/template-registry.js';
import { DEFAULT_SPEC_PARSER_OPTIONS } from '../../../src/spec-parser/types.js';
import {
  DEFAULT_OPTIONS, V12E_DEFAULT_OPTIONS, V13_APG2_OPTIONS, V13_DEFAULT_OPTIONS, V13_FIELD_STATE_OPTIONS,
} from '../../../src/apg-extractor/types.js';
import { DEFAULT_CHEAP_OPTIONS } from '../../../src/apg-enrich/cheap/types.js';
import { FROZEN_SHA256, FROZEN_VALUES } from '../../../src/llm-critic/frozen.js';
import { JUDGE_V2_SHA256, JUDGE_V2_VALUES } from '../../../src/llm-critic/judge-v2.js';
import { DAEDALUS_DENIED_TOOLS, ARM_TOOL_SENTENCES } from '../../lib/generators/arms.js';
import {
  ATTENTION_SENTENCE, FIRST_STEP_TEMPLATE, FIX_CLAUSE, L3_LEAD, L4_SENTENCE, MAX_REPAIR_FINDINGS, NEXT_STEP_TEMPLATE,
  REPAIR_TEMPLATE, RULE_PLAIN, STYLED_FIRST_STEP_TEMPLATE, STYLED_NEXT_STEP_TEMPLATE,
} from '../../lib/loop/prompts.js';
import { LOOP_STYLES, STYLE_PRESETS, layoutSentence, styleSentence } from '../../lib/loop/style.js';
import { createServer, NEURAL_TOOL_NAMES, SERVER_NAME, SERVER_VERSION, SPEC_TOOL_NAMES, TOOL_NAMES } from '../../../src/mcp-server/server.js';
import type { NeuralService } from '../../../src/mcp-server/neural-service.js';
import { createSpecLoader } from '../../../src/mcp-server/tools.js';
import type { ServerContext } from '../../../src/mcp-server/tools.js';

export const TUNABLES_SCHEMA = 'daedalus.study2-tunables/1';
export const TUNABLES_NOTE = 'Tooling output (hashes of the Study 2 tunables). Not a pre-registration.';
/** Where the author writes the frozen manifest at the freeze; CI verifies it only when it exists. */
export const TUNABLES_MANIFEST_FILE = 'Docs/v1.3/study2-tunables.json';

export const SEALED_DOCS: readonly string[] = Object.freeze(['Docs/v1.3/rule-tiers.md', 'Docs/v1.3/style-rule-sources.md']);
export const LABELLING_FILES: readonly string[] = Object.freeze([
  'scripts/v1.3/lib/labelling/correctness.ts',
  'scripts/v1.3/lib/labelling/findings.ts',
]);
export const LIBRARY_STYLES: readonly string[] = Object.freeze(['clean-architecture', 'nestjs', 'layered', 'hexagonal', 'ddd']);

/** Groups the outline names that have no source on this commit (key: group, value: reason). */
export const ABSENT_GROUPS: Readonly<Record<string, string>> = Object.freeze({});

export interface TunablesManifest {
  readonly schema: string;
  readonly note: string;
  readonly entries: Readonly<Record<string, string>>;
  readonly absent: Readonly<Record<string, string>>;
}

export function sha256Hex(data: string | Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}

/** sha256 of the canonical JSON of a value. */
export function valueSha256(value: unknown): string {
  return sha256Hex(canonicalize(value));
}

function fileSha256(repoRoot: string, rel: string): string {
  return sha256Hex(fs.readFileSync(path.join(repoRoot, rel)));
}

function addCatalogue(entries: Record<string, string>, catalogue: string, templates: ReadonlyMap<string, CypherTemplate>): void {
  for (const [name, t] of templates) {
    const { template, ...meta } = t;
    entries[`template/${catalogue}/${name}`] = sha256Hex(template);
    entries[`template-meta/${catalogue}/${name}`] = valueSha256(meta);
  }
}

/**
 * The tools of the server as `tools/list` returns them (name, title, description, input schema): the default server,
 * or with `neural` the `--neural` server (its two tools, plus the follow-up sentence on the symbolic ones). Registration
 * only checks that a neural service is present; listing never calls it, so a stand-in suffices and no model is reached.
 */
export async function listServerTools(repoRoot: string, neural = false): Promise<readonly { name: string; title: string | undefined; description: string | undefined; inputSchema: unknown }[]> {
  const ctx: ServerContext = {
    env: {},
    loadSpec: createSpecLoader(),
    presetsDir: path.join(repoRoot, 'presets'),
    evaluateDeps: {
      makeGraph: () => {
        throw new Error('study2-tunables: no graph');
      },
      makePipeline: () => {
        throw new Error('study2-tunables: no pipeline');
      },
    },
    ...(neural ? { neural: {} as NeuralService } : {}),
  };
  const server = createServer(ctx);
  const [clientT, serverT] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'study2-tunables', version: '1.0.0' });
  await server.connect(serverT);
  await client.connect(clientT);
  try {
    const { tools } = await client.listTools();
    return tools.map((t) => ({ name: t.name, title: t.title, description: t.description, inputSchema: t.inputSchema }));
  } finally {
    await client.close();
    await server.close();
  }
}

export async function buildTunablesManifest(repoRoot: string): Promise<TunablesManifest> {
  const e: Record<string, string> = {};

  // Cypher catalogues: the frozen v1.2E one, every v1.3 extension catalogue, and the DDD alternates.
  addCatalogue(e, 'frozen', CYPHER_TEMPLATES);
  for (const [name, templates] of V13_EXTENSION_TEMPLATE_CATALOGUES) addCatalogue(e, name, templates);
  addCatalogue(e, 'ddd-member-fact', DDD_MEMBER_FACT_TEMPLATES);
  for (const [name, text] of DDD_LITERAL_VIEW_TEMPLATES) e[`template/ddd-literal-view/${name}`] = sha256Hex(text);
  e['template-tiers/apg2'] = valueSha256(APG2_TEMPLATE_TIERS);
  e['template-tiers/cheap2'] = valueSha256(CHEAP2_TEMPLATE_TIERS);

  e['compiler/edge-views'] = valueSha256(TEMPLATE_EDGE_VIEWS);
  e['compiler/role-exemptions'] = valueSha256({
    instrumentVersion: INSTRUMENT_VERSION, compositionRoot: COMPOSITION_ROOT_GLOBS, declarationOnly: DECLARATION_ONLY_GLOBS, templates: ROLE_EXEMPTIONS,
  });
  e['compiler/role-name-rewrites'] = valueSha256(V13_ROLE_NAME_REWRITES);
  e['compiler/field-state-purity-text'] = valueSha256(FIELD_STATE_PURITY_TEXT);
  e['compiler/v13-compile-options'] = valueSha256(V13_COMPILE_OPTIONS);

  for (const style of LIBRARY_STYLES) {
    const lib = resolveTemplate(style);
    if (lib === undefined) throw new Error(`study2-tunables: no style library ${style}`);
    e[`library/${style}`] = valueSha256(lib);
  }

  const presetsDir = path.join(repoRoot, 'presets');
  for (const f of fs.readdirSync(presetsDir).filter((n) => n.endsWith('.yaml')).sort()) e[`preset/${f}`] = fileSha256(repoRoot, `presets/${f}`);

  // Loop frames: what the generator reads.
  e['frame/first-step'] = sha256Hex(FIRST_STEP_TEMPLATE);
  e['frame/next-step'] = sha256Hex(NEXT_STEP_TEMPLATE);
  e['frame/styled-first-step'] = sha256Hex(STYLED_FIRST_STEP_TEMPLATE);
  e['frame/styled-next-step'] = sha256Hex(STYLED_NEXT_STEP_TEMPLATE);
  e['frame/repair'] = sha256Hex(REPAIR_TEMPLATE);
  e['frame/rule-plain'] = valueSha256(RULE_PLAIN);
  e['frame/max-repair-findings'] = valueSha256(MAX_REPAIR_FINDINGS);
  e['frame/style-presets'] = valueSha256(STYLE_PRESETS);
  e['frame/arm-tool-sentences'] = valueSha256(ARM_TOOL_SENTENCES);
  // Frame extras (spec rungs and the attention sentence, `plan.ts` `frame`; post-merge review item 2).
  e['frame/attention'] = sha256Hex(ATTENTION_SENTENCE);
  e['frame/l3-lead'] = sha256Hex(L3_LEAD);
  e['frame/l4-sentence'] = sha256Hex(L4_SENTENCE);
  e['frame/fix-clause'] = valueSha256({ source: FIX_CLAUSE.source, flags: FIX_CLAUSE.flags });
  for (const style of LOOP_STYLES) {
    e[`frame/style-sentence/${style}`] = sha256Hex(styleSentence(style));
    e[`frame/layout-sentence/${style}`] = sha256Hex(layoutSentence(style, fs.readFileSync(path.join(repoRoot, STYLE_PRESETS[style]), 'utf8')));
  }

  // MCP server: identity, allow/deny lists and every tool as the agent sees it.
  e['mcp/server-version'] = valueSha256({ name: SERVER_NAME, version: SERVER_VERSION });
  e['mcp/tool-names'] = valueSha256(TOOL_NAMES);
  e['mcp/spec-tool-names'] = valueSha256(SPEC_TOOL_NAMES);
  e['mcp/denied-tools'] = valueSha256(DAEDALUS_DENIED_TOOLS);
  e['mcp/neural-tool-names'] = valueSha256(NEURAL_TOOL_NAMES);
  for (const t of await listServerTools(repoRoot)) e[`mcp-tool/default/${t.name}`] = valueSha256(t);
  for (const t of await listServerTools(repoRoot, true)) e[`mcp-tool/neural/${t.name}`] = valueSha256(t);

  // Judge freezes: the committed anchor and the values it anchors.
  e['judge/frozen-anchor'] = FROZEN_SHA256;
  e['judge/frozen-values'] = valueSha256(FROZEN_VALUES);
  e['judge/v2-anchor'] = JUDGE_V2_SHA256;
  e['judge/v2-values'] = valueSha256(JUDGE_V2_VALUES);

  for (const doc of SEALED_DOCS) e[`doc/${path.basename(doc)}`] = fileSha256(repoRoot, doc);

  e['extractor/V12E_DEFAULT_OPTIONS'] = valueSha256(V12E_DEFAULT_OPTIONS);
  e['extractor/V13_DEFAULT_OPTIONS'] = valueSha256(V13_DEFAULT_OPTIONS);
  e['extractor/V13_FIELD_STATE_OPTIONS'] = valueSha256(V13_FIELD_STATE_OPTIONS);
  e['extractor/V13_APG2_OPTIONS'] = valueSha256(V13_APG2_OPTIONS);
  e['extractor/DEFAULT_OPTIONS'] = valueSha256(DEFAULT_OPTIONS);
  e['extractor/DEFAULT_CHEAP_OPTIONS'] = valueSha256(DEFAULT_CHEAP_OPTIONS);
  e['extractor/DEFAULT_SPEC_PARSER_OPTIONS'] = valueSha256(DEFAULT_SPEC_PARSER_OPTIONS);

  for (const f of LABELLING_FILES) e[`labelling/${path.basename(f)}`] = fileSha256(repoRoot, f);

  const entries: Record<string, string> = {};
  for (const k of Object.keys(e).sort()) entries[k] = e[k] ?? '';
  return { schema: TUNABLES_SCHEMA, note: TUNABLES_NOTE, entries, absent: { ...ABSENT_GROUPS } };
}

export function manifestText(m: TunablesManifest): string {
  return canonicalize(m);
}

export interface ManifestDrift {
  readonly added: readonly string[];
  readonly removed: readonly string[];
  readonly changed: readonly string[];
  readonly absentChanged: readonly string[];
  readonly schemaChanged: boolean;
}

export function diffManifests(frozen: TunablesManifest, live: TunablesManifest): ManifestDrift {
  const fk = new Set(Object.keys(frozen.entries));
  const lk = new Set(Object.keys(live.entries));
  const absentKeys = new Set([...Object.keys(frozen.absent), ...Object.keys(live.absent)]);
  return {
    added: [...lk].filter((k) => !fk.has(k)).sort(),
    removed: [...fk].filter((k) => !lk.has(k)).sort(),
    changed: [...fk].filter((k) => lk.has(k) && frozen.entries[k] !== live.entries[k]).sort(),
    absentChanged: [...absentKeys].filter((k) => frozen.absent[k] !== live.absent[k]).sort(),
    schemaChanged: frozen.schema !== live.schema,
  };
}

export function hasDrift(d: ManifestDrift): boolean {
  return d.schemaChanged || d.added.length + d.removed.length + d.changed.length + d.absentChanged.length > 0;
}

/** Parses a manifest file's text; throws with a plain message when the shape is wrong. */
export function parseManifest(text: string): TunablesManifest {
  const raw = JSON.parse(text) as Partial<TunablesManifest> | null;
  const isMap = (v: unknown): v is Record<string, string> =>
    typeof v === 'object' && v !== null && !Array.isArray(v) && Object.values(v).every((x) => typeof x === 'string');
  if (raw === null || typeof raw.schema !== 'string' || !isMap(raw.entries) || !isMap(raw.absent)) {
    throw new Error('not a study2 tunables manifest ({ schema, note, entries, absent })');
  }
  return { schema: raw.schema, note: raw.note ?? '', entries: raw.entries, absent: raw.absent };
}

export function renderDrift(d: ManifestDrift): string {
  const lines: string[] = [];
  if (d.schemaChanged) lines.push('schema changed');
  for (const k of d.changed) lines.push(`changed  ${k}`);
  for (const k of d.removed) lines.push(`removed  ${k}`);
  for (const k of d.added) lines.push(`added    ${k}`);
  for (const k of d.absentChanged) lines.push(`absent   ${k}`);
  return lines.join('\n') + (lines.length > 0 ? '\n' : '');
}
