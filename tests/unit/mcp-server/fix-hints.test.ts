/**
 * Fix hints in the MCP tools (Docs/v1.3/fix-hints.md): check_file, check_diff and explain_violation attach them only when
 * asked, and only to blocking rules; without hints the results are unchanged.
 */
import { checkSource } from '../../../src/mcp-server/file-check.js';
import { checkDiff } from '../../../src/mcp-server/diff-check.js';
import { explainViolation } from '../../../src/mcp-server/rule-explainer.js';
import { parseArgs, buildContext } from '../../../src/mcp-server/context.js';
import { CLEAN_ARCH_SPEC, LAYERED_SPEC, loadSpec } from './helpers.js';
import type { ParsedSpec } from '../../../src/shared/types/spec.js';

let clean: ParsedSpec;
let layered: ParsedSpec;

beforeAll(async () => {
  clean = await loadSpec(CLEAN_ARCH_SPEC);
  layered = await loadSpec(LAYERED_SPEC);
});

const source = [
  "import { SystemClock } from '../../infrastructure/system/SystemClock';",
  "import type { Request } from 'express';",
  'export class LoanPolicy {}',
].join('\n');

describe('check_file hints', () => {
  it('adds no hint field unless asked', () => {
    const plain = checkSource(clean, { path: 'src/domain/services/LoanPolicy.ts', content: source });
    expect(plain.violations.length).toBeGreaterThan(0);
    expect(plain.violations.every((v) => !('hint' in v))).toBe(true);
    expect(checkSource(clean, { path: 'src/domain/services/LoanPolicy.ts', content: source, hints: false })).toEqual(plain);
  });

  it('attaches a spec-only hint to every blocking violation', () => {
    const r = checkSource(clean, { path: 'src/domain/services/LoanPolicy.ts', content: source, hints: true });
    const s01 = r.violations.find((v) => v.rule === 'FF-S01');
    expect(s01?.hint).toMatchObject({
      ruleId: 'FF-S01', family: 'dependency-direction', basis: 'spec',
      target: { layer: 'domain', path: 'src/domain/services/Clock.ts' }, fix: { action: 'introduce-port' },
    });
    const p01 = r.violations.find((v) => v.rule === 'FF-P01');
    expect(p01?.hint).toMatchObject({ family: 'forbidden-package', fix: { action: 'replace-with-own-type' } });
    // The hint is additive: every other field is what the plain check returns.
    const plain = checkSource(clean, { path: 'src/domain/services/LoanPolicy.ts', content: source });
    expect(r.violations.map(({ hint: _h, ...rest }) => rest)).toEqual(plain.violations);
  });

  it('leaves advisory rules without a hint (FF-S03 outside layered is advisory; naming rules are advisory)', () => {
    const r = checkSource(layered, { path: 'src/presentation/http/CatalogController.ts', content: "import { ProductGateway } from '../../persistence/ProductGateway';\n", hints: true });
    for (const v of r.violations) {
      if (v.rule === 'FF-S03' || v.rule === 'FF-S01') expect(v.hint).toBeDefined();
      else expect(v.hint).toBeUndefined();
    }
  });
});

describe('check_diff hints', () => {
  const diff = [
    'diff --git a/src/domain/services/LoanPolicy.ts b/src/domain/services/LoanPolicy.ts',
    'new file mode 100644',
    '--- /dev/null',
    '+++ b/src/domain/services/LoanPolicy.ts',
    '@@ -0,0 +1,3 @@',
    ...source.split('\n').map((l) => `+${l}`),
    '',
  ].join('\n');

  it('passes the option through to every file', () => {
    expect(checkDiff(clean, diff).files[0]?.violations.every((v) => v.hint === undefined)).toBe(true);
    expect(checkDiff(clean, diff, { hints: true }).files[0]?.violations.some((v) => v.hint?.family === 'dependency-direction')).toBe(true);
  });
});

describe('explain_violation hints', () => {
  it('names the family, the tier and the template with hints on only', () => {
    expect(explainViolation('FF-S01', clean)).not.toHaveProperty('fixHint');
    expect(explainViolation('FF-S01', clean, { hints: true })?.fixHint).toMatchObject({ family: 'dependency-direction', blocking: true });
    expect(explainViolation('FF-P02', clean, { hints: true })).not.toHaveProperty('fixHint');
  });
});

describe('--hints server flag', () => {
  it('parses --hints and DAEDALUS_HINTS=1 into the context default', () => {
    expect(parseArgs(['--hints', '--spec', 's.yaml'])).toEqual({ hints: true, spec: 's.yaml' });
    expect(buildContext({ hints: true }, {}).hints).toBe(true);
    expect(buildContext({}, { DAEDALUS_HINTS: '1' }).hints).toBe(true);
    expect(buildContext({}, {})).not.toHaveProperty('hints');
  });
});
