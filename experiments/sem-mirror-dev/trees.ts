/**
 * R-MIRROR-SEM development trees (allowed dev data only): the Hexagonal trap-family tasks (seed, clean and trap
 * solutions, gaming fixtures; baseline: the task's seed), the HCAL-04 and HCAL-05 bases and H11 cases (baseline: the
 * domain's base; read-only, assembled in a scratch dir), and the synthetic cases of `cases/` (baseline: the case's
 * `seed/` when it has one). Not here, by rule: trap-pilot-v2 (calibration only), HCAL-06, sealed sets.
 *
 * The oracle is the construct label for R-MIRROR-SEM (a core value set that is a renamed copy of a vendor value set and
 * that the core branches on): `labels.json` in this folder, written from reading each candidate-bearing tree; a tree
 * not listed there has no such set (`clean`).
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

export interface DevTree { readonly id: string; readonly tree: string; readonly spec: string; readonly baseline?: string; readonly oracle: string; readonly note: string }

const HERE = path.join('experiments', 'sem-mirror-dev');
const TF = path.join('experiments', 'trap-families');

export function labels(): Record<string, { label: string; note: string }> {
  const f = path.join(HERE, 'labels.json');
  return fs.existsSync(f) ? (JSON.parse(fs.readFileSync(f, 'utf8')) as Record<string, { label: string; note: string }>) : {};
}

export function devTrees(scratch: string = fs.mkdtempSync(path.join(os.tmpdir(), 'sem-mirror-dev-'))): DevTree[] {
  const lab = labels();
  const out: DevTree[] = [];
  const add = (id: string, tree: string, spec: string, baseline?: string): void => {
    const l = lab[id];
    out.push({ id, tree, spec, ...(baseline !== undefined ? { baseline } : {}), oracle: l?.label ?? 'clean', note: l?.note ?? '' });
  };
  for (const task of fs.readdirSync(TF).filter((d) => /^f\d+-hex-/.test(d)).sort((a, b) => Number(/\d+/.exec(a)![0]) - Number(/\d+/.exec(b)![0]))) {
    const spec = path.join(TF, task, 'spec.yaml');
    const seed = path.join(TF, task, 'seed');
    add(`${task}/seed`, seed, spec);
    for (const k of ['solutions', 'gaming']) {
      const d = path.join(TF, task, k);
      if (fs.existsSync(d)) for (const s of fs.readdirSync(d).sort()) add(`${task}/${k}/${s}`, path.join(d, s), spec, seed);
    }
  }
  for (const set of ['hcal-04', 'hcal-05']) {
    const dir = path.join('experiments', set);
    for (const domain of fs.readdirSync(dir).filter((d) => fs.existsSync(path.join(dir, d, 'labels.json'))).sort()) {
      const ls = JSON.parse(fs.readFileSync(path.join(dir, domain, 'labels.json'), 'utf8')) as Record<string, { rule: string }>;
      const base = path.join(dir, domain, 'base');
      add(`${set}/${domain}/base`, base, path.join(base, 'spec.yaml'));
      for (const c of Object.keys(ls).filter((k) => ls[k]!.rule === 'H11').sort()) {
        const tree = path.join(scratch, set, domain, c);
        fs.cpSync(base, tree, { recursive: true });
        fs.cpSync(path.join(dir, domain, 'cases', c), tree, { recursive: true });
        add(`${set}/${domain}/${c}`, tree, path.join(tree, 'spec.yaml'), base);
      }
    }
  }
  const cases = path.join(HERE, 'cases');
  if (fs.existsSync(cases)) {
    for (const c of fs.readdirSync(cases).sort()) {
      const d = path.join(cases, c);
      if (!fs.statSync(d).isDirectory()) continue;
      const seed = fs.existsSync(path.join(d, 'seed')) ? path.join(d, 'seed') : undefined;
      const tree = fs.existsSync(path.join(d, 'tree')) ? path.join(d, 'tree') : d;
      add(`synthetic/${c}`, tree, path.join(d, 'spec.yaml'), seed);
    }
  }
  return out;
}
