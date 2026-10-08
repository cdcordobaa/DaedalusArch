/**
 * U5b Step 19: the committed `corpus/corpus.json` (FR-05, FR-36; BR-U5b-66).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseCriteria, sha256Hex, validateCorpus } from '../../../../scripts/lib/corpus.js';
import { selectCorpus } from '../../../../scripts/select-corpus.js';
import type { CandidateList, Selection } from '../../../../scripts/select-corpus.js';
import type { CorpusFile } from '../../../../scripts/lib/corpus.js';
import { ROOT } from './score-fixture.js';

const corpus = JSON.parse(readFileSync(join(ROOT, 'corpus/corpus.json'), 'utf8')) as CorpusFile;
const CORE = ['dev-nest', 'realworld-test', 'ghostfolio-test', 'truthy-demo', 'dry-run-test'];

describe('corpus/corpus.json (BR-U5b-66)', () => {
  it('validates against corpus.schema.json, overlay hashes included', () => {
    expect(validateCorpus(corpus, ROOT)).toEqual([]);
  });

  it('holds the five core projects, each with an install policy, a tsc decision and a corpus spec path', () => {
    const core = corpus.entries.filter((e) => e.core);
    expect(core.map((e) => e.name)).toEqual(CORE);
    for (const e of core) {
      expect(['none', 'npm-ci-ignore-scripts']).toContain(e.install.policy);
      expect(e.tsc.tscVersion).toMatch(/^\d+\.\d+\.\d+$/);
      expect(e.specPath).toBe(`corpus/specs/${e.name}.yaml`);
    }
    expect(core.find((e) => e.name === 'dev-nest')?.install.policy).toBe('npm-ci-ignore-scripts');
    expect(core.find((e) => e.name === 'truthy-demo')?.tsc.tscVersion).toBe('4.7.4');
    expect(core.find((e) => e.name === 'ghostfolio-test')?.subPath).toBe('apps/api');
  });

  it('every overlay sha256 equals its committed patch file', () => {
    const overlays = corpus.entries.flatMap((e) => e.overlays);
    expect(overlays.length).toBeGreaterThanOrEqual(4);
    for (const o of overlays) expect(sha256Hex(readFileSync(join(ROOT, o.patchFile)))).toBe(o.sha256);
  });

  it('core commit SHAs equal the Docs/corpus.md clone table', () => {
    const doc = readFileSync(join(ROOT, 'Docs/corpus.md'), 'utf8');
    for (const e of corpus.entries.filter((x) => x.core)) {
      expect(doc).toMatch(new RegExp(`\\| \`${e.name}\` \\| ${e.originUrl.replace(/[.]/g, '\\.')} \\| \`[^\`]+\` \\| \`${e.commitSha}\``));
    }
  });
});

describe('corpus/candidates.json and corpus/selection.json (BR-U5b-68)', () => {
  const list = JSON.parse(readFileSync(join(ROOT, 'corpus/candidates.json'), 'utf8')) as CandidateList;
  const committed = JSON.parse(readFileSync(join(ROOT, 'corpus/selection.json'), 'utf8')) as Selection;

  it('re-running the seeded selection over the committed candidates gives the committed selection', () => {
    const criteria = parseCriteria(readFileSync(join(ROOT, 'Docs/corpus-criteria.md'), 'utf8'));
    const r = selectCorpus(list, criteria, corpus.entries.filter((e) => e.core).map((e) => e.originUrl));
    if (!r.ok) throw new Error(r.detail);
    expect(r.selection).toEqual(committed);
    expect(committed.selected.length).toBeGreaterThanOrEqual(3);
    expect(committed.selected.length).toBeLessThanOrEqual(5);
    expect(committed.selected.some((s) => s.style === 'layered')).toBe(true);
    expect(committed.excluded.length + committed.selected.length).toBe(list.candidates.length);
  });

  it('every selected project is an added corpus entry with commit, licence, install and tsc decisions', () => {
    const added = corpus.entries.filter((e) => !e.core);
    expect(added.map((e) => e.name)).toEqual(committed.selected.map((s) => s.name.replace('/', '__')));
    const byName = new Map(list.candidates.map((c) => [c.name.replace('/', '__'), c]));
    for (const e of added) {
      const c = byName.get(e.name);
      expect(e.commitSha).toBe(c?.commitSha);
      expect(e.licence).toBe(c?.licence);
      expect(e.install.policy).toBe('npm-ci-ignore-scripts');
      expect(e.tsc.kind).toBe('project');
    }
  });
});
