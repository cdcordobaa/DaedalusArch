/**
 * AP-DUP-RULE and its twin AP-DUP-RULEn (v1.3 DRAFT; Integrity; Hunt and Thomas 1999; Fowler 1999; Evans 2003).
 *
 * - **AP-DUP-RULE** (`rule-duplicate`): a parameter rule of a service method (`antipatterns/common.ts`) is copied,
 *   verbatim, into a second service class of another file as a public method
 *   `validate<Method>(<the rule's parameters>): void { <rule> }`. The original stays, so the invariant now lives in
 *   two services. The names the rule and its parameter types use (package names, exported project types, enums or
 *   constants) are imported into the second file.
 * - **AP-DUP-RULEn**: the rule moves once into an exported helper of the first file
 *   (`export function assert<Method>Rule(<params>): void { <rule> }`), the first method calls it in place of the rule,
 *   and the second service gains the same `validate<Method>` method calling the shared helper (an import of the first
 *   file, plus the parameter types). The rule exists once.
 *
 * Restrictions: every parameter of the rule has a type annotation writable in the second file (`type-shape`); the
 * names to import are free there (`type-shape`); added project imports pass the cycle cap. No template compares rule
 * bodies across files, so no key is expected.
 */
import { DomainResult } from '../../../../src/shared/errors/domain-result.js';
import type { MutationEdit, MutationOperator, MutationSite, ParsedSpec, PreconditionResult, ProjectHandle } from '../types.js';
import { editOf, fail, fileAt, relOf, specView, specifierTo } from '../operators/common.js';
import { renames } from './ap-fat-controller.js';
import { memberNames } from './ap-persist-in-domain.js';
import {
  bindImports,
  bodyMethods,
  encodeImports,
  ensureNamedImport,
  fileBindings,
  freshIn,
  importsFree,
  paramRuleAt,
  paramRules,
  plannedFileEdges,
  plannedPackageUses,
  serviceClasses,
  substituteText,
  typeImports,
  upperFirst,
  useFileStyle,
} from './common.js';
import type { ParamRule, RuleImport } from './common.js';

export const AP_SOURCE_DUP_RULE = 'Hunt and Thomas 1999; Fowler 1999; Evans 2003';

/** Imports the parameter types of a rule need elsewhere, or undefined when one is not writable. */
function paramTypeImports(rule: ParamRule): RuleImport[] | undefined {
  const out: RuleImport[] = [];
  for (const p of rule.params) {
    const t = typeImports(p);
    if (t === undefined) return undefined;
    out.push(...t);
  }
  return out;
}

function sites(handle: ProjectHandle, spec: ParsedSpec): MutationSite[] {
  const services = serviceClasses(handle, specView(spec));
  const rel = (abs: string): string => relOf(handle, handle.project.getSourceFileOrThrow(abs));
  const out: MutationSite[] = [];
  for (const s1 of services) {
    for (const m of bodyMethods(s1.cls)) {
      for (const rule of paramRules(m)) {
        const types = paramTypeImports(rule);
        const imports = types === undefined ? undefined : encodeImports([...rule.imports, ...types], rel);
        const typeOnly = types === undefined ? undefined : encodeImports(types, rel);
        for (const s2 of services) {
          if (s2.file === s1.file) continue;
          out.push({
            filePath: s2.file,
            line: s2.cls.getStartLineNumber(),
            kind: 'rule-duplicate',
            detail: {
              class: s2.cls.getName() ?? '',
              sourceFile: s1.file,
              sourceClass: s1.cls.getName() ?? '',
              method: m.getName(),
              guard: String(rule.index),
              // '!' marks a rule whose parameter types cannot be written in another file (rejected `type-shape`).
              imports: imports ?? '!',
              typeImports: typeOnly ?? '!',
            },
          });
        }
      }
    }
  }
  return out;
}

function ruleAt(handle: ProjectHandle, site: MutationSite): ReturnType<typeof paramRuleAt> {
  return paramRuleAt(fileAt(handle, site.detail.sourceFile ?? ''), site.detail.sourceClass ?? '', site.detail.method ?? '', Number(site.detail.guard ?? '-1'));
}

function check(handle: ProjectHandle, site: MutationSite, key: 'imports' | 'typeImports'): PreconditionResult {
  const r = ruleAt(handle, site);
  const target = fileAt(handle, site.filePath);
  if (r === undefined || target?.getClass(site.detail.class ?? '') === undefined) return { ok: false, reason: 'type-shape' };
  const text = site.detail[key];
  if (text === '!' || !importsFree(handle, target, text)) return { ok: false, reason: 'type-shape' };
  return { ok: true };
}

/** Parameter structures with each imported type name renamed to its local name in the target file. */
function paramList(rule: ParamRule, names: ReadonlyMap<string, string>): { readonly name: string; readonly type: string; readonly hasQuestionToken: boolean }[] {
  return rule.params.map((p) => ({ name: p.getName(), type: substituteText(p.getTypeNodeOrThrow(), new Map(), names), hasQuestionToken: p.hasQuestionToken() }));
}

const methodName = (site: MutationSite): string => `validate${upperFirst(site.detail.method ?? '')}`;

export const AP_DUP_RULE: MutationOperator = {
  id: 'AP-DUP-RULE',
  role: 'positive',
  core: false,
  dimension: 'integrity',
  expectedTemplates: [],
  operatorCollateral: [],
  coveredByTemplates: [],
  coverage: 'outside',
  judgeProbe: 'integrity',
  source: AP_SOURCE_DUP_RULE,
  findSites: sites,
  checkPreconditions: (handle, _spec, site) => check(handle, site, 'imports'),
  apply(handle, site): DomainResult<MutationEdit> {
    const r = ruleAt(handle, site);
    const target = fileAt(handle, site.filePath);
    const cls = target?.getClass(site.detail.class ?? '');
    if (r === undefined || target === undefined || cls === undefined) return fail('MUT_SITE_STALE', `rule-duplicate site ${site.filePath} is stale`);
    const types = paramTypeImports(r.rule) ?? [];
    useFileStyle(target);
    const bound = bindImports(handle, target, site.detail.imports);
    if (bound === undefined) return fail('MUT_SITE_STALE', `a rule name is taken in ${site.filePath}`);
    const names = renames({ ...r.rule, imports: [...r.rule.imports, ...types] }, bound);
    const body = substituteText(r.rule.statement, new Map(), names);
    cls.addMethod({ name: freshIn(memberNames(cls), methodName(site)), parameters: paramList(r.rule, names), returnType: 'void', statements: body });
    return DomainResult.ok(editOf([site.filePath], [], plannedFileEdges(site.detail.imports, site.filePath)));
  },
  plannedEdges: (site) => plannedFileEdges(site.detail.imports, site.filePath),
  plannedImportUses: (site) => plannedPackageUses(site.detail.imports, site.filePath),
  plannedFiles: (site) => [site.filePath],
};

const twinFiles = (site: MutationSite): string[] => [...new Set([site.filePath, site.detail.sourceFile ?? ''])].sort();

function twinEdges(site: MutationSite): { source: string; target: string }[] {
  const edges = plannedFileEdges(site.detail.typeImports, site.filePath);
  const source = site.detail.sourceFile ?? '';
  return edges.some((e) => e.target === source) ? edges : [...edges, { source: site.filePath, target: source }];
}

export const AP_DUP_RULEN: MutationOperator = {
  id: 'AP-DUP-RULEn',
  role: 'twin',
  core: false,
  twinOf: 'AP-DUP-RULE',
  dimension: 'integrity',
  expectedTemplates: [],
  operatorCollateral: [],
  coveredByTemplates: [],
  coverage: 'outside',
  judgeProbe: 'integrity',
  source: AP_SOURCE_DUP_RULE,
  findSites: sites,
  checkPreconditions: (handle, _spec, site) => check(handle, site, 'typeImports'),
  apply(handle, site): DomainResult<MutationEdit> {
    const r = ruleAt(handle, site);
    const source = fileAt(handle, site.detail.sourceFile ?? '');
    const target = fileAt(handle, site.filePath);
    const cls = target?.getClass(site.detail.class ?? '');
    if (r === undefined || source === undefined || target === undefined || cls === undefined) return fail('MUT_SITE_STALE', `rule-duplicate site ${site.filePath} is stale`);
    const types = paramTypeImports(r.rule) ?? [];
    const own = new Map(r.rule.params.map((p) => [p.getName(), p.getName()]));
    const sourceParams = paramList(r.rule, own);
    const names = sourceParams.map((p) => p.name).join(', ');
    const helper = freshIn(new Set([...fileBindings(source).keys(), ...fileBindings(target).keys()]), `assert${upperFirst(site.detail.method ?? '')}Rule`);
    const ruleText = r.rule.statement.getText();
    const bound = bindImports(handle, target, site.detail.typeImports);
    if (bound === undefined) return fail('MUT_SITE_STALE', `a type name is taken in ${site.filePath}`);
    const targetParams = paramList(r.rule, renames({ ...r.rule, imports: types }, bound));
    useFileStyle(source);
    r.rule.statement.replaceWithText(`${helper}(${names});`);
    source.addFunction({ isExported: true, name: helper, parameters: sourceParams, returnType: 'void', statements: ruleText });
    const imp = ensureNamedImport(target, specifierTo(target, source), helper);
    if (imp === undefined) return fail('MUT_SITE_STALE', `${helper} is taken in ${site.filePath}`);
    useFileStyle(target);
    cls.addMethod({ name: freshIn(memberNames(cls), methodName(site)), parameters: targetParams, returnType: 'void', statements: `${imp.local}(${names});` });
    return DomainResult.ok(editOf(twinFiles(site), [], twinEdges(site)));
  },
  plannedEdges: twinEdges,
  plannedImportUses: (site) => plannedPackageUses(site.detail.typeImports, site.filePath),
  plannedFiles: twinFiles,
};
