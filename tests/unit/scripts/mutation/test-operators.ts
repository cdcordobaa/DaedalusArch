/**
 * Test-only operators (never in the catalogue): MO-TEST-edge (import plus value reference), MO-TEST-break
 * (F-U5A-REJECT), MO-TEST-throw (BR-U5a-34), MO-TEST-lines (BR-U5a-18), and a test registry factory.
 */
import { DomainResult } from '../../../../src/shared/errors/domain-result.js';
import {
  appendValueRef,
  editOf,
  exportedValueNames,
  fileAt,
  hasEdge,
  insertImport,
  projectFiles,
  relOf,
  specifierTo,
  specView,
} from '../../../../scripts/lib/mutation/operators/common.js';
import { OperatorRegistry } from '../../../../scripts/lib/mutation/registry.js';
import type { MutationOperator, MutationSite, PreconditionReason } from '../../../../scripts/lib/mutation/types.js';

export const TEST_CATALOGUE_VERSION = 'c'.repeat(64);

type Pair = (source: string, target: string) => boolean;

const base = {
  role: 'positive' as const,
  core: false,
  dimension: 'structural' as const,
  operatorCollateral: [],
  coveredByTemplates: [],
  coverage: 'in' as const,
  source: 'test',
};

/** Import `symbol` of `targetFile` into the site file and export a value reference to it. */
export function edgeOperator(
  id: string,
  pair: Pair,
  options: { readonly needsDomain?: boolean; readonly templates?: readonly string[]; readonly breakOnCall?: number; readonly judgeProbe?: 'semantic' | 'integrity' } = {},
): MutationOperator {
  let calls = 0;
  return {
    ...base,
    id,
    ...(options.judgeProbe !== undefined ? { judgeProbe: options.judgeProbe, coverage: 'outside' as const, dimension: 'semantic' as const } : {}),
    expectedTemplates: (options.templates ?? []).map((template) => ({
      template,
      filePath: 'site' as const,
      target: 'site-target' as const,
      discriminator: ['relType' as const],
      line: 'site-line' as const,
    })),
    findSites(handle, spec) {
      const view = specView(spec);
      if (options.needsDomain === true && view.binding.domainLayer === undefined) return [];
      const files = projectFiles(handle);
      const sites: MutationSite[] = [];
      for (const s of files) {
        for (const t of files) {
          const sp = relOf(handle, s);
          const tp = relOf(handle, t);
          if (sp === tp || !pair(sp, tp)) continue;
          const symbol = exportedValueNames(t)[0];
          if (symbol === undefined) continue;
          sites.push({ filePath: sp, line: 1, kind: 'import-edge', detail: { targetFile: tp, symbol } });
        }
      }
      return sites;
    },
    checkPreconditions(_h, _s, site, ctx) {
      const forced = site.detail.reject;
      if (forced !== undefined) return { ok: false, reason: forced as PreconditionReason };
      if (hasEdge(ctx.baseGraph, site.filePath, site.detail.targetFile ?? '')) return { ok: false, reason: 'edge-exists' };
      return { ok: true };
    },
    apply(handle, site) {
      calls++;
      const sf = fileAt(handle, site.filePath);
      const target = fileAt(handle, site.detail.targetFile ?? '');
      const symbol = site.detail.symbol ?? '';
      if (sf === undefined || target === undefined) return DomainResult.fail([{ code: 'T', message: 'missing file' }]);
      const line = insertImport(sf, specifierTo(sf, target), { named: [symbol] });
      appendValueRef(sf, symbol, `${symbol}Ref`);
      if (options.breakOnCall === calls) sf.addStatements(`const brokenByTest: number = 'a';`);
      return DomainResult.ok(editOf([site.filePath], [], [{ source: site.filePath, target: site.detail.targetFile ?? '' }], { line, values: {} }));
    },
    plannedEdges: (site) => [{ source: site.filePath, target: site.detail.targetFile ?? '' }],
    plannedFiles: (site) => [site.filePath],
  };
}

/** One site per file of `files`; apply runs `edit` on the site file. */
function fileOperator(id: string, files: readonly string[], edit: (text: string) => string | Error): MutationOperator {
  return {
    ...base,
    id,
    expectedTemplates: [],
    findSites: (handle) =>
      projectFiles(handle)
        .map((sf) => relOf(handle, sf))
        .filter((p) => files.includes(p))
        .map((filePath) => ({ filePath, line: 1, kind: 'class-members' as const, detail: {} })),
    checkPreconditions: () => ({ ok: true }),
    apply(handle, site) {
      const sf = fileAt(handle, site.filePath);
      if (sf === undefined) return DomainResult.fail([{ code: 'T', message: 'missing file' }]);
      const next = edit(sf.getFullText());
      if (next instanceof Error) throw next;
      sf.replaceWithText(next);
      return DomainResult.ok(editOf([site.filePath], [], []));
    },
    plannedEdges: () => [],
  };
}

export const TASK = 'src/domain/entities/Task.ts';

/** F-U5A-REJECT: `const x: number = 'a';` appended. */
export const breakOperator = (): MutationOperator => fileOperator('MO-TEST-break', [TASK], (t) => `${t}const x: number = 'a';\n`);

/** BR-U5a-34: `apply` throws with a home-directory path and an Anthropic-key-shaped token in the message. */
export function throwOperator(home: string, token: string): MutationOperator {
  return fileOperator('MO-TEST-throw', [TASK], () => new Error(`cannot write ${home}/secret/dir/file.ts with ${token}`));
}

/** BR-U5a-18: three lines inserted after base line 4 of Task.ts. */
export const linesOperator = (): MutationOperator =>
  fileOperator('MO-TEST-lines', [TASK], (t) => {
    const ls = t.split('\n');
    return [...ls.slice(0, 4), '    // u5a line 1', '    // u5a line 2', '    // u5a line 3', ...ls.slice(4)].join('\n');
  });

export function testRegistry(ops: readonly MutationOperator[]): OperatorRegistry {
  const r = new OperatorRegistry(TEST_CATALOGUE_VERSION);
  for (const op of ops) {
    const res = r.register(op);
    if (!res.success) throw new Error(JSON.stringify(res.errors));
  }
  r.freeze();
  return r;
}
