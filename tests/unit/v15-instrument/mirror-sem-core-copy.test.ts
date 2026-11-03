/**
 * R-MIRROR-SEM v1.5.9 (exploratory): core-side renamed copies. The vendor value reaches the core as text (a port result
 * field an adapter copies it into, or a port method that returns it) and the core turns it into a core value set
 * through a cast, a lookup table / Map, or a switch / if chain. Only the candidate selection widens; the question is the
 * same. Zero model calls: every judge here is a stub.
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
const SEMGATE = path.join(REPO, 'experiments', 'sem-gate', 'cases');

const PORT = `import { ParcelReading } from '../../../domain/reading';
export interface TrackingPort {
  latest(trackingNumber: string): Promise<ParcelReading>;
  statusOf(trackingNumber: string): Promise<string>;
}
`;
const READING = `/** The newest carrier reading, as text. */
export interface ParcelReading { readonly trackingNumber: string; readonly statusCode: string; readonly note: string }
`;
const adapter = (statusCode: string): string => `import { ShipTrackClient } from 'shiptrack-sdk';
import { TrackingPort } from '../../../application/ports/out/tracking.port';
import { ParcelReading } from '../../../domain/reading';

export class ShipTrackTrackingAdapter implements TrackingPort {
  private readonly client = new ShipTrackClient({ api_key: 'k' });
  async latest(trackingNumber: string): Promise<ParcelReading> {
    const ev = await this.client.latest(trackingNumber);
    return { trackingNumber: ev.tracking_number, statusCode: ${statusCode}, note: ev.exception_code ?? '' };
  }
  async statusOf(trackingNumber: string): Promise<string> {
    const ev = await this.client.latest(trackingNumber);
    return ev.status;
  }
}
`;
const LOWER_STAGE = `export type Stage = 'label_created' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'exception' | 'returned';\n`;
const ENUM_STAGE = `export enum ParcelStage { Created = 'Created', Moving = 'Moving', OutForDelivery = 'OutForDelivery', Done = 'Done', Problem = 'Problem', Back = 'Back' }\n`;
const useCase = (body: string, imports = ''): string => `import { TrackingPort } from './ports/out/tracking.port';
${imports}
export class UpdateCustomerUseCase {
  constructor(private readonly tracking: TrackingPort) {}
${body}
}
`;
const BRANCH_ENUM = `    if (st === ParcelStage.Done) return 'arrived';
    if (st === ParcelStage.Back) return 'refund';
    return 'other';`;

interface Fixture { stage: string; useCase: string; statusCode?: string; extra?: Record<string, string> }
const FIXTURES: Record<string, Fixture> = {
  cast: {
    stage: LOWER_STAGE,
    useCase: useCase(`  async run(n: string): Promise<string> {
    const s = (await this.tracking.latest(n)).statusCode as Stage;
    if (s === 'delivered') return 'arrived';
    if (s === 'returned') return 'refund';
    return 'other';
  }`, `import { Stage } from '../domain/stage';`),
  },
  table: {
    stage: `${ENUM_STAGE}export const STAGE_OF: Readonly<Record<string, ParcelStage>> = {
  label_created: ParcelStage.Created, in_transit: ParcelStage.Moving, out_for_delivery: ParcelStage.OutForDelivery,
  delivered: ParcelStage.Done, exception: ParcelStage.Problem, returned: ParcelStage.Back,
};
`,
    useCase: useCase(`  async run(n: string): Promise<string> {
    const st = STAGE_OF[(await this.tracking.latest(n)).statusCode];
${BRANCH_ENUM}
  }`, `import { ParcelStage, STAGE_OF } from '../domain/stage';`),
  },
  'switch-param': {
    stage: `${ENUM_STAGE}export function stageOf(code: string): ParcelStage {
  switch (code) {
    case 'label_created': return ParcelStage.Created;
    case 'in_transit': return ParcelStage.Moving;
    case 'out_for_delivery': return ParcelStage.OutForDelivery;
    case 'delivered': return ParcelStage.Done;
    case 'exception': return ParcelStage.Problem;
    default: return ParcelStage.Back;
  }
}
`,
    useCase: useCase(`  async run(n: string): Promise<string> {
    const st = stageOf((await this.tracking.latest(n)).statusCode);
${BRANCH_ENUM}
  }`, `import { ParcelStage, stageOf } from '../domain/stage';`),
  },
  'map-local': {
    stage: ENUM_STAGE,
    useCase: useCase(`  async run(n: string): Promise<string> {
    const code = (await this.tracking.latest(n)).statusCode;
    const st = STAGES.get(code);
${BRANCH_ENUM}
  }`, `import { ParcelStage } from '../domain/stage';
const STAGES = new Map<string, ParcelStage>([
  ['label_created', ParcelStage.Created], ['in_transit', ParcelStage.Moving], ['out_for_delivery', ParcelStage.OutForDelivery],
  ['delivered', ParcelStage.Done], ['exception', ParcelStage.Problem], ['returned', ParcelStage.Back],
]);`),
  },
  'method-cast': {
    stage: `export type Stage = 'LABEL_CREATED' | 'IN_TRANSIT' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'EXCEPTION' | 'RETURNED';\n`,
    useCase: useCase(`  async run(n: string): Promise<string> {
    const s = (await this.tracking.statusOf(n)) as Stage;
    return s === 'DELIVERED' ? 'arrived' : s === 'RETURNED' ? 'refund' : 'other';
  }`, `import { Stage } from '../domain/stage';`),
  },
  // a second adapter fills a field of the same name from another vendor set, and the async return's owner is a union
  // (T | PromiseLike<T>): each field keeps its own set, and the table picks the set its keys name
  'two-adapters': {
    stage: `${ENUM_STAGE}export const STAGE_OF: Readonly<Record<string, ParcelStage>> = {
  LABEL_CREATED: ParcelStage.Created, IN_TRANSIT: ParcelStage.Moving, OUT_FOR_DELIVERY: ParcelStage.OutForDelivery,
  DELIVERED: ParcelStage.Done, EXCEPTION: ParcelStage.Problem, RETURNED: ParcelStage.Back,
};
`,
    statusCode: 'ev.status',
    useCase: useCase(`  async run(n: string): Promise<string> {
    const st = STAGE_OF[(await this.tracking.latest(n)).statusCode];
${BRANCH_ENUM}
  }`, `import { ParcelStage, STAGE_OF } from '../domain/stage';`),
    extra: {
      'src/types/boxco-sdk.d.ts': `declare module 'boxco-sdk' {
  export type BoxState = 'EMPTY' | 'PACKED' | 'SEALED';
  export interface Box { id: string; state: BoxState }
  export class BoxClient { constructor(o: { key: string }); get(id: string): Promise<Box>; }
}
`,
      'src/domain/box.ts': 'export interface BoxReading { readonly id: string; readonly statusCode: string }\n',
      'src/application/ports/out/boxes.port.ts': "import { BoxReading } from '../../../domain/box';\nexport interface BoxesPort { read(id: string): Promise<BoxReading> }\n",
      'src/adapters/out/boxes/boxco.adapter.ts': `import { BoxClient } from 'boxco-sdk';
import { BoxesPort } from '../../../application/ports/out/boxes.port';
import { BoxReading } from '../../../domain/box';
export class BoxcoAdapter implements BoxesPort {
  private readonly client = new BoxClient({ key: 'k' });
  async read(id: string): Promise<BoxReading> {
    const b = await this.client.get(id);
    return { id: b.id, statusCode: b.state };
  }
}
`,
    },
  },
  // negatives of the provenance test: the text does not trace to a vendor value
  'cast-domain-text': {
    stage: LOWER_STAGE,
    useCase: useCase(`  async run(n: string, typed: string): Promise<string> {
    await this.tracking.latest(n);
    const s = typed as Stage;
    if (s === 'delivered') return 'arrived';
    if (s === 'returned') return 'refund';
    return 'other';
  }`, `import { Stage } from '../domain/stage';`),
  },
  'cast-note-field': {
    stage: LOWER_STAGE,
    useCase: useCase(`  async run(n: string): Promise<string> {
    const s = (await this.tracking.latest(n)).note as Stage;
    if (s === 'delivered') return 'arrived';
    if (s === 'returned') return 'refund';
    return 'other';
  }`, `import { Stage } from '../domain/stage';`),
  },
  'adapter-mapped-field': {
    statusCode: `ev.status === 'DELIVERED' ? 'delivered' : 'in_transit'`,
    stage: LOWER_STAGE,
    useCase: useCase(`  async run(n: string): Promise<string> {
    const s = (await this.tracking.latest(n)).statusCode as Stage;
    if (s === 'delivered') return 'arrived';
    if (s === 'returned') return 'refund';
    return 'other';
  }`, `import { Stage } from '../domain/stage';`),
  },
};

function write(root: string, name: string, f: Fixture): string {
  const t = path.join(root, name);
  const files: Record<string, string> = {
    'src/types/shiptrack-sdk.d.ts': SDK,
    'src/application/ports/out/tracking.port.ts': PORT,
    'src/domain/reading.ts': READING,
    'src/domain/stage.ts': f.stage,
    'src/adapters/out/tracking/shiptrack-tracking.adapter.ts': adapter(f.statusCode ?? 'ev.status.toLowerCase()'),
    'src/application/update-customer.use-case.ts': f.useCase,
    'src/main.ts': '// Composition root.\nexport {};\n',
    ...(f.extra ?? {}),
  };
  for (const [rel, text] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(t, rel)), { recursive: true }); fs.writeFileSync(path.join(t, rel), text); }
  return t;
}

describe('R-MIRROR-SEM v1.5.9: core-side copies (symbolic)', () => {
  let scratch: string; let root: string;
  beforeAll(() => { scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'mirror-core-')); root = path.join(scratch, 'trees'); for (const [n, f] of Object.entries(FIXTURES)) write(root, n, f); });
  afterAll(() => fs.rmSync(scratch, { recursive: true, force: true }));
  const cands = async (tree: string, spec = SPEC, baseline?: string): Promise<MirrorCandidateFact[]> =>
    (await buildGraph(tree, { spec, withApg: false, scratch, ...(baseline !== undefined ? { baseline } : {}) })).facts.mirrorCandidates;
  const one = async (name: string, set: string): Promise<MirrorCandidateFact | undefined> => (await cands(path.join(root, name))).find((c) => c.coreSet === set);

  it('a cast of port-carried vendor text to a core set spelled like the vendor values', async () => {
    const c = await one('cast', 'Stage');
    expect(c).toMatchObject({ mapSide: 'core', vendorSet: 'TrackingStatus', module: 'shiptrack-sdk', mappedFrom: 6, mappedTo: 6, oneToOne: true, ownedBy: '' });
    expect(c!.pairs.every((p) => p.form === 'cast' && p.file === 'src/application/update-customer.use-case.ts')).toBe(true);
    expect(c!.pairs.map((p) => `${p.from}->${p.to}`)).toContain('LABEL_CREATED->label_created');
    expect(structureHolds(c!)).toBe(true);
  });
  it('a core lookup table keyed by the text, into renamed enum members', async () => {
    const c = await one('table', 'ParcelStage');
    expect(c).toMatchObject({ mapSide: 'core', coreKind: 'enum', mappedFrom: 6, mappedTo: 6, oneToOne: true });
    expect(c!.pairs.map((p) => `${p.from}->${p.to}`)).toContain('IN_TRANSIT->Moving');
    expect(structureHolds(c!)).toBe(true);
  });
  it('a switch on a parameter whose call site passes the text (the default branch is not a pair)', async () => {
    const c = await one('switch-param', 'ParcelStage');
    expect(c).toMatchObject({ mapSide: 'core', mappedFrom: 5, mappedTo: 5, oneToOne: false });
    expect(structureHolds(c!)).toBe(true);
  });
  it('a Map lookup through a local variable', async () => {
    const c = await one('map-local', 'ParcelStage');
    expect(c).toMatchObject({ mapSide: 'core', mappedFrom: 6, oneToOne: true });
    expect(c!.pairs.every((p) => p.form === 'map')).toBe(true);
  });
  it('a cast of a port method result that returns the vendor value', async () => {
    const c = await one('method-cast', 'Stage');
    expect(c).toMatchObject({ mapSide: 'core', mappedFrom: 6, oneToOne: true });
    expect(structureHolds(c!)).toBe(true);
  });
  it('two adapters fill a field of one name from two vendor sets: the table key picks its set; the site is the table file', async () => {
    const c = await one('two-adapters', 'ParcelStage');
    expect(c).toMatchObject({ mapSide: 'core', vendorSet: 'TrackingStatus', mappedFrom: 6, oneToOne: true });
    expect(c!.pairs.every((p) => p.file === 'src/domain/stage.ts')).toBe(true);
  });
  it.each(['cast-domain-text', 'cast-note-field', 'adapter-mapped-field'])('no candidate when the text does not trace to a vendor value (%s)', async (name) => {
    expect(await cands(path.join(root, name))).toHaveLength(0);
  });
  it('the core-side prompt names where the mapping is; the question is unchanged', async () => {
    const c = await one('table', 'ParcelStage');
    const p = mirrorPrompt(c!);
    expect(p).toContain('## Mapping table (vendor value -> core member, in the core: the vendor value reaches the core as text)');
    expect(p).toContain(`Does the core set ParcelStage mirror the vendor's distinctions (a renamed copy of TrackingStatus of shiptrack-sdk) or express distinctions the domain owns?`);
  });
  it('the rule fires on a core-side candidate when the fact is yes, not when it is no', async () => {
    const rules = loadRules().filter((r) => r.id === 'R-MIRROR-SEM');
    const stub = (mirror: 'yes' | 'no'): MirrorJudge => {
      const stats = { asked: 0, session: 0, disk: 0, calls: 0, misses: 0, errors: 0, callMs: 0 };
      return { stats, judge: async (c) => { stats.asked++; return { verdict: { mirror, reason: 'stub reason' }, key: mirrorKeyOf(c), from: 'call', ms: 0 }; } };
    };
    const tree = path.join(root, 'table');
    const yes = await runTree(tree, rules, { spec: SPEC, withApg: false, scratch, mirrorJudge: stub('yes') });
    expect(yes.findings.filter((f) => f.rule === 'R-MIRROR-SEM').map((f) => `${f.file}|${f.subject}`)).toEqual(['src/domain/stage.ts|ParcelStage', 'src/domain/stage.ts|STAGE_OF']); // v1.5.10: the table's key set is a form-C candidate too
    const no = await runTree(tree, rules, { spec: SPEC, withApg: false, scratch, mirrorJudge: stub('no') });
    expect(no.findings.filter((f) => f.rule === 'R-MIRROR-SEM')).toHaveLength(0);
  });

  describe('the SEM-GATE trees (seen material)', () => {
    const gate = (id: string): { tree: string; spec: string; seed: string } => {
      const task = id.startsWith('hxpb1') ? 'hxpb1-pottery-kiln' : 'hxpb2-translation-portal';
      const dir = path.join(REPO, 'experiments', 'hx-study-set', 'part-b', task);
      return { tree: path.join(SEMGATE, id, 'tree'), spec: path.join(dir, 'spec.yaml'), seed: path.join(dir, 'seed') };
    };
    it.each([
      ['hxpb1-a1', 'KilnPhase'], ['hxpb1-a2', 'KilnStage'], ['hxpb2-a1', 'MarketState'], ['hxpb2-a2', 'JobStep'],
    ])('form A %s: %s is now an asked core-side candidate', async (id, set) => {
      const g = gate(id);
      const c = (await cands(g.tree, g.spec, g.seed)).find((x) => x.coreSet === set);
      expect(c?.mapSide).toBe('core');
      expect(structureHolds(c!)).toBe(true);
    });
    it.each(['hxpb1-b1', 'hxpb1-n2', 'hxpb2-b2', 'hxpb2-n1'])('form B and negative %s: candidates stay adapter-side (no mapSide)', async (id) => {
      const g = gate(id);
      const cs = await cands(g.tree, g.spec, g.seed);
      expect(cs.length).toBeGreaterThan(0);
      expect(cs.every((c) => c.mapSide === undefined)).toBe(true);
      expect(cs.filter(structureHolds).every((c) => mirrorPrompt(c).includes('in the outbound adapter)'))).toBe(true);
    });
  });
});
