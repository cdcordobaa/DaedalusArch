/** Ontology v0 grounding validator: planted hallucinations are rejected, grounded citations pass. */
import { buildContext } from '../../../../src/apg-enrich/cheap/context.js';
import { DEFAULT_CHEAP_OPTIONS } from '../../../../src/apg-enrich/cheap/types.js';
import { GroundingIndex, buildUnits, collapseWhitespace, diskReader, locateQuote } from '../../../../src/apg-enrich/ontology/index.js';
import type { Citation, OntologyInput } from '../../../../src/apg-enrich/ontology/index.js';
import { fixtureInput, nodeId } from './helpers.js';

const FILE = 'src/notifications/application/order-notification.service.ts';

describe('ontology grounding validator', () => {
  let input: OntologyInput;
  let index: GroundingIndex;
  let cls: string;
  let method: string;
  let ok: Citation;

  beforeAll(async () => {
    input = await fixtureInput('case-02-misplaced-pricing');
    const ctx = buildContext({ apg: input.apg, project: input.project, projectRoot: input.projectRoot, ...(input.layerModel !== undefined ? { layerModel: input.layerModel } : {}) }, DEFAULT_CHEAP_OPTIONS);
    const units = buildUnits(ctx, input.cheap, { ruleMinDensity: 1 });
    index = new GroundingIndex(input.apg, units.nodeSpans, diskReader(input.projectRoot));
    cls = nodeId(input, 'Class', 'OrderNotificationService');
    method = nodeId(input, 'Method', 'OrderNotificationService.sendConfirmation');
    ok = { nodeId: method, file: FILE, startLine: 9, endLine: 9, quote: 'const discount = order.lines.length > 3 ? subtotal * 0.1 : 0;' };
  }, 60_000);

  it('accepts a citation whose node, file, span and quote all match', () => {
    const g = index.ground([ok], { types: ['Class', 'Method'], within: new Set([cls, method]) });
    expect(g.ok).toBe(true);
    if (g.ok) expect(g.evidence[0]).toMatchObject({ ...ok, grounded: true });
  });

  it('compares quotes with whitespace collapsed', () => {
    expect(index.checkCitation({ ...ok, quote: '  const   discount =\n order.lines.length > 3 ' }, 0)).toBeNull();
    expect(collapseWhitespace(' a \n\t b ')).toBe('a b');
  });

  it.each([
    ['unknown-node', (c: Citation): Citation => ({ ...c, nodeId: 'deadbeefdeadbeef' })],
    ['unknown-file', (c: Citation): Citation => ({ ...c, file: 'src/notifications/application/missing.ts' })],
    ['node-file-mismatch', (c: Citation): Citation => ({ ...c, file: 'src/ordering/domain/order.ts' })],
    ['span-out-of-range', (c: Citation): Citation => ({ ...c, startLine: 9, endLine: 400 })],
    ['span-out-of-range', (c: Citation): Citation => ({ ...c, startLine: 0, endLine: 3 })],
    ['span-outside-node', (c: Citation): Citation => ({ ...c, startLine: 1, endLine: 1, quote: 'import' })],
    ['empty-quote', (c: Citation): Citation => ({ ...c, quote: '   ' })],
    ['quote-mismatch', (c: Citation): Citation => ({ ...c, quote: 'const discount = order.lines.length > 5' })],
    ['quote-mismatch', (c: Citation): Citation => ({ ...c, startLine: 10, endLine: 10 })],
  ])('rejects a planted hallucination: %s', (reason, mutate) => {
    const g = index.ground([mutate(ok)]);
    expect(g.ok).toBe(false);
    if (!g.ok) expect(g.reasons.map((r) => r.reason)).toContain(reason);
  });

  it('rejects an assertion without evidence, a node outside the item and a wrong node type', () => {
    const none = index.ground([]);
    expect(!none.ok && none.reasons[0]?.reason).toBe('no-evidence');
    const outside = index.ground([ok], { within: new Set([cls]) });
    expect(!outside.ok && outside.reasons[0]?.reason).toBe('node-outside-item');
    const type = index.ground([ok], { types: ['Class'] });
    expect(!type.ok && type.reasons[0]?.reason).toBe('wrong-node-type');
  });

  it('checks non-citation references (enforcedBy, realizedBy) and rejects the whole assertion on one failure', () => {
    const bad = index.ground([ok], {}, [{ id: 'nope', rule: { types: ['Method'] } }]);
    expect(!bad.ok && bad.reasons.map((r) => r.reason)).toEqual(['unknown-node']);
    const wrongType = index.ground([ok], {}, [{ id: cls, rule: { types: ['Method'] } }]);
    expect(!wrongType.ok && wrongType.reasons[0]?.reason).toBe('wrong-node-type');
    const mixed = index.ground([ok, { ...ok, quote: 'fabricated()' }]);
    expect(mixed.ok).toBe(false);
    expect(index.ground([ok], {}, [{ id: method, rule: { types: ['Method'], within: new Set([method]) } }]).ok).toBe(true);
  });

  it('locates a quote on its shortest line window (scripted mock helper)', () => {
    const text = 'a\nb\nfoo(\n  bar)\nc';
    expect(locateQuote(text, 'b')).toEqual({ startLine: 2, endLine: 2 });
    expect(locateQuote(text, 'foo( bar)')).toEqual({ startLine: 3, endLine: 4 });
    expect(locateQuote(text, 'zzz')).toBeNull();
  });
});
