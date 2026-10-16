import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  DEFAULT_SPEC_NAME,
  existingSpec,
  inferredBanner,
  inferredSpecFile,
  labelJsonReport,
  runInit,
} from '../../../src/cli/init-command.js';
import type { SpecProposal } from '../../../src/ise/propose.js';

function proposal(over: Partial<SpecProposal> = {}): SpecProposal {
  return {
    label: 'inferred spec, not author-declared',
    style: 'layered',
    styleConfidence: 1,
    styleEvidence: [],
    ranking: [{ style: 'layered', confidence: 1 }],
    mappings: [{ layer: 'business', glob: 'src/kernel/**', kind: 'directory', origin: 'inferred', confidence: 0.5, source: 'structure', files: 3, evidence: 'import structure only' }],
    unassignedFiles: [],
    questions: [{ id: 'unit:src/kernel/', subject: 'src/kernel/', question: 'Is src/kernel/ the business layer?', proposed: 'business', alternatives: [], reason: 'r' }],
    observations: [],
    check: { valid: true, compiles: true, errors: [], warnings: [] },
    yaml: '# INFERRED SPEC\nspec_version: "1.0.0"\n',
    ...over,
  };
}

function io(p: SpecProposal = proposal()) {
  const out: string[] = [];
  const err: string[] = [];
  const propose = jest.fn().mockResolvedValue(p);
  return { out, err, propose, deps: { propose, out: (t: string) => out.push(t), err: (t: string) => err.push(t) } };
}

describe('firewall init', () => {
  let dir: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'init-cmd-'));
  });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('writes the proposal to <project>/firewall.spec.yaml with a human summary', async () => {
    const t = io();
    expect(await runInit({ project: dir }, t.deps)).toBe(0);
    expect(fs.readFileSync(path.join(dir, DEFAULT_SPEC_NAME), 'utf8')).toBe(proposal().yaml);
    const err = t.err.join('');
    expect(err).toMatch(/Proposed spec \(inferred spec, not author-declared\)/);
    expect(err).toMatch(/src\/kernel\/\*\*.*INFERRED 0\.50/);
    expect(err).toMatch(/Q1\. Is src\/kernel\/ the business layer\?/);
  });

  it('never overwrites a spec: the target, or any known spec name in the project', async () => {
    fs.writeFileSync(path.join(dir, DEFAULT_SPEC_NAME), 'mine');
    const t = io();
    expect(await runInit({ project: dir }, t.deps)).toBe(1);
    expect(fs.readFileSync(path.join(dir, DEFAULT_SPEC_NAME), 'utf8')).toBe('mine');
    expect(t.propose).not.toHaveBeenCalled();
    expect(t.err.join('')).toMatch(/already exists; init never overwrites a spec/);

    fs.rmSync(path.join(dir, DEFAULT_SPEC_NAME));
    fs.writeFileSync(path.join(dir, 'spec.yaml'), 'theirs');
    expect(await runInit({ project: dir }, io().deps)).toBe(1);
    expect(fs.existsSync(path.join(dir, DEFAULT_SPEC_NAME))).toBe(false);
    // An explicit, new --out is allowed next to an existing spec; an existing --out is not.
    const out = path.join(dir, 'proposal.yaml');
    expect(await runInit({ project: dir, out }, io().deps)).toBe(0);
    expect(await runInit({ project: dir, out }, io().deps)).toBe(1);
    expect(fs.readFileSync(path.join(dir, 'spec.yaml'), 'utf8')).toBe('theirs');
  });

  it('existingSpec reports the target first, then known names only without --out', () => {
    expect(existingSpec(dir, undefined)).toBeUndefined();
    fs.writeFileSync(path.join(dir, '.firewall.yaml'), 'x');
    expect(existingSpec(dir, undefined)).toBe(path.join(dir, '.firewall.yaml'));
    expect(existingSpec(dir, path.join(dir, 'new.yaml'))).toBeUndefined();
  });

  it('--print writes nothing and prints the YAML; --format json prints the proposal', async () => {
    const t = io();
    expect(await runInit({ project: dir, print: true }, t.deps)).toBe(0);
    expect(t.out.join('')).toBe(proposal().yaml);
    expect(fs.readdirSync(dir)).toEqual([]);
    const j = io();
    expect(await runInit({ project: dir, print: true, format: 'json' }, j.deps)).toBe(0);
    expect((JSON.parse(j.out.join('')) as SpecProposal).label).toBe('inferred spec, not author-declared');
    expect(await runInit({ project: dir, format: 'xml' }, io().deps)).toBe(2);
  });

  it('exits 1 when the proposal fails the checks (still written, for review) and 2 when it cannot infer', async () => {
    const bad = io(proposal({ check: { valid: false, compiles: true, errors: ['E'], warnings: [] } }));
    expect(await runInit({ project: dir }, bad.deps)).toBe(1);
    expect(bad.err.join('')).toMatch(/WARNING: the proposal does not pass the repository checks: E/);
    expect(fs.existsSync(path.join(dir, DEFAULT_SPEC_NAME))).toBe(true);
    const t = io();
    t.propose.mockRejectedValue(new Error('ISE snapshot: x has no src/'));
    expect(await runInit({ project: path.join(dir, 'other') }, t.deps)).toBe(2);
    expect(t.err.join('')).toMatch(/cannot infer a spec .* has no src\//);
  });
});

describe('evaluate --from-inferred helpers', () => {
  it('writes the proposal to a temporary file outside the project and removes it', async () => {
    const f = await inferredSpecFile('/nowhere', () => Promise.resolve(proposal()));
    expect(f.specPath.startsWith(os.tmpdir())).toBe(true);
    expect(fs.readFileSync(f.specPath, 'utf8')).toBe(proposal().yaml);
    f.dispose();
    expect(fs.existsSync(f.specPath)).toBe(false);
  });

  it('labels the JSON report and the banner as an inferred spec', () => {
    const json = JSON.parse(labelJsonReport('{"verdict":"pass"}', proposal())) as Record<string, unknown>;
    expect(Object.keys(json)[0]).toBe('specSource');
    expect(json.specSource).toEqual(expect.objectContaining({ kind: 'inferred', label: 'inferred spec, not author-declared', style: 'layered', questions: 1 }));
    expect(json.verdict).toBe('pass');
    expect(inferredBanner(proposal())).toMatch(/^\*\*\* INFERRED SPEC, NOT AUTHOR-DECLARED \*\*\*/);
  });
});
