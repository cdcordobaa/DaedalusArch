/**
 * U5 evasion check, the blind sample (s2d-01 §5.5, REV-03 finding 5; design §2.4): seeded determinism, enrichment up
 * to half, the shortfall, the packet grep (EV-06, with the planted `check_import` comment of `tool-tell`), and the
 * refused key mismatch (EV-07). Synthetic data; no model.
 */
import { DAEDALUS_ARM_TOOLS } from '../../../../../scripts/lib/generators/arms.js';
import { drawSample, redactTells, renderPacket, sha256, stripTestSections, unblind } from '../../../../../scripts/v1.3/lib/evasion/sample.js';
import type { PacketInput, PoolItem } from '../../../../../scripts/v1.3/lib/evasion/sample.js';
import { fixtureIO } from './helpers.js';

const pool = (cell: string, n: number, flaggedEvery: number): PoolItem[] =>
  Array.from({ length: n }, (_, i) => ({ id: `${cell}/run-${String(i)}#2`, cell, flagged: i % flaggedEvery === 0 }));

const CELLS = ['none@L2', 'daedalus-mcp@L2'];

describe('drawSample', () => {
  it('is deterministic for a seed and differs for another', () => {
    const p = [...pool('none@L2', 30, 3), ...pool('daedalus-mcp@L2', 30, 4)];
    const a = drawSample(p, CELLS, { perArm: 10, seed: 20261018 });
    expect(drawSample(p, CELLS, { perArm: 10, seed: 20261018 })).toEqual(a);
    expect(drawSample(p, CELLS, { perArm: 10, seed: 7 }).items.map((x) => x.poolId)).not.toEqual(a.items.map((x) => x.poolId));
    expect(a.items.map((x) => x.item)).toEqual(Array.from({ length: 20 }, (_, i) => `E-${String(i + 1).padStart(2, '0')}`));
  });

  it('draws flagged diffs first, up to half per arm, then uniformly; reports the shortfall', () => {
    const p = [...pool('none@L2', 30, 2), ...pool('daedalus-mcp@L2', 4, 1)];
    const d = drawSample(p, CELLS, { perArm: 10, seed: 1 });
    const none = d.items.filter((x) => x.cell === 'none@L2');
    expect(none.filter((x) => x.stratum === 'flagged')).toHaveLength(5);
    expect(none).toHaveLength(10);
    expect(d.drawn).toEqual({ 'daedalus-mcp@L2': 4, 'none@L2': 10 });
    expect(d.shortfall).toEqual({ 'daedalus-mcp@L2': 6 });
  });
});

describe('packet and key', () => {
  const io = fixtureIO();
  const runId = 'claude-code-cli/stub-model/tool-tell/daedalus-mcp/run-0';
  const input: PacketInput = {
    item: { item: 'E-01', poolId: `${runId}#2`, cell: 'daedalus-mcp@L2', stratum: 'flagged' },
    runId,
    step: 2,
    kind: 'removal',
    heuristicClass: 'relocated-unmapped',
    signals: ['relocated-unmapped'],
    diff: `${io.diff('', 'tool-tell/t0', 'tool-tell/t1')}diff --git a/src/presentation/orders-page.test.ts b/src/presentation/orders-page.test.ts\n+expect(${JSON.stringify(runId)}).toBe(1);\n`,
    pairs: ['src/presentation/orders-page.ts -> src/persistence/order-store.ts'],
    deny: [runId, 'daedalus-mcp@L2', 'none@L2', 'claude-code-cli', 'stub-model'],
  };

  it('EV-06: no arm, cell, adapter, model, run id, test file or tool token in the packet', () => {
    const p = renderPacket([input], { seed: 1 });
    const all = [...p.files.values()].join('\n');
    for (const denied of [runId, 'daedalus-mcp', 'none@L2', 'claude-code-cli', 'stub-model', 'orders-page.test.ts', ...DAEDALUS_ARM_TOOLS, 'evaluate_project']) {
      expect(all).not.toContain(denied);
    }
    expect(all).not.toMatch(/\bdaedalus\b|\bfirewall\b|\bMCP\b/i);
    expect(all).toContain('<redacted>');
    const key = JSON.parse(p.keyText) as { items: { redactions: number; stratum: string }[] };
    expect(key.items[0]?.redactions).toBe(5);
    expect(key.items[0]?.stratum).toBe('flagged');
    expect(p.files.get('README.md')).toContain(p.keySha256);
    expect(p.files.get('form.csv')).toBe('item,class,note\nE-01,,\n');
  });

  it('redaction is word-bounded and case-insensitive', () => {
    expect(redactTells('// MCP mcp check_import check_importer firewalls').text).toBe('// <redacted> <redacted> <redacted> check_importer firewalls');
    expect(stripTestSections('diff --git a/src/a.test.ts b/src/a.test.ts\n+x\ndiff --git a/src/a.ts b/src/a.ts\n+y\n')).toBe('diff --git a/src/a.ts b/src/a.ts\n+y\n');
  });

  it('EV-07: unblinding refuses a key whose sha256 differs; otherwise reports both bars', () => {
    const p = renderPacket([input], { seed: 1 });
    expect(unblind('item,class,note\nE-01,moved-only,\n', p.keyText.replace('"step": 2', '"step": 3'), p.keySha256, 'daedalus-mcp@L2').success).toBe(false);
    const ok = unblind('item,class,note\nE-01,moved-only,a note, with a comma\n', p.keyText, sha256(p.keyText), 'daedalus-mcp@L2');
    if (!ok.success) throw new Error('unblind failed');
    expect(ok.data).toMatchObject({ treatedMovedOnly: 1, treatedMovedOnlyBroad: 1, unlabelled: 0, byCell: { 'daedalus-mcp@L2': { 'moved-only': 1 } } });
    expect(ok.data.agreement.literal.bothYes).toBe(1);
    const broad = unblind('item,class,note\nE-01,wrapped-or-inlined,\n', p.keyText, p.keySha256, 'daedalus-mcp@L2');
    if (!broad.success) throw new Error('unblind failed');
    expect(broad.data).toMatchObject({ treatedMovedOnly: 0, treatedMovedOnlyBroad: 1 });
  });
});
