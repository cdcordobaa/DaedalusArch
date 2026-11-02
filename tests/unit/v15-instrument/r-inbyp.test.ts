/**
 * R-INBYP (2026-11-02, instrument v1.5.7, exploratory): a driving adapter that imports a driven (out-) port, the shape
 * the Hexagonal study's hand read found hidden from R-AXA (t11). Cases are the HX-RULES-V3 parcel-lockers base
 * (`experiments/hx-rules-v3-dev/`, development data only) with one file added or replaced; the base is the baseline.
 * Zero model calls, no Neo4j.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { loadRules, runTree } from '../../../src/v15-instrument/index.js';
import type { Finding } from '../../../src/v15-instrument/index.js';
import { cypherMessage } from '../../../src/v15-instrument/rule-messages.js';

const REPO = path.resolve(__dirname, '..', '..', '..');
const BASE = path.join(REPO, 'experiments', 'hx-rules-v3-dev', 'parcel-lockers', 'base');

const HANDLER_OUT_PORT = `import type { ParcelRepositoryPort } from '../../../application/ports/out/parcel-repository.port';

export class DoorEventsHandler {
  constructor(private readonly parcels: ParcelRepositoryPort) {}

  async onDoorClosed(parcelId: string): Promise<void> {
    const p = await this.parcels.findById(parcelId);
    if (p !== null) await this.parcels.save(p);
  }
}
`;
const HANDLER_IN_PORT = `import { CollectParcelPort } from '../../../application/ports/in/collect-parcel.port';

export class DoorEventsHandler {
  constructor(private readonly collectParcel: CollectParcelPort) {}

  async onDoorClosed(parcelId: string): Promise<void> {
    await this.collectParcel.collect({ parcelId, pickupCode: '' });
  }
}
`;
// A port outside any in/out folder, implemented by a driven adapter: driven by implementation, not by its path.
const AUDIT_PORT = `export interface AuditTrail {
  record(line: string): Promise<void>;
}
`;
const AUDIT_ADAPTER = `import { AuditTrail } from '../../../application/ports/audit-trail';

export class MemoryAuditTrail implements AuditTrail {
  readonly lines: string[] = [];
  async record(line: string): Promise<void> { this.lines.push(line); }
}
`;
const HANDLER_AUDIT = `import { AuditTrail } from '../../../application/ports/audit-trail';

export class DoorEventsHandler {
  constructor(private readonly audit: AuditTrail) {}
  async onDoorClosed(parcelId: string): Promise<void> { await this.audit.record(parcelId); }
}
`;

describe('R-INBYP: a driving adapter uses a driven port', () => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'v15-inbyp-'));
  afterAll(() => fs.rmSync(scratch, { recursive: true, force: true }));
  const all = loadRules();
  const rule = all.find((r) => r.id === 'R-INBYP');
  const hits = async (name: string, add: Record<string, string>): Promise<Finding[]> => {
    const tree = path.join(scratch, name);
    fs.cpSync(BASE, tree, { recursive: true });
    for (const [f, text] of Object.entries(add)) { fs.mkdirSync(path.dirname(path.join(tree, f)), { recursive: true }); fs.writeFileSync(path.join(tree, f), text); }
    const r = await runTree(tree, all.filter((x) => x.id === 'R-INBYP'), { spec: path.join(tree, 'spec.yaml'), scratch: path.join(scratch, '_s'), withApg: false, baseline: BASE });
    return r.findings.filter((f) => f.status === 'violation' && f.rule === 'R-INBYP');
  };

  it('the rule is exploratory: on no Hexagonal row, so neither counted nor delivered', async () => {
    const { HEX_ROW_RULES, scoredRules } = await import('../../../src/v15-instrument/rule-set.js');
    expect(rule).toBeDefined();
    expect(rule!.text).toMatch(/^\/\/ status \(v1\.5\.7, 2026-11-02\): exploratory, not admitted, on no row and not delivered/m);
    expect(Object.values(HEX_ROW_RULES).flat()).not.toContain('R-INBYP');
    expect(scoredRules('hexagonal')).not.toContain('R-INBYP');
  });

  it('clean: the base, and a driving adapter that calls an in-port', async () => {
    expect(await hits('base', {})).toEqual([]);
    expect(await hits('in-port', { 'src/adapters/in/mqtt/door-events.handler.ts': HANDLER_IN_PORT })).toEqual([]);
  }, 120_000);

  it('positive: a driving adapter holds an out-port (type import), judged driven by its folder', async () => {
    const h = await hits('out-port', { 'src/adapters/in/mqtt/door-events.handler.ts': HANDLER_OUT_PORT });
    expect(h.map((f) => [f.file, f.line, f.subject])).toEqual([
      ['src/adapters/in/mqtt/door-events.handler.ts', 1, 'src/adapters/in/mqtt -> src/application/ports/out/parcel-repository.port.ts'],
    ]);
    expect(h[0]!.evidence).toBe('src/adapters/in/mqtt (a driving adapter) imports the driven port src/application/ports/out/parcel-repository.port.ts (path)');
    const m = cypherMessage(h[0]!, rule);
    expect(m.why).toMatch(/in the driving adapter package src\/adapters\/in\/mqtt, imports the driven port src\/application\/ports\/out\/parcel-repository\.port\.ts/);
    expect(m.fix).toMatch(/call that in-port from src\/adapters\/in\/mqtt\/door-events\.handler\.ts/);
  }, 120_000);

  it('positive: a port outside an out/ folder is driven when a driven adapter implements it', async () => {
    const h = await hits('implemented', {
      'src/application/ports/audit-trail.ts': AUDIT_PORT,
      'src/adapters/out/audit/memory-audit-trail.ts': AUDIT_ADAPTER,
      'src/adapters/in/mqtt/door-events.handler.ts': HANDLER_AUDIT,
    });
    expect(h.map((f) => f.evidence)).toEqual(['src/adapters/in/mqtt (a driving adapter) imports the driven port src/application/ports/audit-trail.ts (implemented)']);
  }, 120_000);

  it('R-AXA tells a driving adapter only the in-port route; a driven adapter keeps the port route', () => {
    const axa = (pkg: string, target: string): string => cypherMessage({ rule: 'R-AXA', family: 'H3', file: `${pkg}/X.ts`, line: 1, subject: `${pkg} -> ${target}`, evidence: `${pkg} imports ${target} (src/adapters/out/memory), another adapter`, path: [], status: 'violation' }, all.find((r) => r.id === 'R-AXA')).fix;
    const driving = axa('src/adapters/in/mqtt', 'src/adapters/out/memory/MemoryLockers.ts');
    expect(driving).toMatch(/src\/adapters\/in\/mqtt is a driving adapter: .* call a use case through an in-port .*do not depend on src\/adapters\/out\/memory\/MemoryLockers\.ts's port either/);
    expect(driving).not.toMatch(/depend on the port that/);
    expect(axa('src/adapters/out/lockbank', 'src/adapters/out/memory/MemoryLockers.ts')).toMatch(/depend on the port that src\/adapters\/out\/memory\/MemoryLockers\.ts implements \(outbound\)/);
  });

  it('clean: the same port with no driven adapter importing it is not judged driven', async () => {
    expect(await hits('not-implemented', { 'src/application/ports/audit-trail.ts': AUDIT_PORT, 'src/adapters/in/mqtt/door-events.handler.ts': HANDLER_AUDIT })).toEqual([]);
  }, 120_000);
});
