/**
 * MO-DF01 and its twin MO-DF01n (FR-21, FR-v1.2E-24; BR-U5a-25; `business-rules.md` §3; Evans 2003).
 *
 * - **MO-DF01** (`checks: data-flow (FR-21)`, dimension `pattern`): a named, non-generic domain-layer class gains
 *   `private readonly <field> = new <InfraClass>();` (site kind `field-new`) where `InfraClass` is a named,
 *   non-generic infrastructure-layer class constructible with zero arguments; the class is imported. Expected
 *   `domain-state-purity` keyed `(site file, infra file, [class, targetName, 'FLOWS_TO', field]; site-line = the
 *   field line)`, `expectedEdges: [{FLOWS_TO, class → InfraClass, via 'new'}]`; operator collateral
 *   `dependency-direction` and `no-domain-outward-dep` keyed `(site file, infra file, ['IMPORTS']; site-line = the
 *   import line)`; cycles are site collateral.
 * - **MO-DF01n**: a non-controller infrastructure class gains `private readonly <field> = new <DomainClass>(<literals>)`
 *   where every constructor parameter of the domain class is `string`, `number` or `boolean` (literals `'u5a'`,
 *   `0`, `false`); +1 FLOWS_TO, no expected key.
 * Restrictions: the site file does not already import the target file (`edge-exists`); the target is constructible
 * as stated (`type-shape`); the twin's source is not a controller (`controller-or-entity`). Field name: `repo` for
 * the positive (§2.3), `held` for the twin, made fresh within the class. The `field-assignment` site kind
 * (`this.<f> = <expr>` in a non-constructor method) is not enumerated: it needs a value of the target type that
 * only an added member could provide (DV-U5a-17).
 */
import { Scope } from 'ts-morph';
import type { ClassDeclaration } from 'ts-morph';
import { DomainResult } from '../../../../src/shared/errors/domain-result.js';
import type { MutationEdit, MutationOperator, MutationSite, ParsedSpec, PreconditionResult, ProjectHandle } from '../types.js';
import {
  edgeExists,
  edgeRule,
  editOf,
  fail,
  fileAt,
  insertImport,
  isControllerFile,
  layerOfFile,
  namedClasses,
  projectFiles,
  relOf,
  specView,
  specifierTo,
} from './common.js';

const PRIMITIVE_LITERAL: Readonly<Record<string, string>> = { string: "'u5a'", number: '0', boolean: 'false' };

/** Constructor argument literals, `[]` for a zero-argument constructor, `undefined` when not constructible so. */
export function constructorLiterals(cls: ClassDeclaration, primitivesAllowed: boolean): string[] | undefined {
  if (cls.getTypeParameters().length > 0 || cls.isAbstract()) return undefined;
  const ctors = cls.getConstructors();
  if (ctors.length > 1) return undefined;
  // ADR-025: a private or protected constructor cannot be called from the holder (TS2673 / TS2674): `type-shape`.
  const scope = ctors[0]?.getScope();
  if (scope === Scope.Private || scope === Scope.Protected) return undefined;
  const params = ctors[0]?.getParameters() ?? [];
  if (params.length === 0) return [];
  if (!primitivesAllowed) return undefined;
  const out: string[] = [];
  for (const p of params) {
    const lit = PRIMITIVE_LITERAL[p.getTypeNode()?.getText() ?? ''];
    if (lit === undefined || p.isRestParameter()) return undefined;
    out.push(lit);
  }
  return out;
}

function fieldSites(handle: ProjectHandle, spec: ParsedSpec, twin: boolean): MutationSite[] {
  const view = specView(spec);
  const { domainLayer, infraLayer } = view.binding;
  if (domainLayer === undefined || infraLayer === undefined) return [];
  const [fromLayer, toLayer] = twin ? [infraLayer, domainLayer] : [domainLayer, infraLayer];
  const files = projectFiles(handle);
  const sites: MutationSite[] = [];
  for (const s of files) {
    const sp = relOf(handle, s);
    if (layerOfFile(view, sp) !== fromLayer) continue;
    for (const holder of namedClasses(s)) {
      if (holder.getTypeParameters().length > 0) continue;
      for (const t of files) {
        const tp = relOf(handle, t);
        if (tp === sp || layerOfFile(view, tp) !== toLayer) continue;
        for (const target of namedClasses(t)) {
          sites.push({
            filePath: sp,
            line: holder.getStartLineNumber(),
            kind: 'field-new',
            detail: { class: holder.getName() ?? '', targetFile: tp, targetName: target.getName() ?? '' },
          });
        }
      }
    }
  }
  return sites;
}

function targetClass(handle: ProjectHandle, site: MutationSite): ClassDeclaration | undefined {
  return fileAt(handle, site.detail.targetFile ?? '')?.getClass(site.detail.targetName ?? '');
}

function makeDf01(twin: boolean): MutationOperator {
  const fieldBase = twin ? 'held' : 'repo';
  return {
    id: twin ? 'MO-DF01n' : 'MO-DF01',
    role: twin ? 'twin' : 'positive',
    core: true,
    ...(twin ? { twinOf: 'MO-DF01' } : {}),
    dimension: 'pattern',
    expectedTemplates: twin
      ? []
      : [{ template: 'domain-state-purity', filePath: 'site', target: 'site-target', discriminator: ['class', 'targetName', 'relType', 'field'], line: 'site-line' }],
    operatorCollateral: twin ? [] : [edgeRule('dependency-direction'), edgeRule('no-domain-outward-dep')],
    coveredByTemplates: twin ? [] : ['domain-state-purity'],
    coverage: 'in',
    expectedEdges: [{ type: 'FLOWS_TO', via: 'new' }],
    source: 'FR-21; Evans 2003',
    findSites: (handle, spec) => fieldSites(handle, spec, twin),
    checkPreconditions(handle, _spec, site, ctx): PreconditionResult {
      const sf = fileAt(handle, site.filePath);
      if (twin && sf !== undefined && isControllerFile(sf, site.filePath)) return { ok: false, reason: 'controller-or-entity' };
      const target = targetClass(handle, site);
      if (target === undefined || constructorLiterals(target, twin) === undefined) return { ok: false, reason: 'type-shape' };
      return edgeExists(ctx, site);
    },
    apply(handle, site): DomainResult<MutationEdit> {
      const sf = fileAt(handle, site.filePath);
      const holder = sf?.getClass(site.detail.class ?? '');
      const target = targetClass(handle, site);
      const literals = target === undefined ? undefined : constructorLiterals(target, twin);
      if (sf === undefined || holder === undefined || target === undefined || literals === undefined) {
        return fail('MUT_SITE_STALE', `site ${site.filePath} is not an eligible field site`);
      }
      const targetName = site.detail.targetName ?? '';
      const importLine = insertImport(sf, specifierTo(sf, target.getSourceFile()), { named: [targetName] });
      const taken = new Set([...holder.getProperties().map((p) => p.getName()), ...holder.getMethods().map((m) => m.getName())]);
      let field = fieldBase;
      for (let i = 2; taken.has(field); i++) field = `${fieldBase}${String(i)}`;
      const prop = holder.insertProperty(0, { name: field, scope: Scope.Private, isReadonly: true, initializer: `new ${targetName}(${literals.join(', ')})` });
      const fieldLine = prop.getStartLineNumber();
      return DomainResult.ok(
        editOf([site.filePath], [], [{ source: site.filePath, target: site.detail.targetFile ?? '' }], {
          line: importLine,
          lines: { 'domain-state-purity': fieldLine },
          values: { class: site.detail.class ?? '', targetName, field, 'relType@domain-state-purity': 'FLOWS_TO' },
        }),
      );
    },
    plannedEdges: (site) => [{ source: site.filePath, target: site.detail.targetFile ?? '' }],
    plannedFiles: (site) => [site.filePath],
  };
}

export const MO_DF01: MutationOperator = makeDf01(false);
export const MO_DF01N: MutationOperator = makeDf01(true);
