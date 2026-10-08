/**
 * MO-SO02 and its twin MO-SO02n (FR-v1.2E-24; BR-U5a-24; `business-rules.md` §3; Martin 2003 (ISP); ADR-016 f).
 *
 * Members are counted as `interface-segregation-proxy` counts them: interface method signatures (BR-U2-47). With
 * `t = max_interface_methods` of the spec (`detail.limit`) and `b` the base count:
 * - **MO-SO02** adds `t − b + 1` signatures (`b ≤ t`, else `metric-already-violating`); expected
 *   `interface-segregation-proxy` keyed `(site file, '', [interface]; site-line = the interface line)`.
 * - **MO-SO02n** adds `t − b` signatures (`t − b ≥ 1`, else `threshold-arithmetic`).
 * Every class that `implements` the interface (by name) gains a type-correct method per signature; precondition:
 * each implementer stays within `max_public_methods` afterwards (`implementer-over-threshold`; `detail.classLimit`).
 * Added members: `extraQuery<i>(): number;` and `extraQuery<i>(): number { return 0; }`.
 */
import type { ClassDeclaration, InterfaceDeclaration } from 'ts-morph';
import { DomainResult } from '../../../../src/shared/errors/domain-result.js';
import type { MutationEdit, MutationOperator, MutationSite, ParsedSpec, PreconditionResult, ProjectHandle } from '../types.js';
import { classMethodCount, editOf, fail, fileAt, interfaceMethodCount, layerOfFile, namedClasses, projectFiles, relOf, specView } from './common.js';
import { arithmetic, freshMemberNames, siteLimit, specLimit } from './mo-so01.js';

function interfaceSites(handle: ProjectHandle, spec: ParsedSpec): MutationSite[] {
  const limit = specLimit(spec, 'interface-segregation-proxy', 'maxInterfaceMethods');
  if (limit === undefined) return [];
  const classLimit = specLimit(spec, 'single-responsibility-proxy', 'maxPublicMethods');
  const view = specView(spec);
  const sites: MutationSite[] = [];
  for (const sf of projectFiles(handle)) {
    const rel = relOf(handle, sf);
    if (layerOfFile(view, rel) === null) continue;
    for (const i of sf.getInterfaces()) {
      sites.push({
        filePath: rel,
        line: i.getStartLineNumber(),
        kind: 'interface-members',
        detail: { interface: i.getName(), limit: String(limit), ...(classLimit !== undefined ? { classLimit: String(classLimit) } : {}) },
      });
    }
  }
  return sites;
}

function interfaceAt(handle: ProjectHandle, site: MutationSite): InterfaceDeclaration | undefined {
  return fileAt(handle, site.filePath)?.getInterface(site.detail.interface ?? '');
}

/** Classes of the project whose `implements` clause names the interface, path then class order. */
export function implementersOf(handle: ProjectHandle, name: string): ClassDeclaration[] {
  const out: ClassDeclaration[] = [];
  for (const sf of projectFiles(handle)) {
    for (const c of namedClasses(sf)) {
      if (c.getImplements().some((h) => h.getExpression().getText().split('.').pop() === name)) out.push(c);
    }
  }
  return out;
}

function makeSo02(twin: boolean): MutationOperator {
  const count = (handle: ProjectHandle, site: MutationSite): number | PreconditionResult => {
    const itf = interfaceAt(handle, site);
    if (itf === undefined) return { ok: false, reason: 'type-shape' };
    const n = arithmetic(interfaceMethodCount(itf), siteLimit(site), twin);
    if (typeof n !== 'number') return n;
    const classLimit = site.detail.classLimit === undefined ? Number.POSITIVE_INFINITY : Number(site.detail.classLimit);
    if (implementersOf(handle, site.detail.interface ?? '').some((c) => classMethodCount(c) + n > classLimit)) {
      return { ok: false, reason: 'implementer-over-threshold' };
    }
    return n;
  };
  return {
    id: twin ? 'MO-SO02n' : 'MO-SO02',
    role: twin ? 'twin' : 'positive',
    core: false,
    ...(twin ? { twinOf: 'MO-SO02' } : {}),
    dimension: 'solid',
    expectedTemplates: twin ? [] : [{ template: 'interface-segregation-proxy', filePath: 'site', discriminator: ['interface'], line: 'site-line' }],
    operatorCollateral: [],
    coveredByTemplates: twin ? [] : ['interface-segregation-proxy'],
    coverage: 'in',
    source: 'Martin 2003 (ISP)',
    findSites: interfaceSites,
    checkPreconditions(handle, _spec, site) {
      const n = count(handle, site);
      return typeof n === 'number' ? { ok: true } : n;
    },
    apply(handle, site): DomainResult<MutationEdit> {
      const itf = interfaceAt(handle, site);
      const n = count(handle, site);
      if (itf === undefined || typeof n !== 'number') return fail('MUT_SITE_STALE', `interface ${site.detail.interface ?? ''} is not an eligible site`);
      const implementers = implementersOf(handle, itf.getName());
      const taken = new Set<string>();
      for (const c of implementers) for (const m of c.getMethods()) taken.add(m.getName());
      const names = freshMemberNames(itf, 'extraQuery', n + taken.size).filter((x) => !taken.has(x)).slice(0, n);
      for (const name of names) itf.addMethod({ name, returnType: 'number' });
      const edited = new Set<string>([site.filePath]);
      for (const c of implementers) {
        for (const name of names) c.addMethod({ name, returnType: 'number', statements: ['return 0;'] });
        edited.add(relOf(handle, c.getSourceFile()));
      }
      return DomainResult.ok(editOf([...edited].sort(), [], [], { line: itf.getStartLineNumber(), values: { interface: itf.getName() } }));
    },
    plannedEdges: () => [],
    plannedFiles(site) {
      return [site.filePath];
    },
  };
}

export const MO_SO02: MutationOperator = makeSo02(false);
export const MO_SO02N: MutationOperator = makeSo02(true);
