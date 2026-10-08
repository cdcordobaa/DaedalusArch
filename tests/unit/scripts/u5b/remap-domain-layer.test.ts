/**
 * U5b Step 21: scripted domain-layer remap of the corpus specs (ADR-017 item 4; BR-U5b-77).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { DOMAIN_DIRECTORY, DOMAIN_FILE_PATTERN, main, remap } from '../../../../scripts/remap-domain-layer.js';
import { validateSpecSchema } from '../../../../src/spec-parser/spec-validator.js';
import { ROOT } from './score-fixture.js';

interface Layer { name: string; kind?: string; directories?: string[]; file_patterns?: string[]; roles: string[] }
interface Spec { architecture: { layers: Layer[] } & Record<string, unknown> }

const NESTJS = readFileSync(join(ROOT, 'presets/nestjs.yaml'), 'utf8');
const LAYERED = readFileSync(join(ROOT, 'presets/layered.yaml'), 'utf8');
const parse = (t: string): Spec => parseYaml(t) as Spec;

/** Lines of `before` appear in `after` in order (the remap only inserts). */
function onlyInserts(before: string, after: string): boolean {
  const b = before.split('\n');
  const a = after.split('\n');
  let j = 0;
  for (const line of a) if (j < b.length && line === b[j]) j++;
  return j === b.length;
}

describe('remap (BR-U5b-77)', () => {
  it('adds both globs to an existing domain layer, keeps every other byte, and is idempotent', () => {
    const once = remap(NESTJS);
    expect(once.editedPaths).toEqual(['architecture.layers[0].directories', 'architecture.layers[0].file_patterns']);
    expect(onlyInserts(NESTJS, once.text)).toBe(true);
    const twice = remap(once.text);
    expect(twice.text).toBe(once.text);
    expect(twice.editedPaths).toEqual([]);
    const before = parse(NESTJS);
    const after = parse(once.text);
    const domain = after.architecture.layers[0];
    expect(domain?.directories).toEqual([...(before.architecture.layers[0]?.directories ?? []), DOMAIN_DIRECTORY]);
    expect(domain?.file_patterns).toEqual([DOMAIN_FILE_PATTERN]);
    expect(validateSpecSchema(after).valid).toBe(true);
  });

  it('leaves non-domain keys untouched', () => {
    const before = parse(NESTJS) as unknown as Record<string, unknown> & Spec;
    const after = parse(remap(NESTJS).text) as unknown as Record<string, unknown> & Spec;
    expect(after.architecture.layers.slice(1)).toEqual(before.architecture.layers.slice(1));
    expect({ ...after, architecture: null }).toEqual({ ...before, architecture: null });
    expect(after.architecture.layers[0]?.roles).toEqual(before.architecture.layers[0]?.roles);
  });

  it('finds the domain layer by `kind: domain` (layered preset `business`)', () => {
    const r = remap(LAYERED);
    expect(r.editedPaths).toEqual(['architecture.layers[1].directories', 'architecture.layers[1].file_patterns']);
    expect(onlyInserts(LAYERED, r.text)).toBe(true);
    expect(parse(r.text).architecture.layers[1]?.directories).toEqual(['src/business/**', DOMAIN_DIRECTORY]);
    expect(validateSpecSchema(parse(r.text)).valid).toBe(true);
  });

  it('gives a spec without a domain layer one, as the first layer', () => {
    const NO_DOMAIN = LAYERED.replace('      kind: domain\n', '').replace('- name: business', '- name: services');
    const r = remap(NO_DOMAIN);
    expect(r.editedPaths).toEqual(['architecture.layers[+domain]']);
    expect(onlyInserts(NO_DOMAIN, r.text)).toBe(true);
    const after = parse(r.text);
    expect(after.architecture.layers[0]).toEqual({ name: 'domain', directories: [DOMAIN_DIRECTORY], file_patterns: [DOMAIN_FILE_PATTERN], roles: ['entity'] });
    expect(after.architecture.layers.slice(1)).toEqual(parse(NO_DOMAIN).architecture.layers);
    expect(validateSpecSchema(after).valid).toBe(true);
    expect(remap(r.text).text).toBe(r.text);
  });

  it('handles flow lists, a `kind: domain` layer under another name, and a spec already remapped', () => {
    const flow = 'architecture:\n  layers:\n    - name: core # inner\n      kind: domain\n      directories: [src/core/**]\n      roles: [entity]\n    - name: app\n      roles: [service]\n';
    const r = remap(flow);
    expect(r.editedPaths).toEqual(['architecture.layers[0].directories', 'architecture.layers[0].file_patterns']);
    expect(r.text).toContain('directories: [src/core/**, "**/domain/**"]');
    expect(r.text).toContain('# inner');
    expect(parse(r.text).architecture.layers[0]?.file_patterns).toEqual([DOMAIN_FILE_PATTERN]);
    expect(remap(r.text).text).toBe(r.text);
    const done = `architecture:\n  layers:\n    - name: domain\n      directories:\n        - "${DOMAIN_DIRECTORY}"\n      file_patterns:\n        - "${DOMAIN_FILE_PATTERN}"\n      roles: [entity]\n`;
    expect(remap(done)).toEqual({ text: done, editedPaths: [], untouched: [] });
  });

  it('--self-test exits 1 (a spec without layers is reported untouched); no file is a usage error', async () => {
    const out: string[] = [];
    const io = { out: (t: string): void => { out.push(t); }, err: (t: string): void => { out.push(t); } };
    expect(await main(['--self-test'], io)).toBe(1);
    expect(out.join('')).toMatch(/reported untouched/);
    expect(await main([], io)).toBe(1);
  });
});
