/**
 * Tool-run validation for the team-declared-rules study: does the team's tool, as this study runs it, fire on an import
 * its declaration forbids? Most cases report 0 violations, so each repository gets one planted import (in the kept HEAD
 * worktree, restored afterwards; nothing is committed anywhere). `Docs/DiagnosticRuns/v1.3-declared-rules-2026-10-16.md`.
 *
 * Usage: npx tsx scripts/v1.3/declared-rules-plant.ts <case.json> <out.json>
 *
 * The planted edge: the first forbidden atom pair (A, B) of the translation, in atom order, with an importer in A that
 * the team's rule runs on, and a target in B, imported by a relative specifier (boundaries, dependency-cruiser) or by
 * the target project's `paths` alias (Nx, which forbids relative cross-project imports by a different check). The same
 * edge is evaluated by DaedalusArch (spec layers + allowed pairs) for the record.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { translate } from './declared-to-aac.js';
import type { Declaration } from './declared-to-aac.js';
import type { CaseInput } from './declared-rules-run.js';
import { readCompilerConfig } from './lib/graph-fidelity.js';

function lsFiles(root: string): string[] {
  const r = spawnSync('git', ['ls-files'], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28 });
  return r.stdout.split('\n').filter((f) => /\.(ts|tsx)$/.test(f) && !f.endsWith('.d.ts'));
}

function main(): void {
  const [casePath, outPath] = process.argv.slice(2);
  if (casePath === undefined || outPath === undefined) throw new Error('usage: declared-rules-plant.ts <case.json> <out.json>');
  const c = JSON.parse(readFileSync(casePath, 'utf8')) as CaseInput;
  const decl = JSON.parse(readFileSync(join(c.out, 'declaration.json'), 'utf8')) as Declaration;
  const files = lsFiles(c.root).filter((f) => !/(^|\/)(e2e|__tests__|test|tests)\//.test(f) && !/\.(spec|test)\.tsx?$/.test(f));
  const t = translate(decl, files);
  const excluded = new Set(t.excludedSources);
  const byAtom = new Map(t.atoms.map((a) => [a.id, a.files]));
  let aliasOf: (target: string) => string | undefined = () => undefined;
  if (c.family === 'nx') {
    const opts = readCompilerConfig(c.tsconfig).options;
    const paths = (opts.paths ?? {}) as Record<string, string[]>;
    const base = opts.baseUrl ?? c.root;
    aliasOf = (target) => Object.entries(paths).find(([k, v]) => !k.includes('*') && v.some((p) => relative(c.root, join(base, p)) === target))?.[0];
  }
  for (const f of t.forbidden) {
    const src = (byAtom.get(f.from) ?? []).find((x) => !excluded.has(x) && x.endsWith('.ts'));
    if (src === undefined) continue;
    const targets = byAtom.get(f.to) ?? [];
    const tgt = c.family === 'nx' ? targets.find((x) => aliasOf(x) !== undefined) : targets.find((x) => x.endsWith('.ts') && !x.endsWith('.d.ts'));
    if (tgt === undefined) continue;
    let spec = c.family === 'nx' ? aliasOf(tgt) ?? '' : relative(dirname(src), tgt).replace(/\.tsx?$/, '');
    if (c.family !== 'nx' && !spec.startsWith('.')) spec = `./${spec}`;
    const abs = join(c.root, src);
    const original = readFileSync(abs, 'utf8');
    writeFileSync(abs, `import ${JSON.stringify(spec)};\n${original}`);
    let fired = false;
    let messages: string[] = [];
    try {
      const env = { ...process.env, NX_DAEMON: 'false', NX_CACHE_DIRECTORY: join(c.root, '.nx-cache'), NX_PROJECT_GRAPH_CACHE_DIRECTORY: join(c.root, '.nx-graph'), NX_WORKSPACE_DATA_DIRECTORY: join(c.root, '.nx-data') };
      if (c.family === 'depcruise') {
        const cfg = c.configPath.split('/').pop() ?? '';
        const r = spawnSync(join(c.root, 'node_modules/.bin/depcruise'), ['--config', cfg, src, '--output-type', 'json'], { cwd: c.root, encoding: 'utf8', env, maxBuffer: 1 << 28 });
        const v = (JSON.parse(r.stdout) as { summary: { violations: { from: string; to: string; rule: { name: string } }[] } }).summary.violations.filter((x) => x.from === src && x.to === tgt);
        messages = v.map((x) => x.rule.name);
      } else {
        const flat = c.toolVersion.includes('eslint 8') ? 'false' : 'true';
        const args = flat === 'true' ? ['-c', 'declared-rules.eslint.config.mjs'] : ['--no-eslintrc', '-c', 'declared-rules.eslintrc.json'];
        const r = spawnSync(join(c.root, 'node_modules/.bin/eslint'), [...args, '--format', 'json', src], { cwd: c.root, encoding: 'utf8', env: { ...env, ESLINT_USE_FLAT_CONFIG: flat }, maxBuffer: 1 << 28 });
        const out = JSON.parse(r.stdout || '[]') as { messages: { ruleId: string | null; line: number; message: string }[] }[];
        messages = out.flatMap((x) => x.messages).filter((m) => m.line === 1 && m.ruleId !== null && (c.ruleIds ?? []).includes(m.ruleId)).map((m) => m.message);
      }
      fired = messages.length > 0;
    } finally {
      writeFileSync(abs, original);
    }
    const res = { id: c.id, repo: c.repo, family: c.family, source: src, target: tgt, specifier: spec, atoms: [f.from, f.to], declaredRules: f.rules, daedalusFlags: !t.allowed.includes(`${f.from}>${f.to}`), theirToolFires: fired, theirMessages: messages };
    writeFileSync(outPath, JSON.stringify(res, null, 1) + '\n');
    process.stdout.write(`${c.id}: planted ${src} -> ${tgt} (${spec}); their tool fires: ${String(fired)}\n`);
    return;
  }
  writeFileSync(outPath, JSON.stringify({ id: c.id, note: 'no forbidden pair with a usable importer and target' }, null, 1) + '\n');
  process.stdout.write(`${c.id}: no plantable pair\n`);
}

main();
