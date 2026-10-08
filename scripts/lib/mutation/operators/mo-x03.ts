/**
 * MO-X03 and its twin MO-X03n — Integrity judge-construction probe (FR-24 amendment; BR-U5a-26, 27, 29; U4P Q12;
 * U4 rubric FF-N01; Evans 2003). Outside coverage, `judgeProbe: 'integrity'`, no function id, no key.
 *
 * - **MO-X03** (`invariant-split`): an entity guard method (`judge-common.ts`) whose guard calls all sit in one
 *   non-domain file (the use case) leaves the entity. The rule becomes an exported free function over primitive
 *   parameters, `export function <method><Entity>(<field>: <type>, …): boolean`, in a new domain module
 *   `<domain root>/rules/<entity>Rules.ts` that imports nothing; the use case imports it and calls it in place of
 *   the entity method (`!<method><Entity>(<recv>.<field>, …)`), and the same rule is duplicated inline as a check on
 *   the use case's input before the entity is constructed (`this.<field>` → the constructor argument for that
 *   field), reusing the guard's `throw`. No class is added. Restrictions: removable guard calls in one non-domain
 *   file (`not-removable-guard`); the fields are constructor parameter properties with type annotations and the
 *   guard's function constructs the entity before the guard (`type-shape`); judge placement (BR-U5a-27).
 * - **MO-X03n**: the invariant is extracted into a private method of the same entity
 *   (`<method>Invariant(): boolean`, the guard method returns its call); precondition: the entity's method count
 *   stays within `max_public_methods` (`threshold-arithmetic`, `detail.limit`).
 */
import * as path from 'node:path';
import { Node, Scope, SyntaxKind } from 'ts-morph';
import type { ClassDeclaration, IfStatement, NewExpression } from 'ts-morph';
import { DomainResult } from '../../../../src/shared/errors/domain-result.js';
import type { MutationEdit, MutationOperator, MutationSite, ParsedSpec, PreconditionResult, ProjectHandle } from '../types.js';
import { classMethodCount, editOf, fail, fileAt, insertImport, layerOfFile, lowerFirst, specView, specifierTo } from './common.js';
import type { SpecView } from './common.js';
import { guardAt, guardMethods, rewriteRule } from './judge-common.js';
import type { GuardMethod } from './judge-common.js';
import { specLimit } from './mo-so01.js';

/** Created module path: `<domain root>/rules/<entity>Rules.ts` (domain root = parent of the entity's directory). */
export function rulesModulePath(entityFile: string, entity: string): string {
  const dir = path.posix.dirname(path.posix.dirname(entityFile));
  return `${dir}/rules/${lowerFirst(entity)}Rules.ts`;
}

/** Constructor parameter properties of the entity: name → (index, type text). */
function ctorFields(cls: ClassDeclaration): Map<string, { index: number; type: string }> {
  const out = new Map<string, { index: number; type: string }>();
  const ctor = cls.getConstructors()[0];
  ctor?.getParameters().forEach((p, index) => {
    const type = p.getTypeNode()?.getText();
    if (p.isParameterProperty() && type !== undefined) out.set(p.getName(), { index, type });
  });
  return out;
}

interface SplitPlan {
  readonly guard: GuardMethod;
  readonly useCase: string;
  readonly fields: Map<string, { index: number; type: string }>;
  /** Per guard statement: the constructing `new` expression in the same function, before the guard. */
  readonly constructions: readonly { readonly statement: IfStatement; readonly receiver: string; readonly construct: NewExpression }[];
}

function planSplit(handle: ProjectHandle, view: SpecView, site: MutationSite): SplitPlan | PreconditionResult {
  const g = guardAt(handle, view, site.filePath, site.detail.class ?? '', site.detail.method ?? '');
  if (g?.removable !== true) return { ok: false, reason: 'not-removable-guard' };
  const files = [...new Set(g.calls.map((c) => c.file))];
  const useCase = files[0];
  if (files.length !== 1 || useCase === undefined || useCase === g.file || layerOfFile(view, useCase) === view.binding.domainLayer) {
    return { ok: false, reason: 'not-removable-guard' };
  }
  const fields = ctorFields(g.cls);
  if (!g.fields.every((f) => fields.has(f))) return { ok: false, reason: 'type-shape' };
  const entity = g.cls.getName() ?? '';
  const constructions: SplitPlan['constructions'][number][] = [];
  for (const c of g.calls) {
    const fn = c.statement.getFirstAncestor((a) => Node.isMethodDeclaration(a) || Node.isFunctionDeclaration(a) || Node.isArrowFunction(a));
    const construct = fn
      ?.getDescendantsOfKind(SyntaxKind.NewExpression)
      .find((n) => n.getExpression().getText() === entity && n.getStart() < c.statement.getStart());
    if (construct === undefined) return { ok: false, reason: 'type-shape' };
    constructions.push({ statement: c.statement, receiver: c.receiver, construct });
  }
  return { guard: g, useCase, fields, constructions };
}

function x03Sites(handle: ProjectHandle, spec: ParsedSpec, twin: boolean): MutationSite[] {
  const view = specView(spec);
  const limit = specLimit(spec, 'single-responsibility-proxy', 'maxPublicMethods');
  return guardMethods(handle, view).map((g) => ({
    filePath: g.file,
    line: g.method.getStartLineNumber(),
    kind: 'invariant-split' as const,
    detail: twin
      ? { class: g.cls.getName() ?? '', method: g.method.getName(), ...(limit !== undefined ? { limit: String(limit) } : {}) }
      : { class: g.cls.getName() ?? '', method: g.method.getName(), guardFile: [...new Set(g.calls.map((c) => c.file))].sort().join(',') },
  }));
}

export const MO_X03: MutationOperator = {
  id: 'MO-X03',
  role: 'positive',
  core: false,
  dimension: 'integrity',
  expectedTemplates: [],
  operatorCollateral: [],
  coveredByTemplates: [],
  coverage: 'outside',
  judgeProbe: 'integrity',
  source: 'Evans 2003',
  findSites: (handle, spec) => x03Sites(handle, spec, false),
  checkPreconditions(handle, spec, site): PreconditionResult {
    const view = specView(spec);
    const plan = planSplit(handle, view, site);
    if ('ok' in plan) return plan;
    const created = rulesModulePath(site.filePath, site.detail.class ?? '');
    if (fileAt(handle, created) !== undefined || layerOfFile(view, created) !== view.binding.domainLayer) return { ok: false, reason: 'type-shape' };
    return { ok: true };
  },
  apply(handle, site): DomainResult<MutationEdit> {
    // The spec's layers are not needed to re-plan: the site names the guard; `guardMethods` needs only the domain
    // layer to enumerate, so the plan is rebuilt from the site's own file.
    const entityFile = fileAt(handle, site.filePath);
    const cls = entityFile?.getClass(site.detail.class ?? '');
    const method = cls?.getMethod(site.detail.method ?? '');
    const useCaseFile = fileAt(handle, site.detail.guardFile ?? '');
    if (entityFile === undefined || cls === undefined || method === undefined || useCaseFile === undefined) {
      return fail('MUT_SITE_STALE', `invariant site ${site.filePath} is stale`);
    }
    const view: SpecView = { layers: [{ name: 'entity', directories: [site.filePath] }], binding: { domainLayer: 'entity', applicationLayers: [] } };
    const plan = planSplit(handle, view, site);
    if ('ok' in plan) return fail('MUT_SITE_STALE', `invariant site ${site.filePath} is not eligible`);
    const entity = cls.getName() ?? '';
    const fn = `${site.detail.method ?? ''}${entity}`;
    const fields = plan.guard.fields;
    const params = fields.map((f) => `${f}: ${plan.fields.get(f)?.type ?? 'unknown'}`).join(', ');
    // 1. Guard conditions call the free function; 2. inline duplicate before construction.
    for (const c of plan.constructions) {
      const throwText = (() => {
        const then = c.statement.getThenStatement();
        const t = Node.isBlock(then) ? then.getStatements()[0] : then;
        return t?.getText() ?? `throw new Error('Invalid ${lowerFirst(entity)} data');`;
      })();
      const args = c.construct.getArguments().map((a) => a.getText());
      const inline = rewriteRule(plan.guard.rule, (f) => args[plan.fields.get(f)?.index ?? -1] ?? f);
      c.statement.getExpression().replaceWithText(`!${fn}(${fields.map((f) => `${c.receiver}.${f}`).join(', ')})`);
      const holder = c.construct.getFirstAncestor((a) => Node.isBlock(a.getParent()) || Node.isSourceFile(a.getParent()));
      const block = holder?.getParent();
      if (holder === undefined || block === undefined || !(Node.isBlock(block) || Node.isSourceFile(block))) {
        return fail('MUT_SITE_STALE', 'construction statement not found');
      }
      block.insertStatements(holder.getChildIndex(), `if (!(${inline})) {\n  ${throwText}\n}`);
    }
    // 3. The entity method leaves the entity; 4. the rule module is created and imported by the use case.
    method.remove();
    const created = rulesModulePath(site.filePath, entity);
    const moduleSf = handle.project.createSourceFile(
      path.join(handle.root, ...created.split('/')),
      `export function ${fn}(${params}): boolean {\n  return ${rewriteRule(plan.guard.rule, (f) => f)};\n}\n`,
    );
    insertImport(useCaseFile, specifierTo(useCaseFile, moduleSf), { named: [fn] });
    const useCase = site.detail.guardFile ?? '';
    return DomainResult.ok(editOf([site.filePath, useCase].sort(), [created], [{ source: useCase, target: created }]));
  },
  plannedEdges: (site) => [{ source: site.detail.guardFile ?? '', target: rulesModulePath(site.filePath, site.detail.class ?? '') }],
  plannedFiles: (site) => [...new Set([site.filePath, site.detail.guardFile ?? ''])].sort(),
};

export const MO_X03N: MutationOperator = {
  id: 'MO-X03n',
  role: 'twin',
  core: false,
  twinOf: 'MO-X03',
  dimension: 'integrity',
  expectedTemplates: [],
  operatorCollateral: [],
  coveredByTemplates: [],
  coverage: 'outside',
  judgeProbe: 'integrity',
  source: 'Evans 2003',
  findSites: (handle, spec) => x03Sites(handle, spec, true),
  checkPreconditions(handle, _spec, site): PreconditionResult {
    const cls = fileAt(handle, site.filePath)?.getClass(site.detail.class ?? '');
    if (cls === undefined) return { ok: false, reason: 'type-shape' };
    const limit = site.detail.limit === undefined ? Number.POSITIVE_INFINITY : Number(site.detail.limit);
    return classMethodCount(cls) + 1 <= limit ? { ok: true } : { ok: false, reason: 'threshold-arithmetic' };
  },
  apply(handle, site): DomainResult<MutationEdit> {
    const cls = fileAt(handle, site.filePath)?.getClass(site.detail.class ?? '');
    const method = cls?.getMethod(site.detail.method ?? '');
    const ret = method?.getStatements()[0];
    const expr = ret !== undefined && Node.isReturnStatement(ret) ? ret.getExpression() : undefined;
    if (cls === undefined || method === undefined || ret === undefined || expr === undefined) return fail('MUT_SITE_STALE', `site ${site.filePath} is stale`);
    const taken = new Set([...cls.getMethods().map((m) => m.getName()), ...cls.getProperties().map((p) => p.getName())]);
    let name = `${method.getName()}Invariant`;
    for (let i = 2; taken.has(name); i++) name = `${method.getName()}Invariant${String(i)}`;
    const rule = expr.getText();
    ret.replaceWithText(`return this.${name}();`);
    cls.addMethod({ name, scope: Scope.Private, returnType: 'boolean', statements: [`return ${rule};`] });
    return DomainResult.ok(editOf([site.filePath], [], []));
  },
  plannedEdges: () => [],
  plannedFiles: (site) => [site.filePath],
};
