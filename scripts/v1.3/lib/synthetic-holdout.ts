/**
 * A SYNTHETIC stand-in for the sealed hold-out (Docs/v1.3/freeze-runbook.md, dry run): a directory with the hold-out's
 * structure (five styles, patch and overlay formats, reference.json / expected-findings.json / expected-graph.json),
 * generated from the DEVELOPMENT reference set by mechanical transformations. It reads no sealed path. It exists to
 * prove that holdout-run.ts and its scorer work end to end outside the repository; its figures are never a validity
 * figure and are not hold-out figures.
 *
 * Transformations (each one exercises a path of the runner):
 *   - every variant id except `clean` is renamed `<kind><nn>-syn-<rest>` (reference.json, the variant directory, its manifests);
 *   - every manifest description is prefixed `[SYNTHETIC]`;
 *   - in ddd, FF-DT01 is written as the provisional id FF-D01, and an id map (FF-D01 -> FF-DT01) is emitted (--id-map);
 *   - in clean-architecture, one violation variant gets one extra expected FF-S01 finding that the tool cannot report
 *     (a planted miss): the scorer must report exactly that miss and nothing else new;
 *   - a SYNTHETIC.md marker at the root.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { RuleIdMapFile } from './reference-model.js';

export const SYNTHETIC_PREFIX = 'syn-';
export const PROVISIONAL = { style: 'ddd', from: 'FF-D01', to: 'FF-DT01' } as const;

export interface PlantedMiss {
  readonly style: 'clean-architecture';
  readonly variant: string;
  readonly ruleId: 'FF-S01';
  readonly file: string;
  readonly target: string;
}

export interface SyntheticResult {
  readonly out: string;
  readonly idMap: RuleIdMapFile;
  readonly plantedMiss: PlantedMiss;
  readonly renamed: number;
}

const readJson = (f: string): Record<string, unknown> => JSON.parse(fs.readFileSync(f, 'utf8')) as Record<string, unknown>;
const writeJson = (f: string, v: unknown): void => { fs.writeFileSync(f, JSON.stringify(v, null, 2) + '\n'); };
/** `v01-x` -> `v01-syn-x`: the kind prefix (`v`, `n`, `g` + two digits) is kept, since the schemas read the kind from it. */
const synId = (id: string): string => (id === 'clean' ? id : id.replace(/^([vng]\d\d-)/, `$1${SYNTHETIC_PREFIX}`));

function renamePatchStyle(dir: string): number {
  const refFile = path.join(dir, 'reference.json');
  const ref = readJson(refFile);
  const ids = ref.variants as string[];
  for (const id of ids) {
    const vdir = path.join(dir, 'variants', id);
    const m = readJson(path.join(vdir, 'expected-findings.json'));
    m.variant = synId(id);
    m.description = `[SYNTHETIC] ${String(m.description)}`;
    writeJson(path.join(vdir, 'expected-findings.json'), m);
    if (id !== 'clean') fs.renameSync(vdir, path.join(dir, 'variants', synId(id)));
  }
  ref.variants = ids.map(synId);
  for (const k of ['notApplicable', 'noViolatingVariant']) {
    // Variant ids named in these lists (if any) follow the rename.
    ref[k] = JSON.parse(JSON.stringify(ref[k] ?? []).replace(/"([vng]\d\d-[a-z0-9-]+)"/g, (_s, id: string) => (ids.includes(id) ? `"${synId(id)}"` : `"${id}"`))) as unknown;
  }
  writeJson(refFile, ref);
  return ids.filter((i) => i !== 'clean').length;
}

function renameOverlayStyle(dir: string, rewriteIds: (t: string) => string): number {
  const vroot = path.join(dir, 'variants');
  const cleanFile = path.join(dir, 'clean', 'expected-findings.json');
  fs.writeFileSync(cleanFile, rewriteIds(fs.readFileSync(cleanFile, 'utf8')));
  let n = 0;
  for (const id of fs.readdirSync(vroot).sort()) {
    const vdir = path.join(vroot, id);
    const v = readJson(path.join(vdir, 'variant.json'));
    v.id = synId(id);
    v.plants = `[SYNTHETIC] ${String(v.plants)}`;
    fs.writeFileSync(path.join(vdir, 'variant.json'), rewriteIds(JSON.stringify(v, null, 2) + '\n'));
    const f = readJson(path.join(vdir, 'expected-findings.json'));
    f.variant = synId(id);
    fs.writeFileSync(path.join(vdir, 'expected-findings.json'), rewriteIds(JSON.stringify(f, null, 2) + '\n'));
    fs.renameSync(vdir, path.join(vroot, synId(id)));
    n += 1;
  }
  return n;
}

/** Adds one expected FF-S01 finding the tool cannot report to the first clean-architecture FF-S01 violation variant. */
function plantMiss(dir: string): PlantedMiss {
  const ref = readJson(path.join(dir, 'reference.json'));
  for (const id of ref.variants as string[]) {
    const file = path.join(dir, 'variants', id, 'expected-findings.json');
    const m = readJson(file);
    const fs01 = (m.expectedFindings as Record<string, string>[]).find((f) => f.ruleId === 'FF-S01' && typeof f.target === 'string');
    if (m.kind !== 'violation' || fs01 === undefined) continue;
    // A domain file never imports the composition root; nothing in the project makes this edge.
    const target = 'src/infrastructure/main.ts';
    if (!fs.existsSync(path.join(dir, 'project', target))) throw new Error(`synthetic: ${target} not in the clean-architecture project`);
    (m.expectedFindings as Record<string, string>[]).push({
      ruleId: 'FF-S01', ruleName: fs01.ruleName ?? 'dependency-direction', file: fs01.file ?? '', target,
      reason: '[SYNTHETIC planted miss] no such import exists; the scorer must count exactly this finding as a miss.',
    });
    writeJson(file, m);
    return { style: 'clean-architecture', variant: id, ruleId: 'FF-S01', file: fs01.file ?? '', target };
  }
  throw new Error('synthetic: no clean-architecture FF-S01 violation variant');
}

/** Writes the synthetic stand-in to `out` (which must not exist) from the development set at `from`. */
export function generateSyntheticHoldout(from: string, out: string): SyntheticResult {
  if (fs.existsSync(out)) throw new Error(`${out} exists; give a new directory`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.cpSync(from, out, { recursive: true });
  let renamed = 0;
  for (const style of ['clean-architecture', 'layered', 'nestjs', 'hexagonal']) renamed += renamePatchStyle(path.join(out, style));
  const toProvisional = (t: string): string => t.replace(new RegExp(PROVISIONAL.to, 'g'), PROVISIONAL.from);
  renamed += renameOverlayStyle(path.join(out, 'ddd'), toProvisional);
  const plantedMiss = plantMiss(path.join(out, 'clean-architecture'));
  const idMap: RuleIdMapFile = {
    schemaVersion: 1,
    note: 'SYNTHETIC stand-in: the ddd manifests use the provisional id FF-D01 for FF-DT01.',
    styles: { ddd: { [PROVISIONAL.from]: PROVISIONAL.to } },
  };
  fs.writeFileSync(path.join(out, 'SYNTHETIC.md'), [
    '# SYNTHETIC hold-out stand-in',
    '',
    'Generated by scripts/v1.3/synthetic-holdout.ts from the development reference set. Not the sealed hold-out,',
    'not a hold-out result, never a validity figure. Planted miss:',
    `${plantedMiss.style}/${plantedMiss.variant} ${plantedMiss.ruleId} ${plantedMiss.file} -> ${plantedMiss.target}.`,
    '',
  ].join('\n'));
  return { out, idMap, plantedMiss, renamed };
}
