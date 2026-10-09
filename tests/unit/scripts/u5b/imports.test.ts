/**
 * U5b Step 5: static import whitelist (BR-U5b-55; C:342, CM:1545).
 *
 * Every import, re-export, dynamic `import()` and `require()` in a U5b script resolves to `scripts/**`,
 * `node:*`, an allowed package (`vega`, `vega-lite`, `ajv`, `ajv-formats` (Step 12, existing dependency), `ts-morph`, `yaml`) or a whitelisted `src/`
 * module: C10 types, C3 `parseSpec`, C6 evidence, C8 renormaliser / AHS / verdict / report validation.
 * Type-only imports from `src/shared/types/**` (C10 contract types) are allowed; they emit no code.
 * The U4 C7 modules (Gemini / Cassette providers, `assembleUnitSource`) joined the list after the Step 26 merge
 * (Step 27), with the C7 values those calls need: the token budget, the frozen rubric and the cassette store reader.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { Node, Project, SyntaxKind } from 'ts-morph';

const ROOT = resolve(__dirname, '../../../..');

/** The U5b-owned script files (plan "Files"; CLI entries are `<name>-cli.ts`). */
const U5B_LIB = ['report-io', 'stats', 'label-context', 'prereg', 'canonical-json', 'matching-rule', 'so5-codes'];
const U5B_SCRIPTS = [
  'score-golden', 'rescore', 'llm-label', 'run-experiment', 'aggregate', 'select-corpus', 'fetch-corpus',
  'prepare-bases', 'record-env', 'export-frozen-instrument', 'remap-domain-layer',
];

export function u5bScriptFiles(root: string = ROOT): string[] {
  const candidates = [
    ...U5B_LIB.map((n) => `scripts/lib/${n}.ts`),
    ...U5B_SCRIPTS.flatMap((n) => [`scripts/${n}.ts`, `scripts/${n}-cli.ts`]),
  ];
  const figures = join(root, 'scripts/lib/figures');
  const extra = existsSync(figures)
    ? readdirSync(figures).filter((f) => f.endsWith('.ts')).map((f) => `scripts/lib/figures/${f}`)
    : [];
  return [...candidates, ...extra].filter((f) => existsSync(join(root, f)));
}

const ALLOWED_PACKAGES = new Set(['vega', 'vega-lite', 'ajv', 'ajv-formats', 'ts-morph', 'yaml']);
const WHITELISTED_SRC = new Set([
  'src/shared/types/evaluation.ts',          // C10 EvaluationReport, Violation
  'src/spec-parser/spec-parser.ts',          // C3 parseSpec
  'src/spec-parser/index.ts',
  'src/evaluation-engine/evidence.ts',       // C6 formatEvidence / parseEvidence
  'src/scoring-engine/renormaliser.ts',      // C8 renormaliseWeights
  'src/scoring-engine/score-computer.ts',    // C8 computeAHS
  'src/scoring-engine/verdict.ts',           // C8 determineVerdict
  'src/scoring-engine/report-schema-validator.ts', // C8 parseReport / validateReport
  'src/scoring-engine/index.ts',
  // Step 13 (BR-U5b-52; domain-entities §1 U1 exports): the frozen-instrument exporter reads them from code.
  'src/fitness-compiler/cypher-templates.ts',      // MAX_CYCLE_LENGTH, CYCLE_ROW_CAP, getTemplateTag, listTemplatesByTag
  'src/fitness-compiler/template-applicability.ts', // isTemplateApplicable
  'src/fitness-compiler/layer-binding.ts',         // bindLayerParams (applicability input)
  'src/spec-parser/spec-schema.ts',                // PATTERN_GRAMMAR
  // Step 14 (BR-U5b-55 "ProcessRunner, buildChildEnv"; BR-U5b-70 C10 `scrubDeep`): the subprocess boundary.
  'src/shared/interfaces/process-runner.ts',       // ProcessRunner port (type)
  'src/shared/process/node-process-runner.ts',     // NodeProcessRunner, buildChildEnv
  'src/shared/errors/scrub.ts',                    // scrubDeep
  // Step 27..29 (BR-U5b-35, 36, 43, 55; U4 hand-off): C7 Gemini / Cassette providers and `assembleUnitSource`.
  'src/llm-critic/source-context.ts',              // assembleUnitSourceFromView (P4 context, BR-U5b-35)
  'src/llm-critic/judge-graph.ts',                 // JudgeGraphView (its input)
  'src/llm-critic/judge-unit-selector.ts',         // JudgeUnit (its input)
  'src/llm-critic/frozen.ts',                      // JUDGE_TOKEN_BUDGET (its budget)
  'src/llm-critic/rubric.ts',                      // FF-N01 / FF-N02 rubric text (P4 context, BR-U5b-35)
  'src/llm-critic/cassette-provider.ts',           // CassetteLLMProvider (BR-U5b-36)
  'src/llm-critic/cassette-manager.ts',            // committed judge cassettes (reliability, BR-U5b-43)
  'src/llm-critic/types.ts',                       // CassetteEntry
  'src/llm-critic/gemini-provider.ts',             // GeminiProvider (record mode only, BR-U5b-44)
  'src/llm-critic/mock-provider.ts',               // MockLLMProvider (fixture recording)
  'src/llm-critic/agy-cli-provider.ts',           // AgyCliProvider, the labeller route (ADR-019 item 4 as amended; ADR-021 SO3-1)
  'src/shared/interfaces/llm-provider.ts',         // LLMProvider port (type)
  'src/shared/errors/domain-result.ts',            // DomainResult (provider answers)
]);

interface ImportUse {
  readonly specifier: string;
  readonly typeOnly: boolean;
}

function importsOf(fileName: string, text: string): ImportUse[] {
  const project = new Project({ useInMemoryFileSystem: true, skipAddingFilesFromTsConfig: true });
  const sf = project.createSourceFile(fileName, text);
  const uses: ImportUse[] = [];
  for (const d of sf.getImportDeclarations()) {
    const typeOnly = d.isTypeOnly() || (d.getNamedImports().length > 0 && d.getDefaultImport() === undefined
      && d.getNamespaceImport() === undefined && d.getNamedImports().every((n) => n.isTypeOnly()));
    uses.push({ specifier: d.getModuleSpecifierValue(), typeOnly });
  }
  for (const d of sf.getExportDeclarations()) {
    const spec = d.getModuleSpecifierValue();
    if (spec !== undefined) uses.push({ specifier: spec, typeOnly: d.isTypeOnly() });
  }
  sf.forEachDescendant((node) => {
    if (!Node.isCallExpression(node)) return;
    const callee = node.getExpression();
    const isDynamicImport = callee.getKind() === SyntaxKind.ImportKeyword;
    const isRequire = Node.isIdentifier(callee) && callee.getText() === 'require';
    if (!isDynamicImport && !isRequire) return;
    const arg = node.getArguments()[0];
    uses.push({ specifier: arg !== undefined && Node.isStringLiteral(arg) ? arg.getLiteralValue() : `<non-literal ${arg?.getText() ?? ''}>`, typeOnly: false });
  });
  return uses;
}

/** Returns the disallowed imports of one file (repo-relative `file`, its `text`). */
export function disallowedImports(file: string, text: string, root: string = ROOT): string[] {
  const bad: string[] = [];
  for (const { specifier, typeOnly } of importsOf(file, text)) {
    if (specifier.startsWith('node:')) continue;
    if (!specifier.startsWith('.')) {
      const pkg = specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : (specifier.split('/')[0] ?? specifier);
      if (!ALLOWED_PACKAGES.has(pkg)) bad.push(`${file}: package ${specifier}`);
      continue;
    }
    const target = relative(root, resolve(root, dirname(file), specifier)).replace(/\.js$/, '.ts');
    if (target.startsWith('scripts/')) continue;
    if (WHITELISTED_SRC.has(target)) continue;
    if (typeOnly && target.startsWith('src/shared/types/')) continue;
    bad.push(`${file}: ${typeOnly ? 'type-only ' : ''}${target}`);
  }
  return bad;
}

describe('U5b static import whitelist (BR-U5b-55)', () => {
  it('finds the U5b script files present so far', () => {
    const files = u5bScriptFiles();
    expect(files).toEqual(expect.arrayContaining(['scripts/lib/canonical-json.ts', 'scripts/lib/report-io.ts', 'scripts/lib/stats.ts']));
  });

  it('every import in a U5b script resolves to scripts/**, node:*, an allowed package or a whitelisted src/ module', () => {
    const bad = u5bScriptFiles().flatMap((f) => disallowedImports(f, readFileSync(join(ROOT, f), 'utf8')));
    expect(bad).toEqual([]);
  });

  it('flags a non-whitelisted src module, an unknown package, a value import of C10 types file siblings and dynamic loads', () => {
    const text = [
      "import { Neo4jRepository } from '../../src/neo4j-ingestion/neo4j-repository.js';",
      "import _ from 'lodash';",
      "import { DIMENSIONS } from '../../src/shared/types/enums.js';",
      "import type { Dimension } from '../../src/shared/types/enums.js';",
      "import { validateReport } from '../../src/scoring-engine/report-schema-validator.js';",
      "import { readFileSync } from 'node:fs';",
      "import { canonicalize } from './canonical-json.js';",
      "export { formatEvidence } from '../../src/evaluation-engine/evidence.js';",
      "const vega = await import('vega');",
      "const cp = require('child_process');",
      "const x = await import(name);",
    ].join('\n');
    expect(disallowedImports('scripts/lib/example.ts', text)).toEqual([
      'scripts/lib/example.ts: src/neo4j-ingestion/neo4j-repository.ts',
      'scripts/lib/example.ts: package lodash',
      'scripts/lib/example.ts: src/shared/types/enums.ts',
      'scripts/lib/example.ts: package child_process',
      'scripts/lib/example.ts: package <non-literal name>',
    ]);
  });
});
