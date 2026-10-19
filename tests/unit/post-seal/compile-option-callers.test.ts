/**
 * v1.4 U2 caller table (design BR-U2-10, §6 test 9; plan step 9.9): every file under `src/` and `scripts/` that imports
 * `V13_COMPILE_OPTIONS` (forward: gets the post-seal rules) or `V13_SEALED_COMPILE_OPTIONS` (the sealed rule set) is
 * listed in ADR-V14-02's "Callers" table with the options it imports. A new caller cannot pick up the post-seal rules
 * without being listed.
 * v1.4 U2 verification: the scripts that build the pipeline themselves (`createPipeline`, `runPipeline`) must set
 * `postSealRules` explicitly, and the scripts that shell out to `firewall evaluate` must pass `--post-seal on|off`,
 * so that no registered figure picks up the post-seal rules from a default.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { ROOT } from './helpers.js';

const NAMES = ['V13_COMPILE_OPTIONS', 'V13_SEALED_COMPILE_OPTIONS'];

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (/\.(?:ts|mts|mjs)$/.test(e.name)) out.push(p);
  }
  return out;
}

/** `file -> sorted option names` for every file whose import statements name one of the two options. */
function importers(): Map<string, string> {
  const out = new Map<string, string>();
  const rx = /import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*['"][^'"]+['"]/g;
  for (const root of ['src', 'scripts']) {
    for (const file of walk(path.join(ROOT, root))) {
      const text = fs.readFileSync(file, 'utf8');
      const hit = new Set<string>();
      for (const m of text.matchAll(rx)) {
        for (const n of (m[1] ?? '').split(',').map((s) => s.trim().split(/\s+as\s+/)[0] ?? '')) if (NAMES.includes(n)) hit.add(n);
      }
      if (hit.size > 0) out.set(path.relative(ROOT, file).split(path.sep).join('/'), [...hit].sort().join(', '));
    }
  }
  return out;
}

/** The ADR-V14-02 "Callers" table: `file -> options` (the first two cells, backticks removed). */
function callerTable(): Map<string, string> {
  const doc = fs.readFileSync(path.join(ROOT, 'Docs/v1.4/adr-v14.md'), 'utf8');
  const adr = doc.slice(doc.indexOf('## ADR-V14-02'));
  const start = adr.indexOf('### Callers');
  expect(start).toBeGreaterThanOrEqual(0);
  const rest = adr.slice(start + 4);
  const next = rest.search(/\n#{2,3} /);
  const section = next < 0 ? rest : rest.slice(0, next);
  const rows = section.split('\n').filter((l) => l.startsWith('|')).slice(2);
  return new Map(rows.map((l) => {
    const cells = l.split('|').slice(1, -1).map((c) => c.trim().replace(/`/g, ''));
    return [cells[0] ?? '', (cells[1] ?? '').split(',').map((s) => s.trim()).sort().join(', ')];
  }));
}

describe('V13 compile option callers', () => {
  it('the importers of V13_COMPILE_OPTIONS and V13_SEALED_COMPILE_OPTIONS equal the ADR-V14-02 caller table', () => {
    const sortMap = (m: Map<string, string>): [string, string][] => [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    expect(sortMap(importers())).toEqual(sortMap(callerTable()));
  });

  it('every script that builds the pipeline sets postSealRules explicitly', () => {
    const missing = walk(path.join(ROOT, 'scripts'))
      .filter((f) => /\b(?:createPipeline|runPipeline)\(/.test(fs.readFileSync(f, 'utf8')) && !/\bpostSealRules\b/.test(fs.readFileSync(f, 'utf8')))
      .map((f) => path.relative(ROOT, f).split(path.sep).join('/'));
    expect(missing).toEqual([]);
  });

  it('every script that runs `firewall evaluate` passes --post-seal', () => {
    const missing: string[] = [];
    for (const f of walk(path.join(ROOT, 'scripts'))) {
      for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
        if (/(?:firewall\.ts'\)?|CLI_ENTRY|cli\/bin\.ts'), 'evaluate',/.test(line) && !line.includes("'--post-seal'")) missing.push(path.relative(ROOT, f).split(path.sep).join('/'));
      }
    }
    // Exempt, each with its reason (ADR-V14-02, "Callers"): run-experiment.ts runs the registered v1.2E plans with
    // --scoring v1.2e, where --post-seal is not read; judge-catch-run.ts is byte-frozen (Docs/v1.3/judge-catch-frozen.md);
    // freeze-gate-main.ts is the U5a gate, whose argv is pinned by tests/unit/scripts/mutation/freeze-gates.test.ts.
    const exempt = new Set(['scripts/run-experiment.ts', 'scripts/v1.3/judge-catch-run.ts', 'scripts/lib/freeze-gate-main.ts']);
    expect(missing.filter((f) => !exempt.has(f))).toEqual([]);
  });
});
