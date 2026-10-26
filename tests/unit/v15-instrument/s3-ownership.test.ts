/**
 * v1.5 instrument (Stage 0): the S3 ownership facts, deterministic part. Zero model calls: the answers below are
 * written by hand. A grounded root becomes a declared aggregate that the graph build reads.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import YAML from 'yaml';
import { loadRules, runTree, writeTsconfig } from '../../../src/v15-instrument/graph.js';
import { groundAnswer, listingBatches, resolves, s3Problem, writeSpecWithAggregates, type S3Answer } from '../../../src/v15-instrument/s3-ownership.js';

const REPO = path.resolve(__dirname, '..', '..', '..');
const FIX = path.join(REPO, 'experiments', 'detect-02', 'fixtures', 'precision', 'p04-one-aggregate-saved-twice');

describe('S3 ownership facts', () => {
  let tmp: string;
  beforeAll(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'v15-s3-')); });
  afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

  it('checks the answer shape', () => {
    expect(s3Problem({ types: [], stores: [] })).toBeNull();
    expect(s3Problem(null)).toBe('not an object');
    expect(s3Problem({ types: [] })).toBe('types/stores');
    expect(s3Problem({ types: [{ name: 'A', path: 'a.ts', verdict: 'maybe', cites: [] }], stores: [] })).toBe('type entry');
  });

  it('lists the domain and store types per context, hides the declared aggregates, and grounds only resolvable roots', () => {
    const meta = JSON.parse(fs.readFileSync(path.join(FIX, 'fixture.json'), 'utf8')) as { legit: string };
    const tree = path.join(FIX, meta.legit);
    const spec = path.join(FIX, 'spec.yaml');
    const declared = (YAML.parse(fs.readFileSync(spec, 'utf8')) as { architecture: { ddd: { aggregates: { name: string; root: string; context: string }[] } } }).architecture.ddd.aggregates;
    expect(declared.length).toBeGreaterThan(0);
    const hidden = writeSpecWithAggregates(spec, path.join(tmp, 'hidden.yaml'), null);
    expect((YAML.parse(fs.readFileSync(hidden, 'utf8')) as { architecture: { ddd: Record<string, unknown> } }).architecture.ddd['aggregates']).toBeUndefined();
    const batches = listingBatches({ repo: 'p04', tree, tsconfig: writeTsconfig(tree, tmp), hiddenSpec: hidden });
    expect(batches.length).toBeGreaterThan(0);
    const listed = batches.flatMap((b) => b.listed);
    const root = declared[0]!;
    const entry = listed.find((l) => l.name === root.name && l.file === root.root);
    expect(entry).toBeDefined();
    expect(batches.every((b) => b.prompt.includes('SOURCE-BEGIN') && !b.prompt.includes('aggregates:'))).toBe(true);

    const batch = batches.find((b) => b.listed.includes(entry!))!;
    const line = fs.readFileSync(path.join(tree, entry!.file), 'utf8').split('\n')[entry!.line - 1]!;
    const good = { path: entry!.file, line: entry!.line, quote: line.trim().slice(0, 40) };
    expect(resolves(tree, batch.files, good)).toBe(true);
    expect(resolves(tree, batch.files, { ...good, quote: 'class NotThere' })).toBe(false);
    expect(resolves(tree, batch.files, { ...good, path: 'src/elsewhere.ts' })).toBe(false);

    const answer: S3Answer = {
      types: [
        { name: entry!.name, path: entry!.file, verdict: 'root', context: root.context, cites: [good] },
        { name: 'Invented', path: entry!.file, verdict: 'root', context: root.context, cites: [good] },
        { name: entry!.name, path: entry!.file, verdict: 'root', context: root.context, cites: [{ ...good, quote: 'no such text' }] },
        { name: 'Other', path: entry!.file, verdict: 'abstain', context: null, cites: [] },
      ],
      stores: [],
    };
    const facts = groundAnswer(tree, batch, answer);
    expect(facts.verdicts.map((v) => [v.name, v.grounded, v.listed])).toEqual([[entry!.name, true, true], ['Invented', true, false], [entry!.name, false, true], ['Other', true, false]]);
    expect(facts.aggregates).toEqual([{ name: entry!.name, context: root.context, module: `${path.posix.dirname(entry!.file)}/**`, root: entry!.file, inner_entities: [] }]);
  });

  it('a spec with the grounded roots is read as declared roots by the graph build', async () => {
    const meta = JSON.parse(fs.readFileSync(path.join(FIX, 'fixture.json'), 'utf8')) as { legit: string };
    const tree = path.join(FIX, meta.legit);
    const spec = path.join(FIX, 'spec.yaml');
    const declared = (YAML.parse(fs.readFileSync(spec, 'utf8')) as { architecture: { ddd: { aggregates: { name: string; context: string; module: string; root: string }[] } } }).architecture.ddd.aggregates;
    const withRoots = writeSpecWithAggregates(spec, path.join(tmp, 's3.yaml'), declared.map((a) => ({ name: a.name, context: a.context, module: a.module, root: a.root, inner_entities: [] })));
    const r = await runTree(tree, loadRules(), { spec: withRoots, scratch: tmp, withApg: false });
    expect(r.facts.rootSource).toBe('spec');
    expect(r.facts.roots.map((x) => x.name).sort()).toEqual(declared.map((a) => a.name).sort());
  }, 120_000);
});
