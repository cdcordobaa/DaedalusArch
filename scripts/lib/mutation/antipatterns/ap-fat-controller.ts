/**
 * AP-FAT-CONTROLLER and its twin AP-FAT-CONTROLLERn (v1.3 DRAFT; Semantic; Fowler 2002; Evans 2003; Aniche et al.
 * 2018).
 *
 * - **AP-FAT-CONTROLLER** (`rule-move`): a controller handler calls an injected service (`this.<svc>.<m>(args)`) whose
 *   method `m` holds a parameter rule (`antipatterns/common.ts`: `if (<cond>) { throw …; }` over its own parameters).
 *   The rule leaves the service method and is placed in the handler, right before the statement holding the call,
 *   with each parameter replaced by the call's argument (`quantity` → `dto.quantity`). Names the rule uses
 *   (`BadRequestException` of a package, an exported project enum) are imported into the controller.
 * - **AP-FAT-CONTROLLERn**: at the same kind of call, a pure request-mapping change: one property-access argument is
 *   bound to a local first (`const quantity = dto.quantity;`) and the call passes the local. No rule moves.
 *
 * Restrictions: every argument standing for a parameter of the rule is a side-effect-free name or literal
 * (`type-shape`); no spread argument before it (`type-shape`); the names the rule imports (package names, exported
 * project constants or enums) are free in the controller (`type-shape`); an added project import passes the cycle
 * cap. No template reads where a validation lives, so no key is expected (an added project import is an ordinary
 * edge and is scored as site collateral if it trips one).
 */
import { Node, SyntaxKind } from 'ts-morph';
import type { CallExpression, MethodDeclaration, Statement } from 'ts-morph';
import { DomainResult } from '../../../../src/shared/errors/domain-result.js';
import type { MutationEdit, MutationOperator, MutationSite, ParsedSpec, PreconditionResult, ProjectHandle } from '../types.js';
import { editOf, fail, fileAt, projectFiles, relOf, specView } from '../operators/common.js';
import { controllerHandlers } from '../operators/mo-x02.js';
import {
  bindImports,
  boundNames,
  encodeImports,
  freshIn,
  importsFree,
  isPureArgument,
  paramRuleAt,
  paramRules,
  plannedFileEdges,
  plannedPackageUses,
  substituteText,
  useFileStyle,
} from './common.js';
import type { ParamRule } from './common.js';

export const AP_SOURCE_FAT_CONTROLLER = 'Fowler 2002; Evans 2003; Aniche et al. 2018';

/** Calls `this.<field>.<method>(…)` directly in a handler (not inside a nested function), document order. */
export function serviceCalls(handler: MethodDeclaration): CallExpression[] {
  return handler.getDescendantsOfKind(SyntaxKind.CallExpression).filter((c) => {
    const callee = c.getExpression();
    if (!Node.isPropertyAccessExpression(callee)) return false;
    const recv = callee.getExpression();
    if (!Node.isPropertyAccessExpression(recv) || recv.getExpression().getKind() !== SyntaxKind.ThisKeyword) return false;
    for (let p = c.getParent(); p !== undefined && p !== handler; p = p.getParent()) {
      if (Node.isArrowFunction(p) || Node.isFunctionExpression(p) || Node.isFunctionDeclaration(p)) return false;
    }
    return true;
  });
}

/** The handler's top-level statement holding `node`. */
export function topStatement(handler: MethodDeclaration, node: Node): Statement | undefined {
  const body = handler.getBody();
  if (body === undefined) return undefined;
  for (let n: Node | undefined = node; n !== undefined; n = n.getParent()) {
    if (n.getParent() === body) return Node.isStatement(n) ? n : undefined;
  }
  return undefined;
}

/** The project method a call resolves to, with its file. */
function calleeMethod(handle: ProjectHandle, call: CallExpression): { readonly file: string; readonly method: MethodDeclaration } | undefined {
  const callee = call.getExpression();
  if (!Node.isPropertyAccessExpression(callee)) return undefined;
  const decl = callee.getNameNode().getSymbol()?.getDeclarations().find((d) => Node.isMethodDeclaration(d) && d.getBody() !== undefined);
  if (decl === undefined || !Node.isMethodDeclaration(decl)) return undefined;
  const sf = decl.getSourceFile();
  if (!projectFiles(handle).includes(sf)) return undefined;
  return { file: relOf(handle, sf), method: decl };
}

function handlerAt(handle: ProjectHandle, site: MutationSite): MethodDeclaration | undefined {
  return fileAt(handle, site.filePath)?.getClass(site.detail.controller ?? '')?.getMethod(site.detail.handler ?? '');
}

function callAt(handle: ProjectHandle, site: MutationSite): { readonly handler: MethodDeclaration; readonly call: CallExpression; readonly stmt: Statement } | undefined {
  const handler = handlerAt(handle, site);
  const call = handler === undefined ? undefined : serviceCalls(handler)[Number(site.detail.call ?? '-1')];
  const stmt = handler === undefined || call === undefined ? undefined : topStatement(handler, call);
  return handler === undefined || call === undefined || stmt === undefined ? undefined : { handler, call, stmt };
}

function positiveSites(handle: ProjectHandle, spec: ParsedSpec): MutationSite[] {
  const out: MutationSite[] = [];
  for (const h of controllerHandlers(handle, specView(spec))) {
    serviceCalls(h.method).forEach((call, i) => {
      const target = calleeMethod(handle, call);
      if (target === undefined || topStatement(h.method, call) === undefined) return;
      for (const rule of paramRules(target.method)) {
        const imports = encodeImports(rule.imports, (abs) => relOf(handle, handle.project.getSourceFileOrThrow(abs)));
        if (imports === undefined) continue;
        out.push({
          filePath: h.file,
          line: h.method.getStartLineNumber(),
          kind: 'rule-move',
          detail: {
            controller: h.controller.getName() ?? '',
            handler: h.method.getName(),
            call: String(i),
            serviceFile: target.file,
            serviceClass: classNameOf(target.method),
            method: target.method.getName(),
            guard: String(rule.index),
            imports,
          },
        });
      }
    });
  }
  return out;
}

/** Parameter → argument text of a rule at a call; undefined when an argument is missing, spread or impure. */
function argumentMap(rule: ParamRule, method: MethodDeclaration, call: CallExpression): Map<string, string> | undefined {
  const params = method.getParameters();
  const args = call.getArguments();
  const map = new Map<string, string>();
  for (const p of rule.params) {
    const i = params.indexOf(p);
    if (args.slice(0, i + 1).some((a) => Node.isSpreadElement(a))) return undefined;
    const arg = args[i];
    if (arg === undefined || !isPureArgument(arg)) return undefined;
    map.set(p.getName(), arg.getText());
  }
  return map;
}

function ruleAt(handle: ProjectHandle, site: MutationSite): { readonly method: MethodDeclaration; readonly rule: ParamRule } | undefined {
  return paramRuleAt(fileAt(handle, site.detail.serviceFile ?? ''), site.detail.serviceClass ?? '', site.detail.method ?? '', Number(site.detail.guard ?? '-1'));
}

function classNameOf(method: MethodDeclaration): string {
  const parent = method.getParent();
  return Node.isClassDeclaration(parent) ? (parent.getName() ?? '') : '';
}

/** Rule-local name → local name in the target file, for every name the rule imports. */
export function renames(rule: ParamRule, bound: ReadonlyMap<string, string>): Map<string, string> {
  const out = new Map<string, string>();
  for (const i of rule.imports) {
    const local = bound.get(i.name);
    if (local !== undefined) out.set(i.local, local);
  }
  return out;
}

const positiveFiles = (site: MutationSite): string[] => [...new Set([site.filePath, site.detail.serviceFile ?? ''])].sort();

export const AP_FAT_CONTROLLER: MutationOperator = {
  id: 'AP-FAT-CONTROLLER',
  role: 'positive',
  core: false,
  dimension: 'semantic',
  expectedTemplates: [],
  operatorCollateral: [],
  coveredByTemplates: [],
  coverage: 'outside',
  judgeProbe: 'semantic',
  source: AP_SOURCE_FAT_CONTROLLER,
  findSites: positiveSites,
  checkPreconditions(handle, _spec, site): PreconditionResult {
    const at = callAt(handle, site);
    const r = ruleAt(handle, site);
    if (at === undefined || r === undefined || argumentMap(r.rule, r.method, at.call) === undefined) return { ok: false, reason: 'type-shape' };
    if (!importsFree(handle, at.handler.getSourceFile(), site.detail.imports)) return { ok: false, reason: 'type-shape' };
    return { ok: true };
  },
  apply(handle, site): DomainResult<MutationEdit> {
    const at = callAt(handle, site);
    const r = ruleAt(handle, site);
    const map = at === undefined || r === undefined ? undefined : argumentMap(r.rule, r.method, at.call);
    if (at === undefined || r === undefined || map === undefined) return fail('MUT_SITE_STALE', `rule-move site ${site.filePath} is stale`);
    useFileStyle(at.handler.getSourceFile());
    const bound = bindImports(handle, at.handler.getSourceFile(), site.detail.imports);
    if (bound === undefined) return fail('MUT_SITE_STALE', `a rule name is taken in ${site.filePath}`);
    const moved = substituteText(r.rule.statement, map, renames(r.rule, bound));
    r.rule.statement.remove();
    // Re-resolve the call statement (the import edit may have re-parsed the controller).
    const again = callAt(handle, site);
    if (again === undefined) return fail('MUT_SITE_STALE', `call ${site.detail.call ?? ''} of ${site.filePath} is stale`);
    again.handler.insertStatements(again.handler.getStatements().indexOf(again.stmt), moved);
    return DomainResult.ok(editOf(positiveFiles(site), [], []));
  },
  plannedEdges: (site) => plannedFileEdges(site.detail.imports, site.filePath),
  plannedImportUses: (site) => plannedPackageUses(site.detail.imports, site.filePath),
  plannedFiles: positiveFiles,
};

function twinSites(handle: ProjectHandle, spec: ParsedSpec): MutationSite[] {
  const out: MutationSite[] = [];
  for (const h of controllerHandlers(handle, specView(spec))) {
    serviceCalls(h.method).forEach((call, i) => {
      if (topStatement(h.method, call) === undefined) return;
      const arg = call.getArguments().findIndex((a) => Node.isPropertyAccessExpression(a) && isPureArgument(a));
      if (arg < 0) return;
      out.push({
        filePath: h.file,
        line: h.method.getStartLineNumber(),
        kind: 'rule-move',
        detail: { controller: h.controller.getName() ?? '', handler: h.method.getName(), call: String(i), arg: String(arg) },
      });
    });
  }
  return out;
}

export const AP_FAT_CONTROLLERN: MutationOperator = {
  id: 'AP-FAT-CONTROLLERn',
  role: 'twin',
  core: false,
  twinOf: 'AP-FAT-CONTROLLER',
  dimension: 'semantic',
  expectedTemplates: [],
  operatorCollateral: [],
  coveredByTemplates: [],
  coverage: 'outside',
  judgeProbe: 'semantic',
  source: AP_SOURCE_FAT_CONTROLLER,
  findSites: twinSites,
  checkPreconditions: (handle, _spec, site) => (callAt(handle, site) === undefined ? { ok: false, reason: 'type-shape' } : { ok: true }),
  apply(handle, site): DomainResult<MutationEdit> {
    const at = callAt(handle, site);
    const arg = at?.call.getArguments()[Number(site.detail.arg ?? '-1')];
    if (at === undefined || arg === undefined || !Node.isPropertyAccessExpression(arg)) return fail('MUT_SITE_STALE', `mapping site ${site.filePath} is stale`);
    useFileStyle(at.handler.getSourceFile());
    const local = freshIn(boundNames(at.handler), arg.getName());
    const text = arg.getText();
    const index = at.handler.getStatements().indexOf(at.stmt);
    arg.replaceWithText(local);
    at.handler.insertStatements(index, `const ${local} = ${text};`);
    return DomainResult.ok(editOf([site.filePath], [], []));
  },
  plannedEdges: () => [],
  plannedFiles: (site) => [site.filePath],
};
