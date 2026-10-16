/**
 * Diff-aware gate: renderings, tiers of pipeline rows, fix hints, rename parsing (src/ci-gate).
 */
import { COMMENT_MARKER, formatGateHuman, formatGateJSON, formatGateMarkdown } from '../../../src/ci-gate/format.js';
import { findingsFromReport, relativeToProject, tierOf, withConcreteFixes } from '../../../src/ci-gate/engines.js';
import { parseRenames, resolveCommit } from '../../../src/ci-gate/git-tree.js';
import type { GateFinding, GateResult } from '../../../src/ci-gate/types.js';
import type { Violation } from '../../../src/shared/taxonomy/violation-types.js';
import type { EvaluationReport } from '../../../src/shared/types/evaluation.js';
import type { ParsedSpec } from '../../../src/shared/types/spec.js';
import type { FunctionId } from '../../../src/shared/types/value-objects.js';

const newRow: GateFinding = {
  ruleId: 'FF-S01', ruleName: 'dependency-direction', tier: 'blocking', file: 'src/domain/a.ts', target: 'src/infra/b.ts',
  line: 3, message: 'domain imports infra | badly', fix: 'Invert the `dependency`.',
};
const fixedRow: GateFinding = { ruleId: 'FF-P03', ruleName: 'repository-pattern', tier: 'blocking', file: 'src/infra/r.ts', message: 'no port' };
const advisory: GateFinding = { ruleId: 'FF-CV05', ruleName: 'test-file-pairing', tier: 'advisory', file: 'src/x.ts', message: 'no test' };

const result: GateResult = {
  engine: 'lexical', spec: 'spec.yaml', project: 'app',
  base: { ref: 'main', sha: 'a'.repeat(40), findings: 2 },
  head: { ref: 'pr', sha: 'b'.repeat(40), findings: 2 },
  renames: {},
  new: [newRow], fixed: [fixedRow], unchanged: [{ base: advisory, head: advisory }],
  verdict: 'fail', newBlocking: 1,
};

describe('formatGateMarkdown', () => {
  const md = formatGateMarkdown(result);

  it('starts with the marker the action updates its comment by', () => {
    expect(md.startsWith(`${COMMENT_MARKER}\n`)).toBe(true);
  });

  it('states the verdict and the counts', () => {
    expect(md).toContain('Architecture gate: fail');
    expect(md).toContain('**1 new blocking**');
    expect(md).toContain('| New in head | 1 (1 blocking) |');
    expect(md).toContain('| Fixed | 1 (1 blocking) |');
    expect(md).toContain('| Unchanged | 1 |');
  });

  it('lists new rows with their fix hint and keeps table cells on one line', () => {
    expect(md).toContain('#### New findings');
    expect(md).toContain('`src/domain/a.ts:3 -> src/infra/b.ts`');
    expect(md).toContain('domain imports infra \\| badly');
    expect(md).toContain("Invert the 'dependency'.");
  });

  it('groups unchanged rows by rule in a collapsed block', () => {
    expect(md).toContain('<details>');
    expect(md).toContain('| FF-CV05 test-file-pairing (advisory) | 1 |');
  });

  it('says pass when nothing new is blocking', () => {
    const pass = formatGateMarkdown({ ...result, new: [advisory], verdict: 'pass', newBlocking: 0 });
    expect(pass).toContain('Architecture gate: pass');
    expect(pass).toContain('introduces no new blocking');
  });
});

describe('formatGateHuman / formatGateJSON', () => {
  it('prints the verdict, the new rows with their fix and the fixed rows', () => {
    const text = formatGateHuman(result);
    expect(text).toContain('Architecture gate: FAIL (1 new blocking finding(s))');
    expect(text).toContain('[blocking] FF-S01 dependency-direction  src/domain/a.ts:3 -> src/infra/b.ts');
    expect(text).toContain('Fix: Invert the `dependency`.');
    expect(text).toContain('Fixed:');
  });

  it('round-trips through JSON', () => {
    expect(JSON.parse(formatGateJSON(result))).toEqual(result);
  });
});

function violation(id: string, extra: Partial<Violation> = {}): Violation {
  return {
    id: `v-${id}`, type: 'LAYER_VIOLATION', dimension: 'structural', severity: 'critical', functionId: id as FunctionId,
    route: 'symbolic', filePath: '/tmp/p/src/a.ts', message: 'm', deterministic: true, ...extra,
  } as Violation;
}

describe('tiers and paths of pipeline rows', () => {
  it('takes the v1.3 tier of the rule, by style', () => {
    expect(tierOf(violation('FF-S01'), 'clean-architecture')).toBe('blocking');
    expect(tierOf(violation('FF-CV05'), 'clean-architecture')).toBe('advisory');
    expect(tierOf(violation('FF-UNKNOWN'), 'clean-architecture')).toBe('advisory');
  });

  it('marks FF-P06 FLOWS_TO rows not-applicable and keeps CONSTRUCTOR_INJECTS rows blocking', () => {
    expect(tierOf(violation('FF-P06', { discriminator: ['C', 'T', 'FLOWS_TO', 'f'] }), 'clean-architecture')).toBe('not-applicable');
    expect(tierOf(violation('FF-P06', { discriminator: ['C', 'T', 'CONSTRUCTOR_INJECTS', 'f'] }), 'clean-architecture')).toBe('blocking');
  });

  it('makes paths project-relative, part by part for cycle paths', () => {
    expect(relativeToProject('/tmp/p/src/a.ts,/tmp/p/src/b.ts', '/tmp/p')).toBe('src/a.ts,src/b.ts');
    expect(relativeToProject('./src/a.ts', '/tmp/p')).toBe('src/a.ts');
  });

  it('builds findings with names, relative paths, lines and catalogue fix hints', () => {
    const spec = { style: 'clean-architecture', fitnessFunctions: [{ id: 'FF-S01', name: 'dependency-direction' }] } as unknown as ParsedSpec;
    const report = { violations: [violation('FF-S01', { target: '/tmp/p/src/b.ts', line: 7 })] } as unknown as EvaluationReport;
    const [row] = findingsFromReport(report, spec, '/tmp/p');
    expect(row).toMatchObject({ ruleId: 'FF-S01', ruleName: 'dependency-direction', tier: 'blocking', file: 'src/a.ts', target: 'src/b.ts', line: 7 });
    expect(row?.fix).toEqual(expect.any(String));
  });

  it('prefers the concrete check_file fix of a row with the same key', () => {
    const generic: GateFinding = { ...newRow, fix: 'generic' };
    const lexical: GateFinding = { ...newRow, line: 99, fix: 'concrete' };
    const other: GateFinding = { ...fixedRow, fix: 'kept' };
    expect(withConcreteFixes([generic, other], [lexical]).map((x) => x.fix)).toEqual(['concrete', 'kept']);
  });
});

describe('git plumbing', () => {
  it('parses renames inside the project and drops the rest', () => {
    const z = ['R100', 'app/src/a.ts', 'app/src/b.ts', 'M', 'app/src/c.ts', 'R090', 'other/x.ts', 'app/src/x.ts', 'C100', 'app/src/d.ts', 'app/src/e.ts', ''].join('\0');
    expect(parseRenames(z, 'app')).toEqual({ 'src/a.ts': 'src/b.ts' });
    expect(parseRenames(z, '.')).toEqual({ 'app/src/a.ts': 'app/src/b.ts', 'other/x.ts': 'app/src/x.ts' });
  });

  it('refuses a ref that would read as an option', () => {
    expect(() => resolveCommit('.', '--output=/tmp/x')).toThrow('invalid ref');
  });
});
