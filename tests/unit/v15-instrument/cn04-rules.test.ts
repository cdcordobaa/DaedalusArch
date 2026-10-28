/**
 * CN-04 (2026-10-28, development fixture; design `ops/notes/cn-04-hex-catalog.md`): R-ADAPTER-RULE (H06), R-LOCATOR
 * through one helper call (H08) and R-MIRROR (H11) on a small tool-library Hexagonal tree. Each case is the base with
 * the case folder overlaid. Zero model calls, no Neo4j.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { loadRules, runTree } from '../../../src/v15-instrument/index.js';

const FX = path.resolve(__dirname, '..', '..', 'fixtures', 'v15-cn04');
const NEW_RULES = ['R-ADAPTER-RULE', 'R-LOCATOR', 'R-MIRROR'];

/** case → [rule, file, evidence fragment] expected; `null` = no finding of the CN-04 rules and no violation at all. */
const CASES: Record<string, [string, string, string] | null> = {
  'adapter-rule-pos1': ['R-ADAPTER-RULE', 'src/adapters/out/persistence/in-memory-tool.repository.ts', "raises new ToolError('a broken tool"],
  'adapter-rule-pos2': ['R-ADAPTER-RULE', 'src/adapters/out/coinvault/coinvault-deposit.gateway.ts', 'computes tool.depositCents * 2'],
  'adapter-rule-pos3': ['R-ADAPTER-RULE', 'src/adapters/in/http/tool.controller.ts', 'changes state: tool.markBroken()'],
  'adapter-rule-clean1': null,
  'adapter-rule-clean2': null,
  'locator-pos1': ['R-LOCATOR', 'src/adapters/in/http/tool.controller.ts', 'resolve(…), which runs registry.get(token)'],
  'locator-clean1': null,
  'mirror-pos1': ['R-MIRROR', 'src/domain/hold-refusal.ts', "HoldRefusal mirrors CoinvaultHold of coinvault-sdk: values 'limit_exceeded', 'card_blocked'"],
  'mirror-pos2': ['R-MIRROR', 'src/application/ports/out/hold-receipt.ts', "HoldReceipt mirrors CoinvaultHold of coinvault-sdk: fields 'holdId', 'amountCents', 'currency'"],
  'mirror-clean1': null,
  // CN-04 decision: one generic catch-all next to at least 2 vendor values is still the vendor's set
  'mirror-pos3': ['R-MIRROR', 'src/domain/hold-refusal.ts', "values 'limit_exceeded', 'card_blocked' (plus the catch-all 'Other')"],
  'mirror-clean2': null,
  'mirror-clean3': null,
};

describe('v1.5 instrument: CN-04 rules on the tool-library fixture', () => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'v15-cn04-'));
  afterAll(() => fs.rmSync(scratch, { recursive: true, force: true }));
  const rules = loadRules();
  const spec = path.join(FX, 'spec.yaml');
  const run = async (c: string | null) => {
    const tree = path.join(scratch, c ?? 'base');
    fs.cpSync(path.join(FX, 'base'), tree, { recursive: true });
    if (c !== null) fs.cpSync(path.join(FX, 'cases', c), tree, { recursive: true });
    return (await runTree(tree, rules, { spec, scratch: path.join(scratch, '_s') })).findings.filter((f) => f.status === 'violation');
  };

  it('the base is clean under every rule', async () => {
    expect(await run(null)).toEqual([]);
  }, 180_000);

  for (const [c, want] of Object.entries(CASES)) {
    it(`${c}: ${want === null ? 'silent' : `${want[0]} in ${want[1]}`}`, async () => {
      const v = await run(c);
      if (want === null) { expect(v).toEqual([]); return; }
      const [rule, file, frag] = want;
      // only the case's own rule fires, in the labelled file
      expect(v.filter((f) => NEW_RULES.includes(f.rule) && f.rule !== rule)).toEqual([]);
      const hit = v.filter((f) => f.rule === rule && f.file === file);
      expect(hit.length).toBeGreaterThan(0);
      expect(hit.map((f) => f.evidence).join('\n')).toContain(frag);
    }, 180_000);
  }

  it('R-LOCATOR keeps the lookup inside the helper, and adds the caller as via-helper', async () => {
    const tree = path.join(scratch, 'loc-facts');
    fs.cpSync(path.join(FX, 'base'), tree, { recursive: true });
    fs.cpSync(path.join(FX, 'cases', 'locator-pos1'), tree, { recursive: true });
    const r = await runTree(tree, rules, { spec, scratch: path.join(scratch, '_s') });
    expect(r.facts.locators.map((x) => [x.file, x.form])).toEqual([
      ['src/application/service-registry.ts', 'container-call'],
      ['src/adapters/in/http/tool.controller.ts', 'via-helper'],
    ]);
  }, 180_000);
});
