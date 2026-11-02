/**
 * H11D-DEV (2026-11-02, instrument v1.5.7, exploratory): R-MIRROR2's field shapes for H11-c (one field renamed to a
 * vendor field) and H11-d (vendor field names copied into the core). Fixtures: `experiments/h11d-dev/` overlaid on the
 * `experiments/hx-rules-v3-dev/` bases (development data only, never admission evidence; HCAL-07 is not used). A case is
 * its base with the case folder overlaid, and the base is the baseline, as the admission scorer runs it. Zero model
 * calls, no Neo4j.
 *   - c and d separate by shape word: one exact vendor field on a core type is `[field]`; two or more on one type are one
 *     `[field-group]` finding (and no `[field]`); a type that copies a vendor declaration's whole field set stays
 *     `[field-set]`; lists and object tables of vendor field names are `[field-list]`.
 *   - the missed d forms: a list drawn from several declarations of one vendor module; vendor names as object values
 *     (and as object keys).
 *   - hard clean twins: the table in the adapter, camelCase values, a partly overlapping own column list, one-word keys,
 *     one-word fields across declarations, and three one-word fields of one declaration (the generic field-set).
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { loadRules, runTree } from '../../../src/v15-instrument/index.js';
import type { Finding } from '../../../src/v15-instrument/index.js';
import { cypherMessage } from '../../../src/v15-instrument/rule-messages.js';

const REPO = path.resolve(__dirname, '..', '..', '..');
const DEV = path.join(REPO, 'experiments', 'h11d-dev');
const BASES = path.join(REPO, 'experiments', 'hx-rules-v3-dev');
const RULE = 'R-MIRROR2';
const shape = (f: Finding): string => /^\[([a-z-]+)\]/.exec(f.evidence)?.[1] ?? '?';

describe('H11D-DEV: R-MIRROR2 separates H11-c from H11-d and reads the missed d forms', () => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'v15-h11d-'));
  afterAll(() => fs.rmSync(scratch, { recursive: true, force: true }));
  const rules = loadRules().filter((r) => r.id === RULE);
  const hits = async (domain: string, c: string): Promise<Finding[]> => {
    const base = path.join(BASES, domain, 'base');
    const tree = path.join(scratch, domain, c);
    fs.cpSync(base, tree, { recursive: true });
    fs.cpSync(path.join(DEV, domain, 'cases', c), tree, { recursive: true });
    const r = await runTree(tree, rules, { spec: path.join(tree, 'spec.yaml'), scratch: path.join(scratch, '_s'), withApg: false, baseline: base });
    return r.findings.filter((f) => f.status === 'violation' && f.rule === RULE);
  };
  const shapes = (xs: Finding[]): string[] => [...new Set(xs.map(shape))].sort();

  it('the rule header documents the v1.5.7 change', () => {
    expect(rules[0]!.text).toMatch(/^\/\/ v1\.5\.7 \(2026-11-02\): /m);
  });

  it('labels: every case has a label with sub-shape c or d', () => {
    for (const d of ['freight-booking', 'parcel-lockers']) {
      const labels = JSON.parse(fs.readFileSync(path.join(DEV, d, 'labels.json'), 'utf8')) as Record<string, { subshape: string }>;
      expect(Object.keys(labels).sort()).toEqual(fs.readdirSync(path.join(DEV, d, 'cases')).sort());
      for (const l of Object.values(labels)) expect(['c', 'd']).toContain(l.subshape);
    }
  });

  describe('c: one field renamed to a vendor field is [field] only', () => {
    it('positives: confirmed_at on a domain summary; opened_at on a visit record', async () => {
      const a = await hits('freight-booking', 'H11c-pos1');
      expect(shapes(a)).toEqual(['field']);
      expect(a.map((f) => f.subject)).toEqual(['BookingSummary.confirmed_at']);
      const b = await hits('parcel-lockers', 'H11c-pos2');
      expect(shapes(b)).toEqual(['field']);
      expect(b.map((f) => f.subject)).toEqual(['LockerVisit.opened_at']);
    }, 120_000);
  });

  describe('d: vendor field names in the core carry a d shape word and never [field]', () => {
    it('a type declaring three vendor fields beside its own is one [field-group] finding', async () => {
      const h = await hits('freight-booking', 'H11d-type-pos1');
      expect(h).toHaveLength(1);
      expect(h[0]!.subject).toBe('BookingSummary');
      expect(h[0]!.evidence).toMatch(/^\[field-group\] src\/domain\/booking-summary\.ts:\d+ BookingSummary declares 3 fields named like the vendor fields of BookingReply of cargolink-sdk: 'booking_state', 'freight_charge', 'fuel_surcharge'$/);
      const msg = cypherMessage(h[0]!, rules[0]!);
      expect(msg.fix).toMatch(/^Give BookingSummary the fields the core needs, named in the domain's terms .*cargolink-sdk/);
    }, 120_000);
    it('a type copying the vendor report is [field-group] and [field-set] on one subject', async () => {
      const h = await hits('parcel-lockers', 'H11d-type-pos2');
      expect(shapes(h)).toEqual(['field-group', 'field-set']);
      expect([...new Set(h.map((f) => f.subject))]).toEqual(['DoorSnapshot']);
    }, 120_000);
    it('a string[] column list drawn from two vendor declarations (request and reply) is [field-list]', async () => {
      const h = await hits('freight-booking', 'H11d-mixlist-pos1');
      expect(shapes(h)).toEqual(['field-list']);
      expect(h[0]!.evidence).toMatch(/MANIFEST_COLUMNS lists the fields of .*BookingRequest.* of cargolink-sdk: 'shipper_account', 'pallet_count', 'booking_ref', 'freight_charge'$/);
      expect(h[0]!.evidence).toMatch(/BookingReply/);
    }, 120_000);
    it('vendor field names as object values, and as object keys, are [field-list]', async () => {
      for (const [d, c, subject] of [['freight-booking', 'H11d-objval-pos1', 'BOOKING_FIELDS'], ['parcel-lockers', 'H11d-objval-pos2', 'DOOR_COLUMNS'], ['freight-booking', 'H11d-objkey-pos1', 'CHARGE_LABELS']] as const) {
        const h = await hits(d, c);
        expect(shapes(h)).toEqual(['field-list']);
        expect(h.map((f) => f.subject)).toEqual([subject]);
      }
    }, 240_000);
  });

  describe('hard clean twins', () => {
    it('the table in the adapter; camelCase values; an own list with two vendor names of four', async () => {
      for (const c of ['H11d-objval-twin1', 'H11d-objval-twin2', 'H11d-mixlist-twin1']) expect(await hits('freight-booking', c)).toEqual([]);
    }, 240_000);
    it('one-word keys; one-word fields across declarations; three one-word fields of one declaration', async () => {
      for (const c of ['H11d-objkey-twin1', 'H11d-type-twin1', 'H11d-type-twin2']) expect(await hits('freight-booking', c)).toEqual([]);
    }, 240_000);
    it('a column map valued with the service own words', async () => {
      expect(await hits('parcel-lockers', 'H11d-objval-twin3')).toEqual([]);
    }, 120_000);
  });
});
