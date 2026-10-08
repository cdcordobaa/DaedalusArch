/**
 * MO-SO01 and its twin MO-SO01n (FR-v1.2E-24; BR-U5a-24; `business-rules.md` §3; Martin 2003; ADR-016 f).
 *
 * Members are counted as `single-responsibility-proxy` counts them: class methods of any visibility. With
 * `t = max_public_methods` of the spec (carried in `detail.limit`) and `b` the base count of the class:
 * - **MO-SO01** adds `t − b + 1` methods (precondition `b ≤ t`, else `metric-already-violating`); expected
 *   `single-responsibility-proxy` keyed `(site file, '', [class]; site-line = the class line)`.
 * - **MO-SO01n** adds `t − b` methods (precondition `t − b ≥ 1`, else `threshold-arithmetic`).
 * Added methods: `extraOperation<i>(): number { return <i>; }` (fresh names), appended to the class.
 * Sites: every named class of a layered file when the spec gives `max_public_methods`; `line` = the class line,
 * `detail = { class, limit }`.
 */
import type { ClassDeclaration, InterfaceDeclaration } from 'ts-morph';
import { DomainResult } from '../../../../src/shared/errors/domain-result.js';
import type { MutationEdit, MutationOperator, MutationSite, ParsedSpec, PreconditionResult, ProjectHandle } from '../types.js';
import { classMethodCount, editOf, fail, fileAt, layerOfFile, namedClasses, projectFiles, relOf, specView } from './common.js';

/** FR-07 limit of an enabled function of the spec, if any. */
export function specLimit(spec: ParsedSpec, template: string, field: 'maxPublicMethods' | 'maxInterfaceMethods'): number | undefined {
  const v = spec.fitnessFunctions.find((f) => f.name === template && f.enabled)?.[field];
  return typeof v === 'number' ? v : undefined;
}

export function classSites(handle: ProjectHandle, spec: ParsedSpec): MutationSite[] {
  const limit = specLimit(spec, 'single-responsibility-proxy', 'maxPublicMethods');
  if (limit === undefined) return [];
  const view = specView(spec);
  const sites: MutationSite[] = [];
  for (const sf of projectFiles(handle)) {
    const rel = relOf(handle, sf);
    if (layerOfFile(view, rel) === null) continue;
    for (const c of namedClasses(sf)) {
      sites.push({ filePath: rel, line: c.getStartLineNumber(), kind: 'class-members', detail: { class: c.getName() ?? '', limit: String(limit) } });
    }
  }
  return sites;
}

export function classAt(handle: ProjectHandle, site: MutationSite): ClassDeclaration | undefined {
  return fileAt(handle, site.filePath)?.getClass(site.detail.class ?? '');
}

/** Members to add for a positive (`t − b + 1`) or a twin (`t − b`); the failed precondition otherwise. */
export function arithmetic(base: number, threshold: number, twin: boolean): number | PreconditionResult {
  if (base > threshold) return { ok: false, reason: 'metric-already-violating' };
  const add = twin ? threshold - base : threshold - base + 1;
  return add >= 1 ? add : { ok: false, reason: 'threshold-arithmetic' };
}

/** Fresh member names `<prefix><i>` not used by the class or interface. */
export function freshMemberNames(decl: ClassDeclaration | InterfaceDeclaration, prefix: string, count: number): string[] {
  const taken = new Set<string>([...decl.getMethods().map((m) => m.getName()), ...decl.getProperties().map((p) => p.getName())]);
  const out: string[] = [];
  for (let i = 1; out.length < count; i++) if (!taken.has(`${prefix}${String(i)}`)) out.push(`${prefix}${String(i)}`);
  return out;
}

export function siteLimit(site: MutationSite): number {
  return Number(site.detail.limit ?? 'NaN');
}

function makeSo01(twin: boolean): MutationOperator {
  const count = (handle: ProjectHandle, site: MutationSite): number | PreconditionResult => {
    const cls = classAt(handle, site);
    if (cls === undefined) return { ok: false, reason: 'type-shape' };
    return arithmetic(classMethodCount(cls), siteLimit(site), twin);
  };
  return {
    id: twin ? 'MO-SO01n' : 'MO-SO01',
    role: twin ? 'twin' : 'positive',
    core: true,
    ...(twin ? { twinOf: 'MO-SO01' } : {}),
    dimension: 'solid',
    expectedTemplates: twin ? [] : [{ template: 'single-responsibility-proxy', filePath: 'site', discriminator: ['class'], line: 'site-line' }],
    operatorCollateral: [],
    coveredByTemplates: twin ? [] : ['single-responsibility-proxy'],
    coverage: 'in',
    source: 'Martin 2003',
    findSites: classSites,
    checkPreconditions(handle, _spec, site) {
      const n = count(handle, site);
      return typeof n === 'number' ? { ok: true } : n;
    },
    apply(handle, site): DomainResult<MutationEdit> {
      const cls = classAt(handle, site);
      const n = count(handle, site);
      if (cls === undefined || typeof n !== 'number') return fail('MUT_SITE_STALE', `class ${site.detail.class ?? ''} is not an eligible site`);
      for (const [i, name] of freshMemberNames(cls, 'extraOperation', n).entries()) {
        cls.addMethod({ name, returnType: 'number', statements: [`return ${String(i + 1)};`] });
      }
      return DomainResult.ok(editOf([site.filePath], [], [], { line: cls.getStartLineNumber(), values: { class: site.detail.class ?? '' } }));
    },
    plannedEdges: () => [],
    plannedFiles: (site) => [site.filePath],
  };
}

export const MO_SO01: MutationOperator = makeSo01(false);
export const MO_SO01N: MutationOperator = makeSo01(true);
