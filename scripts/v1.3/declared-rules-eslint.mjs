#!/usr/bin/env node
/**
 * ESLint families of the team-declared-rules study (eslint-plugin-boundaries, Nx enforce-module-boundaries).
 * `Docs/DiagnosticRuns/v1.3-declared-rules-2026-10-16.md`.
 *
 * node scripts/v1.3/declared-rules-eslint.mjs effective --rule <id> --files <list> --eslint-module eslint --flat true|false --out <json>
 *   (cwd = the lint directory) the team's effective rule level for every linted file, and the enabled config.
 * node scripts/v1.3/declared-rules-eslint.mjs build [--effective <json>] \
 *   --family boundaries|nx --print <eslint --print-config output> [--graph <nx graph --file output>] \
 *   --rule <rule id> --plugin <plugin package> --plugin-key <plugin key> --parser <parser package> \
 *   --flat true|false --decl-out <declaration JSON> --config-out <minimal ESLint config path>
 *
 * The declaration (input of declared-to-aac.ts) is read from what the team's ESLint resolves for a source file
 * (`--print-config`), so presets, `extends` and computed configs are already applied; for Nx the project roots and
 * tags come from the project graph Nx itself computes. The minimal config holds the team's `settings` and the one rule
 * with its options verbatim, with the team's installed plugin and parser: the team's tool, restricted to the rule
 * under study (no type-aware rules, no other plugins). No config of the team is edited.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const argv = process.argv.slice(2);
const opt = (k) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined; };
const need = (k) => { const v = opt(k); if (v === undefined) throw new Error(`--${k} is required`); return v; };

const SEVERITY = { off: 0, warn: 1, error: 2 };
const level = (v) => { const l = Array.isArray(v) ? v[0] : v; return typeof l === 'string' ? SEVERITY[l] ?? 0 : l ?? 0; };

/**
 * `effective`: the team's own configuration as their ESLint computes it for EVERY linted file
 * (`calculateConfigForFile`): which files run the rule (per-project / per-directory overrides that turn it off are
 * part of the declaration), and the settings and options of the enabled files. Run with cwd = the lint directory.
 */
async function effective() {
  const ruleId = need('rule');
  const files = readFileSync(need('files'), 'utf8').split('\n').filter(Boolean);
  const req = createRequire(resolve('package.json'));
  const eslintMod = req(need('eslint-module'));
  const ESLint = need('flat') === 'true' ? (eslintMod.loadESLint ? await eslintMod.loadESLint({ useFlatConfig: true }) : eslintMod.ESLint) : eslintMod.ESLint;
  const eslint = new ESLint({ cwd: process.cwd() });
  const byFile = {};
  const optionSets = new Map();
  let representative;
  for (const f of files) {
    let cfg;
    try { cfg = await eslint.calculateConfigForFile(f); } catch (e) { byFile[f] = `error: ${String(e.message).split('\n')[0]}`; continue; }
    if (cfg === undefined || cfg === null) { byFile[f] = 'ignored'; continue; }
    const v = cfg.rules?.[ruleId];
    const l = v === undefined ? 0 : level(v);
    byFile[f] = l;
    if (l > 0) {
      const key = JSON.stringify([Array.isArray(v) ? v.slice(1) : [], cfg.settings ?? {}]);
      optionSets.set(key, (optionSets.get(key) ?? 0) + 1);
      if (representative === undefined) representative = { file: f, settings: cfg.settings ?? {}, rules: { [ruleId]: v } };
    }
  }
  const out = { ruleId, byFile, distinctEnabledConfigs: [...optionSets.values()], representative };
  writeFileSync(need('out'), JSON.stringify(out, null, 1) + '\n');
  const on = Object.values(byFile).filter((x) => typeof x === 'number' && x > 0).length;
  process.stderr.write(`effective: ${String(on)}/${String(files.length)} files run ${ruleId}; ${String(optionSets.size)} distinct enabled config(s)\n`);
}

/**
 * The resolved config: `eslint --print-config` output, or, when the team's full config cannot be loaded by their own
 * ESLint (`--eslintrc <file>`: a legacy `.eslintrc.{js,cjs,json}`), that object read directly (its own `settings` and
 * `rules`; no `extends` resolution, which the rules under study do not use).
 */
function readPrinted() {
  const eff = opt('effective');
  if (eff !== undefined) {
    const e = JSON.parse(readFileSync(eff, 'utf8'));
    if (e.representative !== undefined) return { settings: e.representative.settings, rules: e.representative.rules, effective: e };
  }
  const text = readFileSync(need('print'), 'utf8').trim();
  if (text.startsWith('{')) return JSON.parse(text);
  const rc = opt('eslintrc');
  if (rc === undefined) throw new Error('print-config failed and no --eslintrc fallback was given');
  const abs = resolve(rc);
  const obj = abs.endsWith('.json') ? JSON.parse(readFileSync(abs, 'utf8')) : createRequire(abs)(abs);
  const rules = Object.fromEntries(Object.entries(obj.rules ?? {}).map(([k, v]) => {
    const arr = Array.isArray(v) ? [...v] : [v];
    if (typeof arr[0] === 'string') arr[0] = SEVERITY[arr[0]] ?? arr[0];
    return [k, arr];
  }));
  process.stderr.write(`declared-rules-eslint: --print-config failed; read ${rc} directly\n`);
  return { settings: obj.settings ?? {}, rules, fromEslintrc: rc };
}

function build() {
  const family = need('family');
  const ruleId = need('rule');
  const printed = readPrinted();
  const rule = printed.rules?.[ruleId];
  if (rule === undefined) throw new Error(`rule ${ruleId} is not configured for the probe file`);
  const [lvl, ...options] = Array.isArray(rule) ? rule : [rule];
  const level = typeof lvl === 'string' ? SEVERITY[lvl] ?? lvl : lvl;
  // Files the team's configuration does not run the rule on (per-project or per-directory overrides).
  const disabledFiles = printed.effective !== undefined
    ? Object.entries(printed.effective.byFile).filter(([, l]) => l === 0).map(([f]) => f).sort() : [];
  const distinct = printed.effective?.distinctEnabledConfigs ?? [1];
  const settings = printed.settings ?? {};
  let decl;
  if (family === 'boundaries') {
    decl = {
      family,
      elements: settings['boundaries/elements'] ?? [],
      options: options[0] ?? {},
      ...(settings['boundaries/include'] !== undefined ? { include: settings['boundaries/include'] } : {}),
      ...(settings['boundaries/ignore'] !== undefined ? { ignore: settings['boundaries/ignore'] } : {}),
      ...(settings['boundaries/dependency-nodes'] !== undefined ? { dependencyNodes: settings['boundaries/dependency-nodes'] } : {}),
      ruleLevel: level,
      rootPath: settings['boundaries/root-path'] ?? null,
      disabledFiles, distinctEnabledConfigs: distinct,
    };
  } else if (family === 'nx') {
    const graph = JSON.parse(readFileSync(need('graph'), 'utf8'));
    const nodes = Object.values(graph.graph?.nodes ?? {});
    const o = options[0] ?? {};
    const { depConstraints = [], allow = [], ...rest } = o;
    decl = {
      family,
      projects: nodes.map((n) => ({ name: n.name, root: n.data?.root ?? '', tags: n.data?.tags ?? [], type: n.type })).sort((a, b) => (a.name < b.name ? -1 : 1)),
      depConstraints, allow, options: rest, ruleLevel: level,
      disabledFiles, distinctEnabledConfigs: distinct,
    };
  } else {
    throw new Error(`unknown family ${family}`);
  }
  writeFileSync(need('decl-out'), JSON.stringify(decl, null, 1) + '\n');

  const pluginPkg = need('plugin');
  const pluginKey = need('plugin-key');
  const parserPkg = need('parser');
  const parserOptions = { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true } };
  const ruleValue = [level, ...options];
  if (need('flat') === 'true') {
    writeFileSync(need('config-out'), [
      `import plugin from ${JSON.stringify(pluginPkg)};`,
      `import * as parserNs from ${JSON.stringify(parserPkg)};`,
      'const parser = parserNs.default?.parseForESLint ? parserNs.default : (parserNs.parser ?? parserNs.default ?? parserNs);',
      'export default [{',
      "  files: ['**/*.ts', '**/*.tsx', '**/*.mts', '**/*.cts'],",
      `  languageOptions: { parser, parserOptions: ${JSON.stringify(parserOptions)} },`,
      `  plugins: { ${JSON.stringify(pluginKey)}: plugin },`,
      `  settings: ${JSON.stringify(settings)},`,
      `  rules: { ${JSON.stringify(ruleId)}: ${JSON.stringify(ruleValue)} },`,
      '}' + (disabledFiles.length > 0 ? `, { files: ${JSON.stringify(disabledFiles)}, rules: { ${JSON.stringify(ruleId)}: 'off' } }` : '') + '];',
      '',
    ].join('\n'));
  } else {
    writeFileSync(need('config-out'), JSON.stringify({
      root: true, parser: parserPkg, parserOptions, plugins: [pluginKey], settings, rules: { [ruleId]: ruleValue },
      ...(disabledFiles.length > 0 ? { overrides: [{ files: disabledFiles, rules: { [ruleId]: 'off' } }] } : {}),
    }, null, 1) + '\n');
  }
}

if (argv[0] === 'build') build();
else if (argv[0] === 'effective') await effective();
else { process.stderr.write('usage: declared-rules-eslint.mjs build ...\n'); process.exit(2); }
