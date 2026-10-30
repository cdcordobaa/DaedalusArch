/**
 * HX-RULES-V3 (2026-10-29, instrument v1.5.5): the three gaps HCAL-06 showed, each with positives and hard clean twins
 * from the development fixtures `experiments/hx-rules-v3-dev/` (development data only, never admission evidence; HCAL-06
 * itself is not used here). A case is its domain's base with the case folder overlaid, and the base is the baseline,
 * as the admission scorer runs it. Zero model calls, no Neo4j.
 *   1. R-MIRROR2 (H11): a core declaration named like a vendor declaration, vendor codes as object-literal keys, vendor
 *      field names held as strings in a list.
 *   2. R-AXA (H03): the shared-helper exemption holds on the driven side too.
 *   3. R-TRANSPORT (H07): a status-named field alone is not HTTP evidence.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { loadRules, runTree } from '../../../src/v15-instrument/index.js';
import type { Finding } from '../../../src/v15-instrument/index.js';
import { cypherMessage } from '../../../src/v15-instrument/rule-messages.js';
import { declStem, declToken } from '../../../src/v15-instrument/vendor-lexicon.js';

const REPO = path.resolve(__dirname, '..', '..', '..');
const DEV = path.join(REPO, 'experiments', 'hx-rules-v3-dev');

describe('HX-RULES-V3: R-MIRROR2 readings, R-AXA driven-side helpers, R-TRANSPORT HTTP evidence', () => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'v15-hxv3-'));
  afterAll(() => fs.rmSync(scratch, { recursive: true, force: true }));
  const all = loadRules();
  const hits = async (rule: string, domain: string, c: string | null): Promise<Finding[]> => {
    const base = path.join(DEV, domain, 'base');
    const tree = path.join(scratch, domain, c ?? 'base');
    fs.cpSync(base, tree, { recursive: true });
    if (c !== null) fs.cpSync(path.join(DEV, domain, 'cases', c), tree, { recursive: true });
    const r = await runTree(tree, all.filter((x) => x.id === rule), { spec: path.join(tree, 'spec.yaml'), scratch: path.join(scratch, '_s'), withApg: false, ...(c !== null ? { baseline: base } : {}) });
    return r.findings.filter((f) => f.status === 'violation' && f.rule === rule);
  };
  const files = (xs: Finding[]): string[] => [...new Set(xs.map((f) => f.file))].sort();

  it('the rule headers document the v1.5.5 changes', () => {
    const text = (id: string): string => all.find((r) => r.id === id)!.text;
    expect(text('R-MIRROR2')).toMatch(/^\/\/ v1\.5\.5 \(2026-10-29, HX-RULES-V3\):/m);
    expect(text('R-AXA')).toMatch(/^\/\/ exempt \(v1\.5\.5, 2026-10-29, symmetric: shared helpers of either side\):/m);
    expect(text('R-TRANSPORT')).toMatch(/^\/\/ evidence \(v1\.5\.5, 2026-10-29\):/m);
  });

  it('the bases are clean for the three rules', async () => {
    for (const d of ['freight-booking', 'parcel-lockers']) for (const rule of ['R-MIRROR2', 'R-AXA', 'R-TRANSPORT']) expect(await hits(rule, d, null)).toEqual([]);
  }, 240_000);

  describe('gap 1a: a core declaration named like a vendor declaration', () => {
    it('declaration tokens drop case, separators and a trailing Error or Exception word', () => {
      expect(declToken('AdjudicationFaultError')).toBe(declToken('AdjudicationFault'));
      expect(declToken('LOCKBOX_TIMEOUT')).toBe(declToken('LockboxTimeout'));
      expect(declStem('Error')).toEqual(['error']); // a one-word name keeps its word
    });
    it('positive: the domain error CarrierRefusal copies the vendor error class name', async () => {
      const h = await hits('R-MIRROR2', 'freight-booking', 'H11-decl-pos1');
      expect(files(h)).toEqual(['src/domain/errors.ts']);
      expect(h[0]!.evidence).toMatch(/^\[error\] src\/domain\/errors\.ts:\d+ CarrierRefusal copies the vendor declaration name 'CarrierRefusal' \(CarrierRefusal of cargolink-sdk\)$/);
    }, 120_000);
    it('positive: an out-port type named BookingReply, and LockboxTimeoutError (Error suffix added)', async () => {
      expect(files(await hits('R-MIRROR2', 'freight-booking', 'H11-decl-pos2'))).toEqual(['src/application/ports/out/carrier-booking.port.ts']);
      const h = await hits('R-MIRROR2', 'parcel-lockers', 'H11-decl-pos3');
      expect(h.map((f) => f.subject)).toEqual(['LockboxTimeoutError']);
    }, 120_000);
    it('hard twins: a glossary-owned name (ShipmentWindow), a one-word name (Lane), an own close name', async () => {
      for (const c of ['H11-decl-twin1', 'H11-decl-twin2', 'H11-decl-twin3']) expect(await hits('R-MIRROR2', 'freight-booking', c)).toEqual([]);
      expect(await hits('R-MIRROR2', 'parcel-lockers', 'H11-decl-twin4')).toEqual([]);
    }, 240_000);
  });

  describe('gap 1b: vendor codes as object-literal keys', () => {
    it('positive: a domain error message table keyed by four vendor hold codes', async () => {
      const h = await hits('R-MIRROR2', 'freight-booking', 'H11-key-pos1');
      expect(files(h)).toEqual(['src/domain/errors.ts']);
      expect(h.map((f) => /'([A-Z0-9]+)'/.exec(f.subject)?.[1]).sort()).toEqual(['H10', 'H22', 'H31', 'H47']);
      expect(h[0]!.evidence).toMatch(/uses the vendor code 'H\d+' \(\S+ of cargolink-sdk\) in key$/);
    }, 120_000);
    it('positive: application and domain tables keyed by vendor state and fault codes', async () => {
      expect(files(await hits('R-MIRROR2', 'freight-booking', 'H11-key-pos2'))).toEqual(['src/application/booking-priority.ts']);
      expect(files(await hits('R-MIRROR2', 'parcel-lockers', 'H11-key-pos3'))).toEqual(['src/domain/locker-faults.ts']);
    }, 120_000);
    it('hard twins: domain-word keys with the codes mapped in the adapter; short tier keys', async () => {
      for (const c of ['H11-key-twin1', 'H11-key-twin2']) expect(await hits('R-MIRROR2', 'freight-booking', c)).toEqual([]);
      expect(await hits('R-MIRROR2', 'parcel-lockers', 'H11-key-twin3')).toEqual([]);
    }, 240_000);
  });

  describe('gap 1c: vendor field names held as strings in a list', () => {
    it('positive: a const array of five vendor field names, and a tuple type of three', async () => {
      const h = await hits('R-MIRROR2', 'freight-booking', 'H11-list-pos1');
      expect(h).toHaveLength(1);
      expect(h[0]!.evidence).toMatch(/^\[field-list\] src\/application\/booking-statement\.ts:1 STATEMENT_COLUMNS lists the fields of BookingReply of cargolink-sdk: /);
      expect(files(await hits('R-MIRROR2', 'freight-booking', 'H11-list-pos2'))).toEqual(['src/domain/charge-row.ts']);
      expect(files(await hits('R-MIRROR2', 'parcel-lockers', 'H11-list-pos3'))).toEqual(['src/application/door-audit.ts']);
    }, 240_000);
    it('hard twins: renamed columns, plain-word columns, a list that is not the vendor set, the list in the adapter', async () => {
      for (const c of ['H11-list-twin1', 'H11-list-twin2', 'H11-list-twin3']) expect(await hits('R-MIRROR2', 'freight-booking', c)).toEqual([]);
      expect(await hits('R-MIRROR2', 'parcel-lockers', 'H11-list-twin4')).toEqual([]);
    }, 240_000);
  });

  it('messages: the decl and field-list shapes get their own fix (rule-messages.ts)', async () => {
    const rule = all.find((r) => r.id === 'R-MIRROR2');
    const decl = cypherMessage((await hits('R-MIRROR2', 'freight-booking', 'H11-decl-pos2'))[0]!, rule);
    expect(decl.fix).toMatch(/^Rename BookingReply to a term the domain owns/);
    expect(decl.why).toMatch(/from cargolink-sdk\)\.$/);
    const list = cypherMessage((await hits('R-MIRROR2', 'freight-booking', 'H11-list-pos1'))[0]!, rule);
    expect(list.fix).toMatch(/^List the values STATEMENT_COLUMNS needs under names the domain owns \(not the vendor's 'booking_ref', /);
  }, 120_000);

  describe('gap 2: R-AXA shared helpers of the driven side', () => {
    it('positives: out to out, a driven shared file that imports an adapter, imports across sides into a shared folder', async () => {
      expect(files(await hits('R-AXA', 'parcel-lockers', 'H03-pos1'))).toEqual(['src/adapters/out/notification/sms-recipient-notifier.ts']);
      expect(files(await hits('R-AXA', 'parcel-lockers', 'H03-pos2'))).toEqual([
        'src/adapters/out/notification/sms-recipient-notifier.ts', 'src/adapters/out/persistence/in-memory-parcel.repository.ts', 'src/adapters/out/shared/phone-mask.ts',
      ]);
      expect((await hits('R-AXA', 'parcel-lockers', 'H03-pos3')).map((f) => f.subject)).toEqual(['src/adapters/out/persistence -> src/adapters/in/shared/reply.ts']);
      expect((await hits('R-AXA', 'parcel-lockers', 'H03-pos4')).map((f) => f.subject)).toEqual(['src/adapters/in/http -> src/adapters/out/shared/phone-mask.ts']);
    }, 240_000);
    it('hard twins: two outbound packages importing adapters/out/shared, adapters/out/common, the driving-side folder', async () => {
      for (const c of ['H03-twin1', 'H03-twin2', 'H03-twin3']) expect(await hits('R-AXA', 'parcel-lockers', c)).toEqual([]);
    }, 240_000);
  });

  describe('gap 3: R-TRANSPORT needs HTTP evidence', () => {
    it('positives: an HTTP status initializer, an assigned status, an HTTP status type, a compared status', async () => {
      const evidence = async (c: string): Promise<string[]> => (await hits('R-TRANSPORT', 'parcel-lockers', c)).map((f) => f.evidence);
      expect(await evidence('H07-pos1')).toEqual(['domain code uses a transport concept: field statusCode']);
      expect(await evidence('H07-pos2')).toEqual(['domain code uses a transport concept: statusCode = 409']);
      expect(await evidence('H07-pos3')).toEqual(['port code uses a transport concept: field httpStatus']);
      expect(await evidence('H07-pos4')).toEqual(['application code uses a transport concept: statusCode === 404']);
    }, 240_000);
    it('hard twins: a string status code, a numeric firmware status code, a status code typed by the parcel state', async () => {
      for (const c of ['H07-twin1', 'H07-twin2', 'H07-twin3']) expect(await hits('R-TRANSPORT', 'parcel-lockers', c)).toEqual([]);
    }, 240_000);
  });
});
