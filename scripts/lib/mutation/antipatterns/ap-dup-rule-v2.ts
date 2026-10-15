/**
 * AP-DUP-RULE v2: AP-DUP-RULE2 and its twin AP-DUP-RULE2n (v1.3 DRAFT; Integrity; catalogue §8).
 *
 * The v1 pair (`ap-dup-rule.ts`) is frozen and stays registered unchanged. Its twin adds a `validate<Method>` forwarder
 * to the second service, which the judge fails as a misplaced responsibility (round 2: 5/5), so it is not a neutral
 * control. v2 keeps the positive and replaces the twin:
 *
 * - **AP-DUP-RULE2** (`rule-duplicate`): the v1 positive edit, called unchanged (`AP_DUP_RULE.apply`): a parameter rule
 *   of a service method is copied into a second service of another file as `validate<Method>(…)`.
 * - **AP-DUP-RULE2n**: a behaviour-equivalent relocation with no smell. The rule moves, once, into a policy function
 *   of the lowest layer its names allow, and the first method calls it. The second service is not touched.
 *   - *Domain host*: every name the rule needs (condition, error class, parameter types) is a declaration of a
 *     domain-layer file. The host is the domain file of a name the condition or a parameter type uses (the `is<X>`
 *     guard's file first). The helper is exported, named `assert<X>` for a `!is<X>(…)` rule, else
 *     `assert<Method>Rule`.
 *   - *Own-file host* otherwise (an application DTO type, an application error or a package name would make a domain
 *     helper depend outward): a module-level, non-exported `assert<Method>Rule` in the first service's file.
 *   - When the rule is `!g(p)` over one parameter and `g` is a type predicate `p is T` declared in the host, the helper
 *     is an assertion function (`asserts p is T`), so the caller keeps the narrowing the inline rule gave.
 *   - Named imports of the first file that only the moved rule used are removed.
 *
 * Both share one site pass (the v1 sites, with the twin's host planned into the detail under `twin*` keys), so a
 * seed and its twin can be paired on the same site.
 */
import { Node, SyntaxKind } from 'ts-morph';
import type { SourceFile } from 'ts-morph';
import { DomainResult } from '../../../../src/shared/errors/domain-result.js';
import type { MutationEdit, MutationOperator, MutationSite, ParsedSpec, PreconditionResult, ProjectHandle } from '../types.js';
import { editOf, fail, fileAt, layerOfFile, relOf, specView, specifierTo } from '../operators/common.js';
import { AP_DUP_RULE, AP_SOURCE_DUP_RULE } from './ap-dup-rule.js';
import { renames } from './ap-fat-controller.js';
import {
  bindImports,
  encodeImports,
  ensureNamedImport,
  fileBindings,
  freshIn,
  importsFree,
  paramRuleAt,
  substituteText,
  typeImports,
  upperFirst,
  useFileStyle,
} from './common.js';
import type { ParamRule, RuleImport } from './common.js';

/** The `is<X>` guard of a `!is<X>(…)` rule condition: its local name in the rule's file and its imported name. */
function guardOf(rule: ParamRule): { readonly local: string; readonly name: string; readonly call: Node } | undefined {
  const cond = rule.statement.getExpression();
  if (!Node.isPrefixUnaryExpression(cond) || cond.getOperatorToken() !== SyntaxKind.ExclamationToken) return undefined;
  const call = cond.getOperand();
  if (!Node.isCallExpression(call)) return undefined;
  const callee = call.getExpression();
  if (!Node.isIdentifier(callee)) return undefined;
  const imp = rule.imports.find((i) => i.local === callee.getText());
  if (imp === undefined || !/^is[A-Z]/.test(imp.name)) return undefined;
  return { local: imp.local, name: imp.name, call };
}

function paramTypes(rule: ParamRule): RuleImport[] | undefined {
  const out: RuleImport[] = [];
  for (const p of rule.params) {
    const t = typeImports(p);
    if (t === undefined) return undefined;
    out.push(...t);
  }
  return out;
}

/** Locals of the rule's imports that its condition (not the throw) references. */
function conditionLocals(rule: ParamRule): Set<string> {
  const ids = rule.statement.getExpression().getDescendantsOfKind(SyntaxKind.Identifier).map((i) => i.getText());
  const self = rule.statement.getExpression();
  if (Node.isIdentifier(self)) ids.push(self.getText());
  return new Set(ids);
}

interface HostPlan {
  /** Copy-relative host file. */
  readonly host: string;
  readonly kind: 'domain' | 'own';
  /** Names to bind in the host (encoded; '' for an own-file host). */
  readonly hostImports: string;
  /** Planned new File→File edges, `a>b` joined by `;`. */
  readonly edges: string;
}

/** The twin's host for one rule of `sourceFile`, or undefined when a parameter type cannot be written elsewhere. */
function planHost(handle: ProjectHandle, spec: ParsedSpec, sourceFile: string, rule: ParamRule): HostPlan | undefined {
  const types = paramTypes(rule);
  if (types === undefined) return undefined;
  const view = specView(spec);
  const domain = view.binding.domainLayer;
  const rel = (abs: string): string => relOf(handle, handle.project.getSourceFileOrThrow(abs));
  const needs = [...rule.imports, ...types];
  const isDomain = (i: RuleImport): boolean => i.module === '' && domain !== undefined && layerOfFile(view, rel(i.fileAbs)) === domain;
  const cond = conditionLocals(rule);
  const typeLocals = new Set(types.map((t) => t.local));
  const guard = guardOf(rule);
  const anchors = needs.filter((i) => isDomain(i) && (cond.has(i.local) || typeLocals.has(i.local)));
  const ordered = [...anchors].sort((a, b) => Number(b.local === guard?.local) - Number(a.local === guard?.local));
  const first = ordered[0];
  if (needs.length === 0 || !needs.every(isDomain) || first === undefined) return { host: sourceFile, kind: 'own', hostImports: '', edges: '' };
  const host = rel(first.fileAbs);
  const hostImports = encodeImports(needs, rel) ?? '';
  const hostSf = fileAt(handle, host);
  const s1 = fileAt(handle, sourceFile);
  const imported = (from: SourceFile | undefined, target: string): boolean =>
    from?.getImportDeclarations().some((d) => {
      const t = d.getModuleSpecifierSourceFile();
      return t !== undefined && relOf(handle, t) === target;
    }) === true;
  const edges = new Set<string>();
  if (!imported(s1, host)) edges.add(`${sourceFile}>${host}`);
  for (const i of needs) {
    const t = rel(i.fileAbs);
    if (t !== host && !imported(hostSf, t)) edges.add(`${host}>${t}`);
  }
  return { host, kind: 'domain', hostImports, edges: [...edges].sort().join(';') };
}

const decodeEdges = (text: string | undefined): { source: string; target: string }[] =>
  (text ?? '')
    .split(';')
    .filter((x) => x.includes('>'))
    .map((x) => {
      const [source = '', target = ''] = x.split('>');
      return { source, target };
    });

function ruleAt(handle: ProjectHandle, site: MutationSite): ReturnType<typeof paramRuleAt> {
  return paramRuleAt(fileAt(handle, site.detail.sourceFile ?? ''), site.detail.sourceClass ?? '', site.detail.method ?? '', Number(site.detail.guard ?? '-1'));
}

/** The v1 sites, each with the twin's planned host (`twin*` keys; '!' when the rule's types are not writable). */
function sites(handle: ProjectHandle, spec: ParsedSpec): MutationSite[] {
  const cache = new Map<string, HostPlan | undefined>();
  return AP_DUP_RULE.findSites(handle, spec).map((s) => {
    const key = `${s.detail.sourceFile ?? ''}|${s.detail.sourceClass ?? ''}|${s.detail.method ?? ''}|${s.detail.guard ?? ''}`;
    if (!cache.has(key)) {
      const r = ruleAt(handle, s);
      cache.set(key, r === undefined ? undefined : planHost(handle, spec, s.detail.sourceFile ?? '', r.rule));
    }
    const plan = cache.get(key);
    return {
      ...s,
      detail: {
        ...s.detail,
        twinHost: plan?.host ?? '!',
        twinHostKind: plan?.kind ?? '!',
        twinHostImports: plan?.hostImports ?? '',
        twinEdges: plan?.edges ?? '',
      },
    };
  });
}

export const AP_DUP_RULE2: MutationOperator = {
  ...AP_DUP_RULE,
  id: 'AP-DUP-RULE2',
  findSites: sites,
};

function twinCheck(handle: ProjectHandle, site: MutationSite): PreconditionResult {
  const host = site.detail.twinHost ?? '!';
  if (host === '!' || ruleAt(handle, site) === undefined) return { ok: false, reason: 'type-shape' };
  const hostSf = fileAt(handle, host);
  if (hostSf === undefined || !importsFree(handle, hostSf, site.detail.twinHostImports)) return { ok: false, reason: 'type-shape' };
  return { ok: true };
}

/** `asserts p is T` when the rule is `!g(p)` over its one parameter and `g` (declared in the host) is `x is T`. */
function assertion(rule: ParamRule, host: SourceFile): string | undefined {
  const guard = guardOf(rule);
  const p = rule.params[0];
  if (guard === undefined || p === undefined || rule.params.length !== 1 || !Node.isCallExpression(guard.call)) return undefined;
  const args = guard.call.getArguments();
  if (args.length !== 1 || args[0]?.getText() !== p.getName()) return undefined;
  const callee = guard.call.getExpression();
  const sym = callee.getSymbol();
  const decl = (sym?.getAliasedSymbol() ?? sym)?.getDeclarations()[0];
  if (decl?.getSourceFile() !== host) return undefined;
  const fn = Node.isFunctionDeclaration(decl) ? decl : Node.isVariableDeclaration(decl) ? decl.getInitializer() : undefined;
  if (fn === undefined || !(Node.isFunctionDeclaration(fn) || Node.isArrowFunction(fn) || Node.isFunctionExpression(fn))) return undefined;
  const ret = fn.getReturnTypeNode();
  if (ret === undefined || !Node.isTypePredicate(ret) || ret.hasAssertsModifier()) return undefined;
  const t = ret.getTypeNode();
  return t === undefined ? undefined : `asserts ${p.getName()} is ${t.getText()}`;
}

/** Removes named imports of `sf` among `locals` that nothing outside the import declarations references. */
function dropUnused(sf: SourceFile, locals: ReadonlySet<string>): void {
  const used = new Set(
    sf
      .getDescendantsOfKind(SyntaxKind.Identifier)
      .filter((id) => id.getFirstAncestorByKind(SyntaxKind.ImportDeclaration) === undefined)
      .map((id) => id.getText()),
  );
  for (const decl of sf.getImportDeclarations()) {
    for (const n of decl.getNamedImports()) {
      const local = n.getAliasNode()?.getText() ?? n.getName();
      if (locals.has(local) && !used.has(local)) n.remove();
    }
    if (decl.getNamedImports().length === 0 && decl.getDefaultImport() === undefined && decl.getNamespaceImport() === undefined) decl.remove();
  }
}

/**
 * The quote of a file without imports, from its first string literal (`useFileStyle`, which `ensureNamedImport` calls,
 * falls back to single quotes there; in a double-quoted file that would be a cue that is not the construct).
 */
function literalQuote(sf: SourceFile): '"' | "'" | undefined {
  if (sf.getImportDeclarations().length > 0) return undefined;
  const lit = sf.getDescendantsOfKind(SyntaxKind.StringLiteral)[0]?.getText();
  return lit === undefined ? undefined : lit.startsWith('"') ? '"' : "'";
}

/** Rewrites every import specifier of `sf` to quote `q`. */
function requote(sf: SourceFile, q: '"' | "'" | undefined): void {
  if (q === undefined) return;
  for (const d of sf.getImportDeclarations()) {
    const spec = d.getModuleSpecifier();
    if (!spec.getText().startsWith(q)) spec.replaceWithText(`${q}${d.getModuleSpecifierValue()}${q}`);
  }
}

function paramText(rule: ParamRule, names: ReadonlyMap<string, string>): { readonly name: string; readonly type: string; readonly hasQuestionToken: boolean }[] {
  return rule.params.map((p) => ({ name: p.getName(), type: substituteText(p.getTypeNodeOrThrow(), new Map(), names), hasQuestionToken: p.hasQuestionToken() }));
}

const twinFiles = (site: MutationSite): string[] => [...new Set([site.detail.sourceFile ?? '', site.detail.twinHost ?? ''])].filter((f) => f.length > 0 && f !== '!').sort();

export const AP_DUP_RULE2N: MutationOperator = {
  id: 'AP-DUP-RULE2n',
  role: 'twin',
  core: false,
  twinOf: 'AP-DUP-RULE2',
  dimension: 'integrity',
  expectedTemplates: [],
  operatorCollateral: [],
  coveredByTemplates: [],
  coverage: 'outside',
  judgeProbe: 'integrity',
  source: AP_SOURCE_DUP_RULE,
  findSites: sites,
  checkPreconditions: (handle, _spec, site) => twinCheck(handle, site),
  apply(handle, site): DomainResult<MutationEdit> {
    const r = ruleAt(handle, site);
    const sourceRel = site.detail.sourceFile ?? '';
    const source = fileAt(handle, sourceRel);
    const hostRel = site.detail.twinHost ?? '!';
    const host = fileAt(handle, hostRel);
    if (r === undefined || source === undefined || host === undefined) return fail('MUT_SITE_STALE', `rule-duplicate site ${site.filePath} is stale`);
    const rule = r.rule;
    const own = host === source;
    const types = paramTypes(rule) ?? [];
    const guard = guardOf(rule);
    const base = !own && guard !== undefined ? `assert${guard.name.slice(2)}` : `assert${upperFirst(site.detail.method ?? '')}Rule`;
    const helper = freshIn(new Set([...fileBindings(source).keys(), ...fileBindings(host).keys()]), base);
    const returnType = own ? 'void' : (assertion(rule, host) ?? 'void');
    const callArgs = rule.params.map((p) => p.getName()).join(', ');
    const ruleLocals = new Set(rule.imports.map((i) => i.local));
    let body: string;
    let params: ReturnType<typeof paramText>;
    if (own) {
      body = rule.statement.getText();
      params = paramText(rule, new Map());
    } else {
      const quote = literalQuote(host);
      useFileStyle(host);
      const bound = bindImports(handle, host, site.detail.twinHostImports);
      if (bound === undefined) return fail('MUT_SITE_STALE', `a rule name is taken in ${hostRel}`);
      requote(host, quote);
      const names = renames({ ...rule, imports: [...rule.imports, ...types] }, bound);
      body = substituteText(rule.statement, new Map(), names);
      params = paramText(rule, names);
    }
    useFileStyle(source);
    rule.statement.replaceWithText(`${helper}(${callArgs});`);
    if (!own) {
      // Import first (merged into an existing import of the host, so it keeps that line's place), then drop what the
      // moved rule was the last user of.
      const imp = ensureNamedImport(source, specifierTo(source, host), helper);
      if (imp === undefined) return fail('MUT_SITE_STALE', `${helper} is taken in ${sourceRel}`);
      dropUnused(source, ruleLocals);
    }
    useFileStyle(host);
    host.addFunction({ isExported: !own, name: helper, parameters: params, returnType, statements: body });
    return DomainResult.ok(editOf(twinFiles(site), [], decodeEdges(site.detail.twinEdges)));
  },
  plannedEdges: (site) => decodeEdges(site.detail.twinEdges),
  plannedImportUses: () => [],
  plannedFiles: twinFiles,
};

/** Exposed for the unit test and the v2 seeding report. */
export const __v2 = { planHost, guardOf, decodeEdges };
