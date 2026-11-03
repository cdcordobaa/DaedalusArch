/**
 * R-MIRROR-SEM v1.5.10 (exploratory): form C, a core lookup keyed by the vendor's own values. The vendor value reaches
 * the core as text (a port result field an adapter copies it into) and the core consults an untyped table, a Map, a
 * switch or an equality chain whose keys are the vendor's values; no core value set receives what the lookup returns
 * (the SEM-2 pilot shape, `STAGES[s.stateCode]`). The candidate's core set is the lookup's key set. Zero model calls:
 * every judge here is a stub.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { buildGraph, loadRules, runTree } from '../../../src/v15-instrument/graph.js';
import { mirrorKeyOf, mirrorPrompt, structureHolds, type MirrorCandidateFact, type MirrorJudge } from '../../../src/v15-instrument/mirror-sem.js';

const REPO = path.resolve(__dirname, '..', '..', '..');
const DEV = path.join(REPO, 'experiments', 'sem-mirror-dev', 'cases', 'parcel-mirror');
const SPEC = path.join(DEV, 'spec.yaml');
const SDK = fs.readFileSync(path.join(DEV, 'tree', 'src', 'types', 'shiptrack-sdk.d.ts'), 'utf8');

const PORT = `import { ParcelReading } from '../../../domain/reading';
export interface TrackingPort { latest(trackingNumber: string): Promise<ParcelReading> }
`;
const READING = `/** The newest carrier reading; statusCode is the carrier's own word, printed as is. */
export interface ParcelReading { readonly trackingNumber: string; readonly statusCode: string; readonly note: string }
`;
const ADAPTER = `import { ShipTrackClient } from 'shiptrack-sdk';
import { TrackingPort } from '../../../application/ports/out/tracking.port';
import { ParcelReading } from '../../../domain/reading';

export class ShipTrackTrackingAdapter implements TrackingPort {
  private readonly client = new ShipTrackClient({ api_key: 'k' });
  async latest(trackingNumber: string): Promise<ParcelReading> {
    const ev = await this.client.latest(trackingNumber);
    return { trackingNumber: ev.tracking_number, statusCode: ev.status.toLowerCase(), note: ev.exception_code ?? '' };
  }
}
`;
const useCase = (body: string, head = ''): string => `import { TrackingPort } from './ports/out/tracking.port';
${head}
export class CustomerViewUseCase {
  constructor(private readonly tracking: TrackingPort) {}
${body}
}
`;
const SIX = `  label_created: 'Booked', in_transit: 'On its way', out_for_delivery: 'Arriving today',
  delivered: 'Arrived', exception: 'Delayed', returned: 'Sent back',`;

const FIXTURES: Record<string, Record<string, string>> = {
  // positives
  record: {
    'src/application/customer-view.use-case.ts': useCase(`  async label(n: string): Promise<string> {
    const r = await this.tracking.latest(n);
    const label = LABELS[r.statusCode];
    if (label === undefined) throw new Error('unknown status ' + r.statusCode);
    return label;
  }`, `const LABELS: Readonly<Record<string, string | undefined>> = {\n${SIX}\n};`),
  },
  'as-const': {
    'src/domain/labels.ts': `export const PARCEL_LABELS = {\n${SIX}\n} as const;\n`,
    'src/application/customer-view.use-case.ts': useCase(`  async label(n: string): Promise<string> {
    const code = (await this.tracking.latest(n)).statusCode;
    return (PARCEL_LABELS as Record<string, string>)[code] ?? 'Unknown';
  }`, `import { PARCEL_LABELS } from '../domain/labels';`),
  },
  map: {
    'src/application/customer-view.use-case.ts': useCase(`  async label(n: string): Promise<string> {
    const code = (await this.tracking.latest(n)).statusCode;
    return LABELS.get(code) ?? 'Unknown';
  }`, `const LABELS = new Map<string, string>([
  ['label_created', 'Booked'], ['in_transit', 'On its way'], ['out_for_delivery', 'Arriving today'],
  ['delivered', 'Arrived'], ['exception', 'Delayed'], ['returned', 'Sent back'],
]);`),
  },
  switch: {
    'src/application/customer-view.use-case.ts': useCase(`  async label(n: string): Promise<string> {
    const r = await this.tracking.latest(n);
    switch (r.statusCode) {
      case 'label_created': return 'Booked';
      case 'in_transit':
      case 'out_for_delivery': return 'On its way';
      case 'delivered': return 'Arrived';
      default: return 'Ask us';
    }
  }`),
  },
  compare: {
    'src/application/customer-view.use-case.ts': useCase(`  async label(n: string): Promise<string> {
    const code = (await this.tracking.latest(n)).statusCode;
    if (code === 'delivered') return 'Arrived';
    if (code === 'returned') return 'Sent back';
    if (code === 'exception') return 'Delayed';
    return 'On its way';
  }`),
  },
  // negatives
  'own-words': {
    'src/application/customer-view.use-case.ts': useCase(`  async label(n: string): Promise<string> {
    const r = await this.tracking.latest(n);
    return LABELS[r.statusCode] ?? 'Unknown';
  }`, `const LABELS: Readonly<Record<string, string | undefined>> = { waiting: 'Booked', moving: 'On its way', arrived: 'Arrived', problem: 'Delayed' };`),
  },
  'under-half': {
    'src/application/customer-view.use-case.ts': useCase(`  async label(n: string): Promise<string> {
    const r = await this.tracking.latest(n);
    return LABELS[r.statusCode] ?? 'Unknown';
  }`, `const LABELS: Readonly<Record<string, string | undefined>> = { delivered: 'Arrived', returned: 'Sent back', lost: 'Lost', damaged: 'Damaged' };`),
  },
  'not-port-text': {
    'src/application/customer-view.use-case.ts': useCase(`  async label(n: string, asked: string): Promise<string> {
    await this.tracking.latest(n);
    return LABELS[asked] ?? 'Unknown';
  }`, `const LABELS: Readonly<Record<string, string | undefined>> = {\n${SIX}\n};`),
  },
  'two-keys': {
    'src/application/customer-view.use-case.ts': useCase(`  async label(n: string): Promise<string> {
    const code = (await this.tracking.latest(n)).statusCode;
    if (code === 'delivered') return 'Arrived';
    if (code === 'returned') return 'Sent back';
    return 'On its way';
  }`),
  },
};

function write(root: string, name: string, files: Record<string, string>): string {
  const t = path.join(root, name);
  const all: Record<string, string> = {
    'src/types/shiptrack-sdk.d.ts': SDK,
    'src/application/ports/out/tracking.port.ts': PORT,
    'src/domain/reading.ts': READING,
    'src/adapters/out/tracking/shiptrack-tracking.adapter.ts': ADAPTER,
    'src/main.ts': '// Composition root.\nexport {};\n',
    ...files,
  };
  for (const [rel, text] of Object.entries(all)) { fs.mkdirSync(path.dirname(path.join(t, rel)), { recursive: true }); fs.writeFileSync(path.join(t, rel), text); }
  return t;
}

describe('R-MIRROR-SEM v1.5.10: form C, core lookups keyed by vendor values (symbolic)', () => {
  let scratch: string; let root: string;
  beforeAll(() => { scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'mirror-keys-')); root = path.join(scratch, 'trees'); for (const [n, f] of Object.entries(FIXTURES)) write(root, n, f); });
  afterAll(() => fs.rmSync(scratch, { recursive: true, force: true }));
  const cands = async (tree: string, baseline?: string): Promise<MirrorCandidateFact[]> =>
    (await buildGraph(tree, { spec: SPEC, withApg: false, scratch, ...(baseline !== undefined ? { baseline } : {}) })).facts.mirrorCandidates;
  const keysOf = async (name: string): Promise<MirrorCandidateFact[]> => (await cands(path.join(root, name))).filter((c) => c.coreKind === 'keys');

  it('an untyped Record keyed by the six vendor states, indexed with the port-carried text (the SEM-2 pilot shape)', async () => {
    const [c, ...rest] = await keysOf('record');
    expect(rest).toHaveLength(0);
    expect(c).toMatchObject({ coreSet: 'LABELS', coreKind: 'keys', mapSide: 'core', vendorSet: 'TrackingStatus', module: 'shiptrack-sdk', mappedFrom: 6, mappedTo: 6, oneToOne: true, ownedBy: '' });
    expect(c!.coreMembers).toEqual(['label_created', 'in_transit', 'out_for_delivery', 'delivered', 'exception', 'returned']);
    expect(c!.pairs.map((p) => `${p.from}->${p.to}`)).toContain('IN_TRANSIT->in_transit');
    expect(c!.branches.map((b) => b.form)).toEqual(['index']);
    expect(structureHolds(c!)).toBe(true);
  });
  it('an `as const` object in a domain file, imported and indexed in the use case', async () => {
    const [c] = await keysOf('as-const');
    expect(c).toMatchObject({ coreSet: 'PARCEL_LABELS', file: 'src/domain/labels.ts', mappedFrom: 6, oneToOne: true });
    expect(c!.branches[0]!.file).toBe('src/application/customer-view.use-case.ts');
    expect(structureHolds(c!)).toBe(true);
  });
  it('a Map keyed by the vendor states, read with get', async () => {
    const [c] = await keysOf('map');
    expect(c).toMatchObject({ coreSet: 'LABELS', mappedFrom: 6, oneToOne: true });
    expect(c!.pairs.every((p) => p.form === 'map')).toBe(true);
    expect(c!.branches.map((b) => b.form)).toEqual(['get']);
  });
  it('a switch on the text with 4 vendor cases (4 of 6, at least half)', async () => {
    const [c] = await keysOf('switch');
    expect(c).toMatchObject({ coreSet: 'label:switch(r.statusCode)', mappedFrom: 4, mappedTo: 4, oneToOne: true });
    expect(structureHolds(c!)).toBe(true);
  });
  it('an equality chain on the text with 3 vendor values', async () => {
    const [c] = await keysOf('compare');
    expect(c).toMatchObject({ coreSet: 'label:compare(code)', mappedFrom: 3, oneToOne: true });
    expect(c!.branches).toHaveLength(3);
    expect(structureHolds(c!)).toBe(true);
  });
  it.each([
    ['own-words', 'a table keyed by our own domain words'],
    ['under-half', 'a table with fewer than half of the vendor values (2 of 6)'],
    ['not-port-text', 'a table keyed by the vendor states but indexed with text no port carries'],
    ['two-keys', 'an equality chain with only 2 values'],
  ])('no candidate: %s (%s)', async (name) => {
    expect(await cands(path.join(root, name))).toHaveLength(0);
  });
  it('a lookup the baseline core already has (same name and keys) is ownedBy baseline', async () => {
    const [c] = await (await cands(path.join(root, 'record'), path.join(root, 'record'))).filter((x) => x.coreKind === 'keys');
    expect(c?.ownedBy).toBe('baseline');
    expect(structureHolds(c!)).toBe(false);
  });
  it('the form-C prompt says the core set is the lookup keys; the question is the shared one', async () => {
    const [c] = await keysOf('record');
    const p = mirrorPrompt(c!);
    expect(p).toContain('## Mapping table (vendor value -> core key, in the core: the vendor value reaches the core as text and the core looks it up by these keys)');
    expect(p).toContain(`Does the core set LABELS mirror the vendor's distinctions (a renamed copy of TrackingStatus of shiptrack-sdk) or express distinctions the domain owns?`);
    expect(p).toContain('## Core value set: LABELS (keys, application file src/application/customer-view.use-case.ts)');
    expect(p).not.toContain('Core members no vendor value maps to');
  });
  it('the rule fires on a form-C candidate when the fact is yes, not when it is no', async () => {
    const rules = loadRules().filter((r) => r.id === 'R-MIRROR-SEM');
    const stub = (mirror: 'yes' | 'no'): MirrorJudge => {
      const stats = { asked: 0, session: 0, disk: 0, calls: 0, misses: 0, errors: 0, callMs: 0 };
      return { stats, judge: async (c) => { stats.asked++; return { verdict: { mirror, reason: 'stub reason' }, key: mirrorKeyOf(c), from: 'call', ms: 0 }; } };
    };
    const tree = path.join(root, 'record');
    const yes = await runTree(tree, rules, { spec: SPEC, withApg: false, scratch, mirrorJudge: stub('yes') });
    expect(yes.findings.filter((f) => f.rule === 'R-MIRROR-SEM').map((f) => `${f.file}|${f.subject}`)).toEqual(['src/application/customer-view.use-case.ts|LABELS']);
    const no = await runTree(tree, rules, { spec: SPEC, withApg: false, scratch, mirrorJudge: stub('no') });
    expect(no.findings.filter((f) => f.rule === 'R-MIRROR-SEM')).toHaveLength(0);
  });
});
