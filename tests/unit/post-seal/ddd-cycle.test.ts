/**
 * v1.4 U2 FF-S02 no-cyclic-deps in the DDD rule set (decision D5; design BR-U2-04, §6 tests 2 and 4; plan step 9.3).
 * The frozen template, unchanged, read in the literal edge view (ADR-V13-01). No Neo4j, no network, no model.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import { evaluate, Graph } from '../semantic-rules/semantic-harness.js';
import { ruleTier } from '../../../src/scoring-engine/rule-tiers.js';
import { cycleFileSet } from '../../../scripts/v1.3/lib/compare.js';
import { materialiseVariant } from '../../../scripts/v1.3/lib/materialise.js';
import { loadReference } from '../../../scripts/v1.3/lib/reference-model.js';
import { must, ROOT, runPipeline } from './helpers.js';

const PLACE = 'src/ordering/application/PlaceOrder.ts';
const REPO = 'src/ordering/domain/customer/CustomerRepository.ts';
const CUSTOMER = 'src/ordering/domain/customer/Customer.ts';

function triangle(closed: boolean): Graph {
  const g = new Graph();
  const place = g.file(PLACE, 'application');
  const repo = g.file(REPO, 'domain');
  const customer = g.file(CUSTOMER, 'domain');
  g.imports(place, repo).imports(repo, customer);
  if (closed) g.imports(customer, place);
  return g;
}

describe('FF-S02 in ddd (D5)', () => {
  it('tier: blocking, from the sealed FF-S02 row (source table, not post-seal)', () => {
    expect(ruleTier('FF-S02', 'ddd')).toMatchObject({ tier: 'blocking', source: 'table' });
  });

  it('positive: PlaceOrder -> CustomerRepository -> Customer -> PlaceOrder is one violation identity, its sorted file set', async () => {
    const r = await evaluate('ddd', 'FF-S02', triangle(true));
    expect(r.keys.length).toBeGreaterThan(0);
    expect([...new Set(r.keys)]).toEqual([`cycle{${[CUSTOMER, REPO, PLACE].sort().join(' ')}}`]);
  });

  it('twin: the same files without Customer -> PlaceOrder give no row', async () => {
    expect((await evaluate('ddd', 'FF-S02', triangle(false))).keys).toEqual([]);
  });

  it('public-API path: a cross-context path through index.ts barrels is a row only when the literal edges close a cycle', async () => {
    const build = (closed: boolean): Graph => {
      const g = new Graph();
      const place = g.file(PLACE, 'application');
      const billingApi = g.file('src/billing/index.ts', 'application');
      const invoicing = g.file('src/billing/application/Invoicing.ts', 'application');
      const orderingApi = g.file('src/ordering/index.ts', 'application');
      g.imports(place, billingApi).reExports(billingApi, invoicing).reExports(orderingApi, place);
      if (closed) g.imports(invoicing, orderingApi);
      return g;
    };
    expect((await evaluate('ddd', 'FF-S02', build(false))).keys).toEqual([]);
    const closed = await evaluate('ddd', 'FF-S02', build(true));
    expect(new Set(closed.keys).size).toBe(1);
    expect(closed.keys[0]).toContain('src/billing/index.ts');
  });
});

describe('the ddd reference v09 overlay through the pipeline (cypher-interp, v1.3 scoring)', () => {
  it('holds the FF-S02 cycle over PlaceOrder.ts, CustomerRepository.ts and Customer.ts with post-seal on, and none with it off', async () => {
    const ref = loadReference(ROOT, 'ddd');
    const v = must(ref.variants.find((x) => x.manifest.variant === 'v09-domain-imports-application'), 'v09');
    const scratch = fs.mkdtempSync(`${os.tmpdir()}/u2-v09-`);
    try {
      const m = materialiseVariant(ref, v, scratch);
      const on = await runPipeline(m.projectDir, ref.specPath);
      if (!on.success) throw new Error(on.errors.map((e) => e.message).join('; '));
      const cycles = on.data.violations.filter((x) => String(x.functionId) === 'FF-S02')
        .map((x) => cycleFileSet({ file: x.filePath.split(`${m.projectDir}/`).join(''), target: typeof x.target === 'string' ? x.target : '' }));
      expect(cycles.length).toBeGreaterThan(0);
      const names = [...new Set(cycles)].map((s) => s.split(',').map((f) => f.split('/').pop()).sort().join(','));
      expect(names).toContain(['Customer.ts', 'CustomerRepository.ts', 'PlaceOrder.ts'].sort().join(','));
      expect(on.data.tiers?.blocking.rules.find((r) => String(r.functionId) === 'FF-S02')).toMatchObject({ tier: 'blocking', tierSource: 'table', violated: true });
      const off = await runPipeline(m.projectDir, ref.specPath, { postSealRules: false });
      if (!off.success) throw new Error(off.errors.map((e) => e.message).join('; '));
      expect(off.data.violations.filter((x) => String(x.functionId) === 'FF-S02')).toEqual([]);
    } finally {
      fs.rmSync(scratch, { recursive: true, force: true });
    }
  }, 120_000);
});
