/**
 * MO-X02 and its twin MO-X02n — Semantic judge-construction probe (FR-24 amendment; BR-U5a-26, 27, 28; U4P Q12;
 * Fowler 2002; Evans 2003). Outside coverage, `judgeProbe: 'semantic'`, no function id, no key.
 *
 * - **MO-X02** (`guard-move`): an entity guard method (`judge-common.ts`) leaves the entity — the method and every
 *   guard statement calling it are removed — and the rule moves into a controller handler as an inline check on the
 *   handler's parameters (`this.<f>` → `<f>`): `if (!(<rule>)) { throw new Error('Invalid request data'); }` as the
 *   handler's first statement. Restrictions: every call is a removable guard (`not-removable-guard`); the handler
 *   has a parameter for every field the rule reads (`type-shape`); the controller file imports no domain-layer file
 *   in the base, and the edit adds none (`entity-import`, keeps FF-P05 silent); judge placement (BR-U5a-27).
 * - **MO-X02n**: a controller handler whose body is one `return <expr>;` gets a local extraction
 *   (`const result = <expr>; return result;`); no import, no rule moved.
 */
import { Node, Scope } from 'ts-morph';
import type { ClassDeclaration, MethodDeclaration } from 'ts-morph';
import { DomainResult } from '../../../../src/shared/errors/domain-result.js';
import type { MutationEdit, MutationOperator, MutationSite, ParsedSpec, PreconditionResult, ProjectHandle } from '../types.js';
import { editOf, fail, fileAt, isControllerFile, layerOfFile, namedClasses, projectFiles, relOf, specView } from './common.js';
import type { SpecView } from './common.js';
import { guardAt, guardMethods, rewriteRule } from './judge-common.js';

interface Handler {
  readonly file: string;
  readonly controller: ClassDeclaration;
  readonly method: MethodDeclaration;
}

/** Public instance methods of controller classes in the controller layer. */
export function controllerHandlers(handle: ProjectHandle, view: SpecView): Handler[] {
  const layer = view.binding.controllerLayer;
  if (layer === undefined) return [];
  const out: Handler[] = [];
  for (const sf of projectFiles(handle)) {
    const rel = relOf(handle, sf);
    if (layerOfFile(view, rel) !== layer || !isControllerFile(sf, rel)) continue;
    for (const c of namedClasses(sf)) {
      for (const m of c.getMethods()) {
        if (m.isStatic() || m.getScope() === Scope.Private || m.getScope() === Scope.Protected || m.getBody() === undefined) continue;
        out.push({ file: rel, controller: c, method: m });
      }
    }
  }
  return out;
}

function handlerAt(handle: ProjectHandle, site: MutationSite): MethodDeclaration | undefined {
  return fileAt(handle, site.detail.controllerFile ?? site.filePath)?.getClass(site.detail.controller ?? '')?.getMethod(site.detail.handler ?? '');
}

function x02Sites(handle: ProjectHandle, spec: ParsedSpec): MutationSite[] {
  const view = specView(spec);
  const handlers = controllerHandlers(handle, view);
  const sites: MutationSite[] = [];
  for (const g of guardMethods(handle, view)) {
    const guardFiles = [...new Set(g.calls.map((c) => c.file))].sort().join(',');
    for (const h of handlers) {
      sites.push({
        filePath: g.file,
        line: g.method.getStartLineNumber(),
        kind: 'guard-move',
        detail: {
          class: g.cls.getName() ?? '',
          method: g.method.getName(),
          controllerFile: h.file,
          controller: h.controller.getName() ?? '',
          handler: h.method.getName(),
          guardFiles,
        },
      });
    }
  }
  return sites;
}

const x02Files = (site: MutationSite): string[] =>
  [...new Set([site.filePath, ...(site.detail.guardFiles ?? '').split(',').filter((x) => x.length > 0), site.detail.controllerFile ?? ''])].sort();

export const MO_X02: MutationOperator = {
  id: 'MO-X02',
  role: 'positive',
  core: true,
  dimension: 'semantic',
  expectedTemplates: [],
  operatorCollateral: [],
  coveredByTemplates: [],
  coverage: 'outside',
  judgeProbe: 'semantic',
  source: 'Fowler 2002; Evans 2003',
  findSites: x02Sites,
  checkPreconditions(handle, spec, site, ctx): PreconditionResult {
    const view = specView(spec);
    const g = guardAt(handle, view, site.filePath, site.detail.class ?? '', site.detail.method ?? '');
    if (g?.removable !== true) return { ok: false, reason: 'not-removable-guard' };
    const h = handlerAt(handle, site);
    const params = new Set(h?.getParameters().map((p) => p.getName()) ?? []);
    if (h === undefined || !g.fields.every((f) => params.has(f))) return { ok: false, reason: 'type-shape' };
    const domain = view.binding.domainLayer;
    const ctrl = site.detail.controllerFile ?? '';
    if (ctx.baseGraph.edges.some((e) => e.source === ctrl && ctx.baseGraph.files.get(e.target)?.layer === domain)) {
      return { ok: false, reason: 'entity-import' };
    }
    return { ok: true };
  },
  apply(handle, site): DomainResult<MutationEdit> {
    const h = handlerAt(handle, site);
    const entity = fileAt(handle, site.filePath)?.getClass(site.detail.class ?? '');
    const method = entity?.getMethod(site.detail.method ?? '');
    if (h === undefined || entity === undefined || method === undefined) return fail('MUT_SITE_STALE', `guard site ${site.filePath} is stale`);
    const ret = method.getStatements()[0];
    const ruleExpr = ret !== undefined && Node.isReturnStatement(ret) ? ret.getExpression() : undefined;
    if (ruleExpr === undefined) return fail('MUT_SITE_STALE', 'guard method has no rule');
    const inline = rewriteRule(ruleExpr.getText(), (f) => f);
    // Guard statements calling the method (collected before any change).
    const guards = method
      .findReferencesAsNodes()
      .map((ref) => ref.getFirstAncestor((a) => Node.isIfStatement(a)))
      .filter((s): s is NonNullable<typeof s> => s !== undefined);
    const edited = new Set<string>([site.filePath, site.detail.controllerFile ?? '']);
    for (const s of guards) {
      edited.add(relOf(handle, s.getSourceFile()));
      if (Node.isIfStatement(s)) s.remove();
    }
    method.remove();
    h.insertStatements(0, `if (!(${inline})) {\n  throw new Error('Invalid request data');\n}`);
    return DomainResult.ok(editOf([...edited].sort(), [], []));
  },
  plannedEdges: () => [],
  plannedFiles: x02Files,
};

function returnHandlers(handle: ProjectHandle, spec: ParsedSpec): MutationSite[] {
  const sites: MutationSite[] = [];
  for (const h of controllerHandlers(handle, specView(spec))) {
    const stmts = h.method.getStatements();
    const only = stmts[0];
    if (stmts.length !== 1 || only === undefined || !Node.isReturnStatement(only) || only.getExpression() === undefined) continue;
    sites.push({
      filePath: h.file,
      line: h.method.getStartLineNumber(),
      kind: 'guard-move',
      detail: { controllerFile: h.file, controller: h.controller.getName() ?? '', handler: h.method.getName() },
    });
  }
  return sites;
}

export const MO_X02N: MutationOperator = {
  id: 'MO-X02n',
  role: 'twin',
  core: true,
  twinOf: 'MO-X02',
  dimension: 'semantic',
  expectedTemplates: [],
  operatorCollateral: [],
  coveredByTemplates: [],
  coverage: 'outside',
  judgeProbe: 'semantic',
  source: 'Fowler 2002; Evans 2003',
  findSites: returnHandlers,
  checkPreconditions: () => ({ ok: true }),
  apply(handle, site): DomainResult<MutationEdit> {
    const h = handlerAt(handle, site);
    const only = h?.getStatements()[0];
    const expr = only !== undefined && Node.isReturnStatement(only) ? only.getExpression() : undefined;
    if (h === undefined || only === undefined || expr === undefined) return fail('MUT_SITE_STALE', `handler ${site.detail.handler ?? ''} is stale`);
    const taken = new Set(h.getParameters().map((p) => p.getName()));
    let name = 'result';
    for (let i = 2; taken.has(name); i++) name = `result${String(i)}`;
    const text = expr.getText();
    only.replaceWithText(`const ${name} = ${text};\nreturn ${name};`);
    return DomainResult.ok(editOf([site.filePath], [], []));
  },
  plannedEdges: () => [],
  plannedFiles: (site) => [site.filePath],
};
