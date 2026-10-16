import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { findingsOfReport, loadFindings, loadJobs, templateOf } from '../../../../../scripts/v1.3/lib/labelling/findings.js';
import type { Finding } from '../../../../../scripts/v1.3/lib/labelling/findings.js';
import { BLOCKING_COVERAGE, CHECKERS, UNCOVERABLE, checkFinding } from '../../../../../scripts/v1.3/lib/labelling/correctness.js';
import { loadSpecView } from '../../../../../scripts/v1.3/lib/labelling/spec-facts.js';
import type { SpecView } from '../../../../../scripts/v1.3/lib/labelling/spec-facts.js';
import { SourceFacts, SourceFactsCache } from '../../../../../scripts/v1.3/lib/labelling/source-facts.js';
import { jobsMain, checkMain } from '../../../../../scripts/v1.3/lib/labelling/mains.js';
import { ruleTier } from '../../../../../src/scoring-engine/rule-tiers.js';
import { DDD_FUNCTIONS } from '../../../../../src/spec-parser/ddd-template.js';
import { HEXAGONAL_TEMPLATES } from '../../../../../src/fitness-compiler/hexagonal-templates.js';

const REPO = path.resolve(__dirname, '../../../../..');
const MINI = path.join(REPO, 'tests/fixtures/v1.3-labelling/clean-mini');

let spec: SpecView;
let src: SourceFacts;

beforeAll(async () => {
  spec = await loadSpecView(path.join(MINI, 'spec.yaml'));
  src = new SourceFacts(MINI);
});

/** One finding as the report would carry it. */
function finding(v: Record<string, unknown>): Finding {
  const [f] = findingsOfReport({ violations: [{ id: 'v-1', route: 'symbolic', message: 'm', ...v }] }, { projectId: 'mini' }, 'clean-architecture');
  if (f === undefined) throw new Error('no finding');
  return f;
}

const verdict = (v: Record<string, unknown>): string => checkFinding(finding(v), spec, src).verdict;

const DOMAIN_OUT = { type: 'LAYER_VIOLATION', functionId: 'FF-S01', filePath: 'src/domain/Order.ts', target: 'src/infrastructure/Db.ts', line: 1, discriminator: ['IMPORTS'] };

describe('correctness checker: edge rules (clean-mini fixture)', () => {
  it('confirms an outward import at the stated line and target', () => {
    const r = checkFinding(finding(DOMAIN_OUT), spec, src);
    expect(r.verdict).toBe('correct');
    expect(r.checks.join(' ')).toContain('resolves to src/infrastructure/Db.ts');
  });

  it('reads the source with the pinned E1 tsconfig (ADR-032) and keeps a bounded cache', () => {
    const pinned = new SourceFacts(MINI, { tsconfig: 'adr-032' });
    expect(checkFinding(finding(DOMAIN_OUT), spec, pinned).verdict).toBe('correct');
    const cache = new SourceFactsCache(1);
    const a = cache.get(MINI, 'adr-032');
    expect(cache.get(MINI, 'adr-032')).toBe(a);
    expect(cache.get(MINI, 'own')).not.toBe(a);
    expect(cache.get(MINI, 'adr-032')).not.toBe(a);
  });

  it('rejects a wrong line, a wrong target, a wrong relation and a missing file', () => {
    expect(verdict({ ...DOMAIN_OUT, line: 5 })).toBe('incorrect');
    expect(verdict({ ...DOMAIN_OUT, target: 'src/infrastructure/OrderRepository.ts' })).toBe('incorrect');
    expect(verdict({ ...DOMAIN_OUT, discriminator: ['RE_EXPORTS'] })).toBe('incorrect');
    expect(verdict({ ...DOMAIN_OUT, filePath: 'src/domain/Nope.ts' })).toBe('incorrect');
  });

  it('rejects an import that follows the layer order', () => {
    const r = checkFinding(finding({ ...DOMAIN_OUT, filePath: 'src/infrastructure/ProductRepository.ts', target: 'src/domain/ProductRepo.ts' }), spec, src);
    expect(r.verdict).toBe('incorrect');
    expect(r.reason).toContain('follows the layer order');
  });

  it('checks domain outward dependencies by spec globs', () => {
    expect(verdict({ ...DOMAIN_OUT, type: 'DOMAIN_OUTWARD_DEP', functionId: 'FF-S04' })).toBe('correct');
    expect(verdict({ ...DOMAIN_OUT, type: 'DOMAIN_OUTWARD_DEP', functionId: 'FF-S04', filePath: 'src/application/PlaceOrder.ts', target: 'src/domain/index.ts' })).toBe('incorrect');
  });

  it('checks domain purity against the spec forbidden list (package root of a bare specifier)', () => {
    const base = { type: 'DOMAIN_PURITY_VIOLATION', functionId: 'FF-P01', filePath: 'src/domain/Order.ts', target: '@nestjs/common', line: 2, discriminator: ['IMPORTS'] };
    expect(verdict(base)).toBe('correct');
    expect(verdict({ ...base, target: 'lodash' })).toBe('incorrect');
    expect(verdict({ ...base, line: 1 })).toBe('incorrect');
    expect(verdict({ ...base, filePath: 'src/application/PlaceOrder.ts', line: 1 })).toBe('incorrect');
  });

  it('confirms a cycle only when every step resolves to the next file', () => {
    const cycle = JSON.stringify(['src/application/CycleA.ts', 'src/application/CycleB.ts', 'src/application/CycleA.ts']);
    expect(verdict({ type: 'CYCLIC_DEPENDENCY', functionId: 'FF-S02', filePath: 'src/application/CycleA.ts', discriminator: [cycle] })).toBe('correct');
    const broken = JSON.stringify(['src/application/CycleA.ts', 'src/application/PlaceOrder.ts', 'src/application/CycleA.ts']);
    expect(verdict({ type: 'CYCLIC_DEPENDENCY', functionId: 'FF-S02', filePath: 'src/application/CycleA.ts', discriminator: [broken] })).toBe('incorrect');
  });

  it('follows a barrel in the resolved view only', () => {
    const facts = src.importsAt('src/application/PlaceOrder.ts', [1]);
    expect(facts).toHaveLength(1);
    const [fact] = facts;
    if (fact === undefined) throw new Error('no import');
    expect(fact.resolvedFile).toBe('src/domain/index.ts');
    expect(src.declaringFiles(fact)).toEqual(['src/domain/Money.ts']);
  });
});

describe('correctness checker: declaration rules', () => {
  it('repository-pattern: a repository with no interface is correct, one implementing a port is not', () => {
    const base = { type: 'REPOSITORY_PATTERN_VIOLATION', functionId: 'FF-P03', filePath: 'src/infrastructure/OrderRepository.ts', discriminator: ['OrderRepository'] };
    expect(verdict(base)).toBe('correct');
    const r = checkFinding(finding({ ...base, filePath: 'src/infrastructure/ProductRepository.ts', discriminator: ['ProductRepository'] }), spec, src);
    expect(r.verdict).toBe('incorrect');
    expect(r.reason).toContain('ProductRepo');
    expect(verdict({ ...base, discriminator: ['Missing'] })).toBe('incorrect');
  });

  it('domain-state-purity: checks constructor injection, reports the FLOWS_TO half not-checkable', () => {
    const base = { type: 'DOMAIN_STATE_PURITY_VIOLATION', functionId: 'FF-P06', filePath: 'src/domain/OrderPolicy.ts', target: 'src/infrastructure/Db.ts' };
    expect(verdict({ ...base, discriminator: ['OrderPolicy', 'Db', 'CONSTRUCTOR_INJECTS', 'db'] })).toBe('correct');
    expect(verdict({ ...base, discriminator: ['OrderPolicy', 'Db', 'CONSTRUCTOR_INJECTS', 'other'] })).toBe('incorrect');
    expect(verdict({ ...base, discriminator: ['OrderPolicy', 'Money', 'CONSTRUCTOR_INJECTS', 'db'] })).toBe('incorrect');
    expect(verdict({ ...base, discriminator: ['OrderPolicy', 'Db', 'FLOWS_TO', 'db'] })).toBe('not-checkable');
  });

  it('test-file-pairing: a paired file is incorrect, an unpaired one correct', () => {
    expect(verdict({ type: 'MISSING_TEST_FILE', functionId: 'FF-CV05', filePath: 'src/infrastructure/OrderRepository.ts' })).toBe('correct');
    expect(verdict({ type: 'MISSING_TEST_FILE', functionId: 'FF-CV05', filePath: 'src/infrastructure/Db.ts' })).toBe('incorrect');
  });

  it('a template without a check is not-checkable, with the reason', () => {
    const r = checkFinding(finding({ type: 'FAN_OUT_EXCEEDED', functionId: 'FF-C02', filePath: 'src/domain/Order.ts' }), spec, src);
    expect(r.verdict).toBe('not-checkable');
    expect(r.reason).toContain('module-fan-out');
  });
});

describe('coverage of the blocking rules (rule-tiers.md)', () => {
  it('every coverage row is blocking for its style and has a checker', () => {
    for (const row of BLOCKING_COVERAGE) {
      expect([row.style, row.ruleId, ruleTier(row.ruleId, row.style).tier]).toEqual([row.style, row.ruleId, 'blocking']);
      expect(CHECKERS[row.template]).toBeDefined();
    }
  });

  it('covers every blocking DDD and hexagonal template', () => {
    const rows = new Set(BLOCKING_COVERAGE.map((r) => `${r.style}:${r.template}`));
    for (const f of DDD_FUNCTIONS) if (f.tier === 'blocking') expect(rows).toContain(`ddd:${f.name}`);
    for (const name of HEXAGONAL_TEMPLATES.keys()) {
      const id = { 'dependency-direction-graph': 'FF-S01', 'core-isolation': 'FF-S04', 'port-adapter-pattern': 'FF-P03', 'port-dependency-inversion': 'FF-P02', 'layer-skip-graph': 'FF-S03' }[name] ?? '';
      if (ruleTier(id, 'hexagonal').tier === 'blocking') expect(rows).toContain(`hexagonal:${name}`);
    }
    expect(UNCOVERABLE.length).toBeGreaterThan(0);
  });

  it('recovers templates from violation types', () => {
    expect(templateOf('CUSTOM_core-isolation', 'FF-S04')).toBe('core-isolation');
    expect(templateOf('LAYER_SKIP', 'FF-S03')).toBe('no-layer-skip');
    expect(templateOf('NAMING_CONVENTION', 'FF-CV03')).toBe('naming-repos');
    expect(templateOf('INSTABILITY_VIOLATION', 'FF-C01')).toBe('domain-stability');
  });
});

describe('reference runs (hexagonal and DDD evidence, materialised variants)', () => {
  // after-member-facts: the v1.3 member-fact FF-DT03 rows (`Class.member (clause)` discriminators).
  const evidence = path.join(REPO, 'results/v1.3-reference/after-member-facts/evidence');
  let tmp: string;
  const io = { env: {}, out: () => undefined, err: () => undefined };

  beforeAll(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'v13-label-test-'));
    // Only the hexagonal and DDD evidence, to keep the suite fast.
    const sub = path.join(tmp, 'evidence');
    for (const style of ['hexagonal', 'ddd']) fs.cpSync(path.join(evidence, style), path.join(sub, style), { recursive: true });
    expect(jobsMain(['--reference', sub, '--materialise', path.join(tmp, 'variants'), '--out', path.join(tmp, 'jobs.json')], REPO, io)).toBe(0);
  });

  afterAll(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('re-verifies every blocking finding as correct (FF-P06 FLOWS_TO rows not-checkable)', async () => {
    expect(await checkMain(['--jobs', path.join(tmp, 'jobs.json'), '--tiers', 'blocking', '--out', path.join(tmp, 'out')], io)).toBe(0);
    const { results } = JSON.parse(fs.readFileSync(path.join(tmp, 'out/correctness.json'), 'utf8')) as { results: { rule: string; verdict: string; reason: string }[] };
    expect(results.length).toBeGreaterThan(10);
    for (const r of results) {
      if (r.rule === 'FF-P06/domain-state-purity') expect(r.verdict).toBe('not-checkable');
      else expect([r.rule, r.verdict, r.reason]).toEqual([r.rule, 'correct', r.reason]);
    }
    expect(new Set(results.map((r) => r.rule))).toContain('FF-DS02/context-isolation');
  }, 120_000);

  it('turns a planted finding incorrect when its line or target is moved', async () => {
    const jobs = loadJobs(path.join(tmp, 'jobs.json')).jobs;
    const all = loadFindings(jobs);
    const f = all.find((x) => x.ruleId === 'FF-S01' && x.style === 'hexagonal' && x.line !== undefined);
    const job = jobs.find((j) => j.projectId === f?.projectId);
    if (f === undefined || job === undefined) throw new Error('no hexagonal FF-S01 finding');
    const view = await loadSpecView(job.spec);
    const facts = new SourceFacts(job.projectRoot);
    expect(checkFinding(f, view, facts).verdict).toBe('correct');
    expect(checkFinding({ ...f, line: 9999 }, view, facts).verdict).toBe('incorrect');
    expect(checkFinding({ ...f, target: 'src/domain/Nowhere.ts' }, view, facts).verdict).toBe('incorrect');
  }, 120_000);

  it('FF-DT03 member-fact rows: each listed member must hold its clause', async () => {
    const jobs = loadJobs(path.join(tmp, 'jobs.json')).jobs;
    const dt03 = loadFindings(jobs).filter((x) => x.ruleId === 'FF-DT03');
    expect(dt03.length).toBeGreaterThanOrEqual(2);
    for (const f of dt03) {
      const job = jobs.find((j) => j.projectId === f.projectId);
      if (job === undefined) throw new Error('no job');
      const view = await loadSpecView(job.spec);
      const facts = new SourceFacts(job.projectRoot);
      expect(checkFinding(f, view, facts).verdict).toBe('correct');
      const [cls, members] = f.discriminator;
      const swapped = (members ?? '').replace(/\((set accessor|public mutable field)\)/, (m) => (m === '(set accessor)' ? '(mutator method)' : '(set accessor)'));
      expect(checkFinding({ ...f, discriminator: [cls ?? '', swapped] }, view, facts).verdict).toBe('incorrect');
      expect(checkFinding({ ...f, discriminator: [cls ?? '', `${cls ?? ''}.nowhere (mutator method)`] }, view, facts).verdict).toBe('incorrect');
    }
  }, 120_000);
});
