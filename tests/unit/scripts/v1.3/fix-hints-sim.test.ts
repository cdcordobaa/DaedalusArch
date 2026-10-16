/**
 * The mechanical hint check (scripts/v1.3/lib/fix-hints-sim.ts): the independent spec check accepts the builder's hints
 * and rejects wrong ones; every edit op becomes a Cypher write.
 */
import * as path from 'node:path';
import { checkTarget, editToCypher, specAllows, specLayerOf, wrongLayerMutant } from '../../../../scripts/v1.3/lib/fix-hints-sim.js';
import { buildFixHint } from '../../../../src/fix-hints/index.js';
import type { FixHint } from '../../../../src/fix-hints/index.js';
import type { ParsedSpec } from '../../../../src/shared/types/spec.js';
import { REPO, loadSpec } from '../../mcp-server/helpers.js';

const REF = path.join(REPO, 'tests/fixtures/v1.3-reference');
let clean: ParsedSpec;
let layered: ParsedSpec;
let hex: ParsedSpec;
let ddd: ParsedSpec;

beforeAll(async () => {
  clean = await loadSpec(path.join(REF, 'clean-architecture/spec.yaml'));
  layered = await loadSpec(path.join(REF, 'layered/spec.yaml'));
  hex = await loadSpec(path.join(REF, 'hexagonal/spec.yaml'));
  ddd = await loadSpec(path.join(REPO, 'presets/ddd.yaml'));
});

describe('specAllows (read straight from the spec)', () => {
  it('follows the layer order, FF-S04 and closed layering', () => {
    expect(specAllows(clean, 'infrastructure', 'domain')).toBe(true);
    expect(specAllows(clean, 'domain', 'application')).toBe(false);
    expect(specAllows(layered, 'presentation', 'business')).toBe(true);
    expect(specAllows(layered, 'presentation', 'persistence')).toBe(false);
    expect(specAllows(layered, 'persistence', 'business')).toBe(false);
  });

  it('follows allowed_dependencies', () => {
    expect(specAllows(hex, 'application', 'domain')).toBe(true);
    expect(specAllows(hex, 'domain', 'application')).toBe(false);
    expect(specAllows(hex, 'adapters-inbound', 'adapters-outbound')).toBe(false);
  });

  it('resolves layers like the annotator', () => {
    expect(specLayerOf(ddd, 'src/ordering/domain/order/Order.ts')).toBe('domain');
    expect(specLayerOf(ddd, 'src/ordering/index.ts')).toBeNull();
  });
});

describe('checkTarget', () => {
  const port = (): FixHint => {
    const h = buildFixHint(clean, { ruleId: 'FF-S01', filePath: 'src/domain/services/LoanPolicy.ts', target: 'src/infrastructure/system/SystemClock.ts' });
    if (h === undefined) throw new Error('no hint');
    return h;
  };

  it('accepts the builder hint', () => {
    expect(checkTarget(clean, port())).toEqual({ ok: true, reasons: [] });
  });

  it('rejects a port placed in the outer layer (the source may not import it)', () => {
    const h = port();
    const outer = 'src/infrastructure/system/Clock.ts';
    const bad: FixHint = {
      ...h,
      target: { layer: 'infrastructure', folder: 'src/infrastructure/system/', path: outer },
      edit: h.edit.map((op) => (op.op === 'add-file' ? { ...op, path: outer, layer: 'infrastructure' } : op.op === 'add-import' && op.to.endsWith('Clock.ts') ? { ...op, to: outer } : op)),
    };
    const r = checkTarget(clean, bad);
    expect(r.ok).toBe(false);
    expect(r.reasons).toContain('added edge src/domain/services/LoanPolicy.ts (domain) -> src/infrastructure/system/Clock.ts (infrastructure) is not allowed');
  });

  it('rejects a path outside its claimed layer and a forbidden package import', () => {
    const h = port();
    expect(checkTarget(clean, { ...h, target: { ...h.target, layer: 'application' } }).reasons[0]).toBe('target src/domain/services/Clock.ts is in domain, not application');
    const pkg = buildFixHint(clean, { ruleId: 'FF-P01', filePath: 'src/domain/entities/Book.ts', target: 'typeorm' });
    if (pkg === undefined) throw new Error('no hint');
    const bad: FixHint = { ...pkg, edit: [...pkg.edit, { op: 'add-import', from: 'src/domain/entities/Book.ts', to: 'typeorm', package: true }] };
    expect(checkTarget(clean, bad).reasons).toEqual(['added import of typeorm from domain is forbidden']);
  });

  it('checks the DDD public API target', () => {
    const h = buildFixHint(ddd, { ruleId: 'FF-DS02', filePath: 'src/billing/application/IssueInvoice.ts', target: 'src/ordering/domain/order/Order.ts' });
    if (h === undefined) throw new Error('no hint');
    expect(checkTarget(ddd, h).ok).toBe(true);
    expect(checkTarget(ddd, { ...h, target: { ...h.target, path: 'src/ordering/internal.ts' } }).ok).toBe(false);
  });
});

describe('wrongLayerMutant (control 2)', () => {
  it('puts the new port next to the violating target, and the spec check rejects it', () => {
    const h = buildFixHint(clean, { ruleId: 'FF-S01', filePath: 'src/domain/services/LoanPolicy.ts', target: 'src/infrastructure/system/SystemClock.ts' });
    if (h === undefined) throw new Error('no hint');
    const m = wrongLayerMutant(clean, h, 'src/infrastructure/system/SystemClock.ts');
    expect(m?.target).toEqual({ layer: 'infrastructure', folder: 'src/infrastructure/system/', path: 'src/infrastructure/system/Clock.ts' });
    expect(m?.edit).toContainEqual({ op: 'add-import', from: 'src/domain/services/LoanPolicy.ts', to: 'src/infrastructure/system/Clock.ts', typeOnly: true });
    expect(checkTarget(clean, m as FixHint).ok).toBe(false);
  });

  it('does not apply to hints without a new or moved file, or to package targets', () => {
    const own = buildFixHint(clean, { ruleId: 'FF-P01', filePath: 'src/domain/entities/Member.ts', target: 'express', isTypeOnly: true });
    expect(wrongLayerMutant(clean, own as FixHint, 'express')).toBeUndefined();
  });
});

describe('editToCypher', () => {
  it('writes one statement per op (two for a file that declares a type), never touching templates', () => {
    const writes = editToCypher(clean, [
      { op: 'remove-import', from: 'a.ts', to: 'b.ts' },
      { op: 'remove-import', from: 'a.ts', to: 'typeorm', package: true },
      { op: 'add-file', path: 'src/domain/P.ts', layer: 'domain', declares: { kind: 'Interface', name: 'P' } },
      { op: 'add-import', from: 'a.ts', to: 'src/domain/P.ts', typeOnly: true },
      { op: 'add-import', from: 'x/index.ts', to: 'b.ts', reExport: true },
      { op: 'move-file', from: 'b.ts', to: 'src/domain/b.ts', layer: 'domain' },
      { op: 'remove-file', path: 'c.ts' },
      { op: 'add-implements', classFile: 'b.ts', className: 'B', interfaceFile: 'src/domain/P.ts', interfaceName: 'P' },
      { op: 'redirect-holding', classFile: 'a.ts', className: 'A', fromFile: 'b.ts', interfaceFile: 'src/domain/P.ts', interfaceName: 'P' },
      { op: 'make-immutable', classFile: 'v.ts', className: 'V' },
    ]);
    expect(writes).toHaveLength(11);
    expect(writes[1]?.cypher).toContain('b:Package {name: $to}');
    expect(writes[4]?.params.props).toMatchObject({ isTypeOnly: true });
    expect(writes[5]?.cypher).toContain('CREATE (a)-[r:RE_EXPORTS]->(b)');
    expect(writes[6]?.params).toEqual({ from: 'b.ts', to: 'src/domain/b.ts', layer: 'domain', name: 'b.ts' });
    expect(writes[9]?.cypher).toContain('apoc.create.relationship');
    expect(writes[10]?.cypher).toContain('c.setAccessors = []');
  });
});
