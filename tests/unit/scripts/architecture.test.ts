/**
 * U5a architecture checks (U5a plan Step 4; BR-U5a-06 static part, BR-U5a-51, BR-U5a-53, D-U5a-13).
 *
 * Every check walks the repository files with `fs` and inspects the source text and import specifiers.
 * Checks over U5a files are vacuous until those files arrive and become live as they do; each detector
 * has a self-check on inline source so a broken regex cannot pass silently.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import ts from 'typescript';

const REPO_ROOT = process.cwd();

/** Path aliases of `tsconfig.json` (`@x/*` -> `src/x/*`). */
const ALIASES: Readonly<Record<string, string>> = {
  '@shared/': 'src/shared/',
  '@apg-extractor/': 'src/apg-extractor/',
  '@neo4j-ingestion/': 'src/neo4j-ingestion/',
  '@spec-parser/': 'src/spec-parser/',
  '@fitness-compiler/': 'src/fitness-compiler/',
  '@neuro-symbolic-router/': 'src/neuro-symbolic-router/',
  '@evaluation-engine/': 'src/evaluation-engine/',
  '@llm-critic/': 'src/llm-critic/',
  '@scoring-engine/': 'src/scoring-engine/',
  '@cli/': 'src/cli/',
  '@report/': 'src/report/',
  '@firewall-context/': 'src/firewall-context/',
};

/** BR-U5a-06: detector-side modules the mutation engine and the manifest module may not import. */
const FORBIDDEN_FOR_MUTATION = [
  'src/evaluation-engine/',
  'src/neo4j-ingestion/',
  'src/pipeline/',
  'src/report/',
  'src/apg-extractor/',
] as const;

/** BR-U5a-06: any `*report*.json` file name in a plain or template string. */
const REPORT_JSON_NAME = /report[^'"`/]*\.json/i;

/**
 * BR-U5a-51: a Claude model id literal (`claude-opus-…`, `claude-3-…`, …). The design's adapter id
 * `claude-code-cli` (domain-entities §5, `GridPlan.adapters[].adapterId`) is not a model id and is exempt
 * (DV-U5a-9).
 */
const CLAUDE_MODEL_ID = /claude-(?!code-cli\b)[a-z0-9]/i;

/** BR-U5a-51 for the Codex arm (ADR-029): an OpenAI model id literal (`gpt-…`, `o3`, `codex-mini…`). */
const OPENAI_MODEL_ID = /\bgpt-[0-9]|\bo[0-9]-|\bcodex-mini/i;

/** D-U5a-13: tokens no U5a script may contain. */
const BANNED_TOKENS = /import\.meta|__dirname|__filename|\brequire\(/;

/** D-U5a-13 (a): the six runnable entry files (no exports, no top-level await). */
const ENTRY_FILES = [
  'scripts/mutate.ts',
  'scripts/u5a-freeze-gate.ts',
  'scripts/u5a-parity-check.ts',
  'scripts/generate-projects.ts',
  'scripts/generator/check-harness-tsconfig.ts',
  'scripts/generator/probes/confinement-cli.ts',
  'scripts/generator/probes/codex-confinement-cli.ts',
] as const;

/** Directories whose `.ts` files U5a creates (D-U5a-13 token ban), plus the entry files above. */
const U5A_SCRIPT_DIRS = ['scripts/lib', 'scripts/generator'] as const;
const SKELETON_DIR = 'scripts/generator/skeleton';

function toPosix(p: string): string {
  return p.split(path.sep).join('/');
}

/** Repo-relative POSIX paths of every `.ts` file under `dir` (empty when `dir` is absent). */
function walkTs(dir: string): string[] {
  const abs = path.resolve(REPO_ROOT, dir);
  if (!fs.existsSync(abs)) return [];
  const out: string[] = [];
  const visit = (d: string): void => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules') continue;
        visit(full);
      } else if (entry.isFile() && entry.name.endsWith('.ts')) {
        out.push(toPosix(path.relative(REPO_ROOT, full)));
      }
    }
  };
  visit(abs);
  return out.sort();
}

function read(rel: string): string {
  return fs.readFileSync(path.resolve(REPO_ROOT, rel), 'utf8');
}

/** Static and dynamic import / re-export / require specifiers in a source text. */
function importSpecifiers(source: string): string[] {
  const specs: string[] = [];
  const patterns = [
    /\b(?:import|export)\s+(?:type\s+)?[^'"`;]*?\bfrom\s*['"]([^'"]+)['"]/g,
    /\bimport\s*['"]([^'"]+)['"]/g,
    /\b(?:import|require)\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const re of patterns) {
    for (const m of source.matchAll(re)) {
      if (m[1] !== undefined) specs.push(m[1]);
    }
  }
  return specs;
}

/** Repo-relative POSIX target of a specifier, or null for a package import. */
function resolveSpecifier(fromFile: string, spec: string): string | null {
  for (const [alias, target] of Object.entries(ALIASES)) {
    if (spec.startsWith(alias)) return target + spec.slice(alias.length);
  }
  if (!spec.startsWith('.')) return null;
  const abs = path.resolve(REPO_ROOT, path.dirname(fromFile), spec);
  return toPosix(path.relative(REPO_ROOT, abs));
}

/** True when an import target lands in one of the forbidden detector modules. */
function forbiddenTarget(target: string): boolean {
  return FORBIDDEN_FOR_MUTATION.some((prefix) => target === prefix.slice(0, -1) || target.startsWith(prefix));
}

/** D-U5a-13 (a): export declarations and top-level awaits of an entry file. */
function entryFileViolations(fileName: string, source: string): string[] {
  const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
  const problems: string[] = [];
  const hasExportModifier = (node: ts.Node): boolean =>
    ts.canHaveModifiers(node) && (ts.getModifiers(node) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
  const findTopLevelAwait = (node: ts.Node): boolean => {
    if (ts.isFunctionLike(node) || ts.isClassLike(node)) return false;
    if (ts.isAwaitExpression(node)) return true;
    if (ts.isForOfStatement(node) && node.awaitModifier !== undefined) return true;
    return ts.forEachChild(node, (child) => (findTopLevelAwait(child) ? true : undefined)) ?? false;
  };
  for (const stmt of sf.statements) {
    if (ts.isExportDeclaration(stmt) || ts.isExportAssignment(stmt) || hasExportModifier(stmt)) {
      problems.push(`${fileName}: export at line ${String(sf.getLineAndCharacterOfPosition(stmt.getStart()).line + 1)}`);
    }
    if (findTopLevelAwait(stmt)) {
      problems.push(`${fileName}: top-level await at line ${String(sf.getLineAndCharacterOfPosition(stmt.getStart()).line + 1)}`);
    }
  }
  return problems;
}

function mutationEngineFiles(): string[] {
  const files = walkTs('scripts/lib/mutation');
  if (fs.existsSync(path.resolve(REPO_ROOT, 'scripts/lib/manifest.ts'))) files.push('scripts/lib/manifest.ts');
  return files;
}

function u5aScriptFiles(): string[] {
  const files = new Set<string>();
  for (const dir of U5A_SCRIPT_DIRS) {
    for (const f of walkTs(dir)) if (!f.startsWith(SKELETON_DIR + '/')) files.add(f);
  }
  for (const f of ENTRY_FILES) if (fs.existsSync(path.resolve(REPO_ROOT, f))) files.add(f);
  return [...files].sort();
}

describe('U5a architecture (BR-U5a-06, 51, 53; D-U5a-13)', () => {
  it('runs from the repository root', () => {
    expect(fs.existsSync(path.resolve(REPO_ROOT, 'schemas/manifest.schema.json'))).toBe(true);
    expect(walkTs('src').length).toBeGreaterThan(0);
  });

  describe('detector self-checks', () => {
    it('the *report*.json regex matches plain and template names', () => {
      expect(REPORT_JSON_NAME.test("'report.json'")).toBe(true);
      expect(REPORT_JSON_NAME.test('`${d}/report-baseline.json`')).toBe(true);
      expect(REPORT_JSON_NAME.test('"mutant-report.json"')).toBe(true);
      expect(REPORT_JSON_NAME.test("'manifest.json'")).toBe(false);
      expect(REPORT_JSON_NAME.test("'report/manifest.json'")).toBe(false);
    });

    it('import specifiers are found and resolved', () => {
      const src = [
        "import { a } from '../../../src/apg-extractor/extractor.js';",
        "import type { B } from '@report/types.js';",
        "export * from './x.js';",
        "import 'side-effect';",
        "const m = await import('../../src/pipeline/run.js');",
        "const r = require('./legacy');",
      ].join('\n');
      const specs = importSpecifiers(src);
      expect(specs).toEqual(
        expect.arrayContaining([
          '../../../src/apg-extractor/extractor.js',
          '@report/types.js',
          './x.js',
          'side-effect',
          '../../src/pipeline/run.js',
          './legacy',
        ]),
      );
      expect(resolveSpecifier('scripts/lib/mutation/x.ts', '../../../src/apg-extractor/extractor.js')).toBe(
        'src/apg-extractor/extractor.js',
      );
      expect(resolveSpecifier('scripts/lib/mutation/x.ts', '@report/types.js')).toBe('src/report/types.js');
      expect(resolveSpecifier('scripts/lib/mutation/x.ts', 'ajv')).toBeNull();
      expect(forbiddenTarget('src/apg-extractor/extractor.js')).toBe(true);
      expect(forbiddenTarget('src/spec-parser/spec-parser.js')).toBe(false);
    });

    it('the Claude model-id and banned-token detectors fire', () => {
      expect(CLAUDE_MODEL_ID.test("const m = 'claude-opus-4-1';")).toBe(true);
      expect(CLAUDE_MODEL_ID.test("const bin = 'claude';")).toBe(false);
      expect(CLAUDE_MODEL_ID.test("const a = 'claude-code-cli';")).toBe(false);
      expect(CLAUDE_MODEL_ID.test("const m = 'claude-3-5-sonnet-20241022';")).toBe(true);
      expect(CLAUDE_MODEL_ID.test("const m = 'claude-code-cli-x claude-sonnet-4-5';")).toBe(true);
      expect(BANNED_TOKENS.test('const d = __dirname;')).toBe(true);
      expect(BANNED_TOKENS.test('const u = import.meta.url;')).toBe(true);
      expect(BANNED_TOKENS.test("const x = require('x');")).toBe(true);
      expect(BANNED_TOKENS.test("import * as fs from 'node:fs';")).toBe(false);
    });

    it('the entry-file check flags exports and top-level await only', () => {
      const good =
        "import { main } from './lib/m.js';\n" +
        'void main(process.argv.slice(2), process.cwd()).then((c) => { process.exitCode = c; }, () => { process.exitCode = 2; });\n';
      expect(entryFileViolations('good.ts', good)).toEqual([]);
      const nestedAwait = 'async function f(): Promise<void> { await Promise.resolve(); }\nvoid f();\n';
      expect(entryFileViolations('nested.ts', nestedAwait)).toEqual([]);
      expect(entryFileViolations('exp.ts', 'export const x = 1;\n')).toHaveLength(1);
      expect(entryFileViolations('reexp.ts', "export { main } from './m.js';\n")).toHaveLength(1);
      expect(entryFileViolations('tla.ts', 'process.exitCode = await Promise.resolve(0);\n')).toHaveLength(1);
    });
  });

  it('(a) no file under src/ imports from scripts/ (BR-U5a-53)', () => {
    const offenders: string[] = [];
    for (const file of walkTs('src')) {
      for (const spec of importSpecifiers(read(file))) {
        const target = resolveSpecifier(file, spec);
        if (target !== null && (target === 'scripts' || target.startsWith('scripts/'))) offenders.push(`${file} -> ${spec}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('(b) the mutation engine and manifest module read no detector output (BR-U5a-06)', () => {
    const offenders: string[] = [];
    for (const file of mutationEngineFiles()) {
      const source = read(file);
      for (const spec of importSpecifiers(source)) {
        const target = resolveSpecifier(file, spec);
        if (target !== null && forbiddenTarget(target)) offenders.push(`${file} imports ${spec}`);
      }
      if (REPORT_JSON_NAME.test(source)) offenders.push(`${file} names a *report*.json file`);
    }
    expect(offenders).toEqual([]);
  });

  it('(c) no generator module hard-codes a Claude model id (BR-U5a-51)', () => {
    const offenders = walkTs('scripts/lib/generators').filter((file) => CLAUDE_MODEL_ID.test(read(file)));
    expect(offenders).toEqual([]);
  });

  it('(c) no generator module or probe hard-codes an OpenAI model id (BR-U5a-51; ADR-029)', () => {
    const offenders = [...walkTs('scripts/lib/generators'), ...walkTs('scripts/generator/probes')].filter((file) => OPENAI_MODEL_ID.test(read(file)));
    expect(offenders).toEqual([]);
    expect(OPENAI_MODEL_ID.test("const m = 'gpt-5.6-terra';")).toBe(true);
    expect(OPENAI_MODEL_ID.test("const a = 'codex-cli';")).toBe(false);
  });

  it('(d) U5a scripts use no import.meta, __dirname, __filename or require( (D-U5a-13)', () => {
    const offenders = u5aScriptFiles().filter((file) => BANNED_TOKENS.test(read(file)));
    expect(offenders).toEqual([]);
  });

  it('(d) the entry files have no export and no top-level await (D-U5a-13 a)', () => {
    const problems: string[] = [];
    for (const file of ENTRY_FILES) {
      if (!fs.existsSync(path.resolve(REPO_ROOT, file))) continue;
      problems.push(...entryFileViolations(file, read(file)));
    }
    expect(problems).toEqual([]);
  });
});
