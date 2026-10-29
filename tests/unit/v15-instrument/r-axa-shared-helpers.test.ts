/**
 * R-AXA v2 (2026-10-29, instrument v1.5.1): shared helpers of the driving side are not another adapter, and the
 * violation identity names the import target. Regression fixtures: the known false positive on the school-canteen
 * trap family (a new route importing `../shared/reply`, as the seed routes do) and the known true positive on the
 * laundry-lockers reference solution (an inbound MQTT handler importing an outbound in-memory store). Zero model
 * calls, no Neo4j.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { loadRules, runTree } from '../../../src/v15-instrument/index.js';
import type { Finding } from '../../../src/v15-instrument/index.js';

const REPO = path.resolve(__dirname, '..', '..', '..');
const FAM = path.join(REPO, 'experiments', 'trap-families');
const F19 = path.join(FAM, 'f19-hex-school-canteen');
const F24 = path.join(FAM, 'f24-hex-laundry-lockers');
const FX = path.join(REPO, 'tests', 'fixtures', 'v15-axa');
const identity = (f: Finding): string => `${f.rule}|${f.file}|${f.subject}`;

describe('R-AXA v2: driving-side shared helpers and target-aware identity', () => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'v15-axa-'));
  afterAll(() => fs.rmSync(scratch, { recursive: true, force: true }));
  const rules = loadRules().filter((r) => r.id === 'R-AXA');
  const axa = async (name: string, base: string, overlay: string | null, spec: string): Promise<Finding[]> => {
    const tree = path.join(scratch, name);
    fs.cpSync(base, tree, { recursive: true });
    if (overlay !== null) fs.cpSync(overlay, tree, { recursive: true });
    const r = await runTree(tree, rules, { spec, scratch: path.join(scratch, '_s'), withApg: false });
    return r.findings.filter((f) => f.status === 'violation');
  };

  it('the rule header documents the exemption and the identity', () => {
    expect(rules).toHaveLength(1);
    expect(rules[0]!.text).toMatch(/^\/\/ exempt \(2026-10-29, shared helpers of the driving side\):/m);
    expect(rules[0]!.text).toMatch(/^\/\/ identity \(2026-10-29\):/m);
  });

  it('f19 seed: routes importing the inbound shared reply helper are not reported', async () => {
    expect(await axa('f19-seed', path.join(F19, 'seed'), null, path.join(F19, 'spec.yaml'))).toEqual([]);
  }, 120_000);

  it('f19 known false positive: a new route importing ../shared/reply is not reported', async () => {
    expect(await axa('f19-kitchen', path.join(F19, 'seed'), path.join(FX, 'f19-kitchen-routes'), path.join(F19, 'spec.yaml'))).toEqual([]);
  }, 120_000);

  it('f19: the same route reaching the in-memory database is reported once, for that import', async () => {
    const hits = await axa('f19-db', path.join(F19, 'seed'), path.join(FX, 'f19-kitchen-reads-db'), path.join(F19, 'spec.yaml'));
    expect(hits.map(identity)).toEqual(['R-AXA|src/adapters/in/http/KitchenRoutes.ts|src/adapters/in/http -> src/adapters/out/memory/CanteenDatabase.ts']);
  }, 120_000);

  it('conservative: a shared file that imports an outbound adapter is no helper, so its importers are reported', async () => {
    const hits = await axa('f19-shared-store', path.join(F19, 'seed'), path.join(FX, 'f19-shared-reaches-store'), path.join(F19, 'spec.yaml'));
    const files = [...new Set(hits.map((h) => h.file))].sort();
    // the routes and the nightly run import the shared folder; the shared file itself imports an outbound adapter
    expect(files).toEqual(expect.arrayContaining(['src/adapters/in/http/OfficeRoutes.ts', 'src/adapters/in/http/OrderRoutes.ts', 'src/adapters/in/scheduler/NightlyRun.ts', 'src/adapters/in/shared/reply.ts']));
  }, 120_000);

  it('f24 known true positive: the MQTT handler importing MemoryLockers is reported, with its own identity', async () => {
    const hits = await axa('f24-ref', path.join(F24, 'solutions', 'trap'), null, path.join(F24, 'spec.yaml'));
    const mqtt = hits.filter((h) => h.file === 'src/adapters/in/mqtt/LockBankMqtt.ts');
    expect(mqtt.map((h) => h.subject).sort()).toEqual([
      'src/adapters/in/mqtt -> src/adapters/in/http/reply.ts', // another inbound package, not the shared folder
      'src/adapters/in/mqtt -> src/adapters/out/memory/MemoryLockers.ts',
    ]);
    // two different imports from one file are two identities (v1 merged them as file|package)
    expect(new Set(mqtt.map(identity)).size).toBe(2);
  }, 120_000);
});
