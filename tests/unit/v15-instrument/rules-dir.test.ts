/**
 * v1.5 rules shipped in the npx package: `rulesDir()` finds every `.cypher` rule from source and from the `dist` layout
 * that the build writes (`scripts/copy-v15-rules.mjs`, simulated in a temp copy; no full build). Zero model calls.
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { loadRules, rulesDir, rulesDirFrom } from '../../../src/v15-instrument/graph.js';

const REPO = path.resolve(__dirname, '..', '..', '..');
const SRC_RULES = path.join(REPO, 'src', 'v15-instrument', 'rules');
const RULE_FILES = fs.readdirSync(SRC_RULES).filter((f) => f.endsWith('.cypher')).sort();
const cypherIn = (d: string): string[] => fs.readdirSync(d).filter((f) => f.endsWith('.cypher')).sort();

let tmp: string;
let pkg: string;
let elsewhere: string;
beforeAll(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'v15-rules-dir-'));
  pkg = path.join(tmp, 'node_modules', 'daedalus-arch');
  elsewhere = path.join(tmp, 'user-project');
  fs.mkdirSync(elsewhere, { recursive: true });
  for (const f of ['v15-instrument/graph.js', 'v15-instrument/mcp/main.js', 'mcp-server/main.js', 'cli/bin.js']) {
    fs.mkdirSync(path.dirname(path.join(pkg, 'dist', f)), { recursive: true });
    fs.writeFileSync(path.join(pkg, 'dist', f), '');
  }
  execFileSync(process.execPath, [path.join(REPO, 'scripts', 'copy-v15-rules.mjs'), path.join(pkg, 'dist')], { stdio: 'pipe' });
});
afterAll(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

describe('rulesDir', () => {
  it('has rule files to ship', () => {
    expect(RULE_FILES.length).toBeGreaterThan(0);
  });

  it('resolves to the source rules from source', () => {
    const d = rulesDir();
    expect(d).toBe(SRC_RULES);
    expect(cypherIn(d)).toEqual(RULE_FILES);
    expect(loadRules(d).map((r) => r.file)).toEqual(RULE_FILES);
  });

  it('the build copy puts every rule next to the compiled graph module', () => {
    const dist = path.join(pkg, 'dist', 'v15-instrument', 'rules');
    expect(cypherIn(dist)).toEqual(RULE_FILES);
    for (const f of RULE_FILES) expect(fs.readFileSync(path.join(dist, f), 'utf8')).toBe(fs.readFileSync(path.join(SRC_RULES, f), 'utf8'));
  });

  it('resolves from the dist layout: next to the module, from each bin entry, and from the installed package', () => {
    const dist = path.join(pkg, 'dist', 'v15-instrument', 'rules');
    const cases = [
      { here: path.join(pkg, 'dist', 'v15-instrument'), cwd: elsewhere },
      { entry: path.join(pkg, 'dist', 'v15-instrument', 'mcp', 'main.js'), cwd: elsewhere },
      { entry: path.join(pkg, 'dist', 'mcp-server', 'main.js'), cwd: elsewhere },
      { entry: path.join(pkg, 'dist', 'cli', 'bin.js'), cwd: elsewhere },
      { cwd: tmp },
    ];
    for (const c of cases) {
      const d = rulesDirFrom(c);
      expect(d).toBe(dist);
      expect(cypherIn(d)).toEqual(RULE_FILES);
    }
  });
});
