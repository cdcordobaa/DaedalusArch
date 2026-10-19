/**
 * v1.4 U2 FF-P07 on operator-seeded positives (design §6 test 3; plan step 9.4): the existing, unchanged
 * AP-FRAMEWORK-LEAK operator and its twin AP-FRAMEWORK-LEAKn on temporary copies of two hosts, then the pipeline
 * (cypher-interp, symbolic-only, v1.3 scoring). The seeded file has an FF-P07 row; the twin has none.
 *
 * Circularity (design R12): the operator plants `express` and the default list holds `express`, so the seed hit holds
 * by construction and is not validity evidence. The twin is the evidence this test adds. No Neo4j, no model.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { ANTIPATTERN_OPERATORS } from '../../../scripts/lib/mutation/antipatterns/index.js';
import { applyForced, fixtureBase, REPO } from '../scripts/mutation/operator-harness.js';
import { runPipeline } from './helpers.js';

jest.setTimeout(120_000);

interface Host {
  readonly name: string;
  readonly dir: string;
  readonly spec: string;
  /** A forced site (antipattern-nest, as its own operator test), or undefined to let the seed pick. */
  readonly site?: { readonly filePath: string; readonly detail: Record<string, string> };
}

const HOSTS: readonly Host[] = [
  { name: 'antipattern-nest (nestjs)', dir: 'fixtures/unit/antipattern-nest', spec: 'fixtures/unit/antipattern-nest/firewall.spec.yaml',
    site: { filePath: 'src/invoice/invoice.service.ts', detail: { class: 'InvoiceService', method: 'issue', framework: 'express' } } },
  { name: 'ap-hosts/translation-jobs (hexagonal)', dir: 'fixtures/unit/ap-hosts/translation-jobs', spec: 'fixtures/unit/ap-hosts/translation-jobs/firewall.spec.yaml' },
];

let scratch: string;
beforeAll(() => { scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'u2-seeds-')); });
afterAll(() => { fs.rmSync(scratch, { recursive: true, force: true }); });

async function p07Rows(copy: string, spec: string): Promise<{ file: string; target: string }[]> {
  const r = await runPipeline(copy, path.join(REPO, spec));
  if (!r.success) throw new Error(r.errors.map((e) => `${e.code}: ${e.message}`).join('; '));
  return r.data.violations.filter((v) => String(v.functionId) === 'FF-P07')
    .map((v) => ({ file: v.filePath.split(`${copy}/`).join(''), target: v.target ?? '' }));
}

describe.each(HOSTS)('AP-FRAMEWORK-LEAK seeds: $name', (host) => {
  it('the unseeded host has no FF-P07 row', async () => {
    expect(await p07Rows(path.join(REPO, host.dir), host.spec)).toEqual([]);
  });

  it('the seeded file has an FF-P07 row on express; the twin (a DTO parameter) has none', async () => {
    const base = fixtureBase(host.spec, path.join(REPO, host.dir));
    const seeded = await applyForced(scratch, ANTIPATTERN_OPERATORS, 'AP-FRAMEWORK-LEAK', base, host.site);
    // Non-vacuity: the operator applied a seed (its precondition needs express to be visible in the host).
    expect(seeded.row).toBeDefined();
    const file = seeded.row?.site.filePath ?? '';
    expect(fs.readFileSync(path.join(seeded.copy, file), 'utf8')).toContain("from 'express'");
    expect(await p07Rows(seeded.copy, host.spec)).toEqual([{ file, target: 'express' }]);

    const twin = await applyForced(scratch, ANTIPATTERN_OPERATORS, 'AP-FRAMEWORK-LEAKn', base, { filePath: file, detail: seeded.row?.site.detail ?? {} });
    expect(twin.row).toBeDefined();
    expect(await p07Rows(twin.copy, host.spec)).toEqual([]);
  });
});
