/**
 * v1.5 instrument (Stage 0): the promoted RULES-V15 and APG-V15 graph build reproduce the prototype's development
 * evidence. Zero model calls, no Neo4j.
 * - The Cypher rules in `src/v15-instrument/rules/` are byte-identical to `experiments/detect-02/rules/`.
 * - The DETECT-02 precision fixtures (10 patterns; legit and positive twins; declared and inferred roots) give exactly
 *   the rows recorded in `experiments/detect-02/results/precision.json` (0 false-positive runs of 20, 12 of 12
 *   positives flagged).
 * - The frozen v1.4 instrument stays the default.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import YAML from 'yaml';
import { INSTRUMENTS, loadRules, rulesDir, runTree, selectedInstrument } from '../../../src/v15-instrument/index.js';

const REPO = path.resolve(__dirname, '..', '..', '..');
const FX = path.join(REPO, 'experiments', 'detect-02', 'fixtures', 'precision');

interface Row { fixture: string; variant: string; condition: string; pass: boolean; rootSource: string; roots: string[]; violations: unknown[]; allowed: unknown[]; info: number }
interface Meta { pattern: string; legit: string; positive: string | null; expectLegit?: 'allowed'; expectPositive?: string[] }

describe('v1.5 instrument: rules', () => {
  it('loads the RULES-V15 Cypher rules: the seven prototype rules byte-identical, plus R-D5S (C1, v1.5 only)', () => {
    const rules = loadRules();
    expect(rules.map((r) => r.id).sort()).toEqual(['R-ADAPTER-RULE', 'R-AXA', 'R-COREIO', 'R-D3', 'R-D4', 'R-D4R', 'R-D5', 'R-D5S', 'R-D9', 'R-ENTITY-OUT', 'R-H5', 'R-INJ', 'R-LOCATOR', 'R-LOCK', 'R-MIRROR', 'R-MIRROR2', 'R-PURE', 'R-REF', 'R-RTX', 'R-TRANSPORT', 'R-XCTX']);
    for (const r of rules.filter((x) => !['R-D5S', 'R-D3', 'R-LOCK', 'R-REF', 'R-AXA', 'R-TRANSPORT', 'R-PURE', 'R-D4R', 'R-LOCATOR', 'R-COREIO', 'R-ENTITY-OUT', 'R-ADAPTER-RULE', 'R-MIRROR', 'R-MIRROR2'].includes(x.id))) {
      expect(r.text).toBe(fs.readFileSync(path.join(REPO, 'experiments', 'detect-02', 'rules', r.file), 'utf8'));
    }
    expect(path.relative(REPO, rulesDir())).toBe(path.join('src', 'v15-instrument', 'rules'));
  });

  it('keeps the frozen v1.4 instrument as the default; v1.5 only when chosen', () => {
    expect(INSTRUMENTS['v1.4'].default).toBe(true);
    expect(INSTRUMENTS['v1.4'].mcpEntry).toBe('src/mcp-server/main.ts');
    expect(selectedInstrument({})).toBe('v1.4');
    expect(selectedInstrument({ DAEDALUS_INSTRUMENT: 'v1.3' })).toBe('v1.4');
    expect(selectedInstrument({ DAEDALUS_INSTRUMENT: 'v1.5' })).toBe('v1.5');
  });
});

describe('v1.5 instrument: precision fixtures reproduce the recorded prototype rows', () => {
  const recorded = (JSON.parse(fs.readFileSync(path.join(REPO, 'experiments', 'detect-02', 'results', 'precision.json'), 'utf8')) as { rows: Row[] }).rows;
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'v15-prec-'));
  afterAll(() => fs.rmSync(scratch, { recursive: true, force: true }));
  const rules = loadRules();

  for (const d of fs.readdirSync(FX).sort()) {
    it(`${d}: every variant and root condition as recorded`, async () => {
      const meta = JSON.parse(fs.readFileSync(path.join(FX, d, 'fixture.json'), 'utf8')) as Meta;
      const specPath = path.join(FX, d, 'spec.yaml');
      const doc = YAML.parse(fs.readFileSync(specPath, 'utf8')) as { architecture: { ddd: Record<string, unknown> } };
      delete doc.architecture.ddd['aggregates'];
      const fallback = path.join(scratch, `${d}.fallback.yaml`);
      fs.writeFileSync(fallback, YAML.stringify(doc));
      for (const [variant, tree] of [['legit', meta.legit], ['positive', meta.positive]] as const) {
        if (tree === null) continue;
        for (const [condition, spec] of [['declared', specPath], ['fallback', fallback]] as const) {
          const r = await runTree(path.join(FX, d, tree), rules, { spec, scratch });
          // CN-02 rules (2026-10-27) came after the prototype record: the recorded rows are compared on the earlier rules,
          // and a legit variant must still have no violation from any rule (the `pass` check below uses every finding).
          const all = r.findings.filter((f) => f.status === 'violation');
          const vio = all.filter((f) => !['R-D4R', 'R-PURE'].includes(f.rule));
          const allowed = r.findings.filter((f) => f.status === 'allowed');
          const pass = variant === 'legit'
            ? all.length === 0 && (meta.expectLegit !== 'allowed' || allowed.length > 0)
            : (meta.expectPositive ?? []).every((id) => vio.some((f) => f.rule === id));
          const rec = recorded.find((x) => x.fixture === d && x.variant === variant && x.condition === condition);
          expect(rec).toBeDefined();
          expect({
            pass, rootSource: r.facts.rootSource, roots: r.facts.roots.map((x) => x.name),
            violations: vio.map((f) => ({ rule: f.rule, file: f.file, line: f.line, subject: f.subject, evidence: f.evidence })),
            allowed: allowed.map((f) => ({ rule: f.rule, file: f.file, line: f.line, subject: f.subject })),
            info: r.findings.filter((f) => f.status === 'info').length,
          }).toEqual({ pass: rec!.pass, rootSource: rec!.rootSource, roots: rec!.roots, violations: rec!.violations, allowed: rec!.allowed, info: rec!.info });
          expect(pass).toBe(true);
        }
      }
    }, 180_000);
  }
});

describe('v1.5 instrument: R-D5S declared invariants (C1, development fixture)', () => {
  const FXD = path.join(REPO, 'tests', 'fixtures', 'v15-d5s');
  const spec = path.join(FXD, 'spec.yaml');
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'v15-d5s-'));
  afterAll(() => fs.rmSync(scratch, { recursive: true, force: true }));
  const rules = loadRules();
  const d5s = async (variant: string) => (await runTree(path.join(FXD, variant), rules, { spec, scratch })).findings.filter((f) => f.rule === 'R-D5S');

  it('flags the overlap check made in the application service, outside the owner RoomSchedule', async () => {
    const f = await d5s('pos');
    expect(f).toHaveLength(1);
    expect(f[0]!.file).toBe('src/stays/application/BookRoom.ts');
    expect(f[0]!.evidence).toContain('room-no-overlap');
  });

  it('is silent when the owner enforces it, and never flags the declared uniqueness check', async () => {
    expect(await d5s('twin')).toEqual([]);
  });

  it('is silent when the spec declares no invariants', async () => {
    const doc = YAML.parse(fs.readFileSync(spec, 'utf8')) as { architecture: { ddd: Record<string, unknown> } };
    delete doc.architecture.ddd['invariants'];
    const bare = path.join(scratch, 'bare.yaml');
    fs.writeFileSync(bare, YAML.stringify(doc));
    const r = await runTree(path.join(FXD, 'pos'), rules, { spec: bare, scratch });
    expect(r.findings.filter((f) => f.rule === 'R-D5S')).toEqual([]);
  });

  it('reports an invalid invariant entry instead of using it', async () => {
    const doc = YAML.parse(fs.readFileSync(spec, 'utf8')) as { architecture: { ddd: { invariants: Record<string, unknown>[] } } };
    doc.architecture.ddd.invariants.push({ id: 'bad', kind: 'set', owner: 'Nobody', terms: ['x'] });
    const bad = path.join(scratch, 'bad.yaml');
    fs.writeFileSync(bad, YAML.stringify(doc));
    const r = await runTree(path.join(FXD, 'pos'), rules, { spec: bad, scratch });
    expect(r.spec.specErrors).toEqual(['ddd.invariants[2] (bad): owner must name a declared aggregate']);
  });
});
