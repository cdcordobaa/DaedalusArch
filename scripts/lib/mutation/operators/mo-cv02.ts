/**
 * MO-CV02 and its twin MO-CV02n (FR-v1.2E-24; BR-U5a-23; BR-U1-38; `business-rules.md` §3; Martin 2008).
 *
 * Sites: named classes of an application-kind layer whose name contains `Service` or `UseCase` (`detail.class`,
 * `line` = the class line). The class is renamed with a ts-morph symbol rename (references updated, file name
 * unchanged); the new name is drawn with the application RNG from the frozen rename list:
 * - **MO-CV02** (positive): `<name><suffix>` for `suffix ∈ RENAME_SUFFIXES` — contains `Service`/`UseCase`, ends with
 *   neither, so it fails FF-CV02's compiled pattern `^(?:[^/]*Service|[^/]*UseCase)$`. Expected `naming-services`
 *   keyed `(site file, '', [new name]; site-line)`.
 * - **MO-CV02n** (twin): `<prefix><name>` for `prefix ∈ TWIN_PREFIXES` (plus `Service` when the name does not
 *   already end with `Service`/`UseCase`) — conforming.
 * Both carry operator collateral `naming-conventions` keyed `(site file, '', [new name]; site-line)`.
 * Candidates equal to an existing class name are dropped (`type-shape` when none remains).
 */
import { DomainResult } from '../../../../src/shared/errors/domain-result.js';
import type { LocationRule, MutationEdit, MutationOperator, MutationSite, ParsedSpec, ProjectHandle } from '../types.js';
import { editOf, fail, layerOfFile, namedClasses, projectFiles, relOf, specView } from './common.js';
import { classAt } from './mo-so01.js';

/** Frozen rename list (mirrored in `Docs/operator-catalogue.md`). */
export const RENAME_SUFFIXES: readonly string[] = ['Impl', 'Default', 'Core'];
export const TWIN_PREFIXES: readonly string[] = ['Default', 'Core', 'Main'];

export const NAMING_ROLE = /Service|UseCase/;
const CONFORMING_END = /(?:Service|UseCase)$/;

/** Positive rename candidates of a class name (list order). */
export function positiveNames(name: string): string[] {
  return RENAME_SUFFIXES.map((s) => `${name}${s}`);
}

/** Twin rename candidates of a class name (list order). */
export function twinNames(name: string): string[] {
  return TWIN_PREFIXES.map((p) => (CONFORMING_END.test(name) ? `${p}${name}` : `${p}${name}Service`));
}

function allClassNames(handle: ProjectHandle): Set<string> {
  const out = new Set<string>();
  for (const sf of projectFiles(handle)) for (const c of namedClasses(sf)) out.add(c.getName() ?? '');
  return out;
}

function renameSites(handle: ProjectHandle, spec: ParsedSpec): MutationSite[] {
  const view = specView(spec);
  const app = new Set(view.binding.applicationLayers);
  const sites: MutationSite[] = [];
  for (const sf of projectFiles(handle)) {
    const rel = relOf(handle, sf);
    const layer = layerOfFile(view, rel);
    if (layer === null || !app.has(layer)) continue;
    for (const c of namedClasses(sf)) {
      const name = c.getName() ?? '';
      if (NAMING_ROLE.test(name)) sites.push({ filePath: rel, line: c.getStartLineNumber(), kind: 'class-rename', detail: { class: name } });
    }
  }
  return sites;
}

const classRule = (template: string): LocationRule => ({ template, filePath: 'site', discriminator: ['class'], line: 'site-line' });

function makeCv02(twin: boolean): MutationOperator {
  const candidates = (handle: ProjectHandle, site: MutationSite): string[] => {
    const name = site.detail.class ?? '';
    const taken = allClassNames(handle);
    return (twin ? twinNames(name) : positiveNames(name)).filter((n) => !taken.has(n));
  };
  return {
    id: twin ? 'MO-CV02n' : 'MO-CV02',
    role: twin ? 'twin' : 'positive',
    core: true,
    ...(twin ? { twinOf: 'MO-CV02' } : {}),
    dimension: 'convention',
    expectedTemplates: twin ? [] : [classRule('naming-services')],
    operatorCollateral: [classRule('naming-conventions')],
    coveredByTemplates: twin ? [] : ['naming-services'],
    coverage: 'in',
    source: 'Martin 2008; BR-U1-38',
    findSites: renameSites,
    checkPreconditions(handle, _spec, site) {
      if (classAt(handle, site) === undefined) return { ok: false, reason: 'type-shape' };
      return candidates(handle, site).length > 0 ? { ok: true } : { ok: false, reason: 'type-shape' };
    },
    apply(handle, site, rng): DomainResult<MutationEdit> {
      const cls = classAt(handle, site);
      const names = candidates(handle, site);
      if (cls === undefined || names.length === 0) return fail('MUT_SITE_STALE', `class ${site.detail.class ?? ''} cannot be renamed`);
      const next = rng.pick(names);
      const editedBy = new Set<string>([site.filePath]);
      for (const ref of cls.findReferencesAsNodes()) editedBy.add(relOf(handle, ref.getSourceFile()));
      cls.rename(next);
      return DomainResult.ok(editOf([...editedBy].sort(), [], [], { line: cls.getStartLineNumber(), values: { class: next } }));
    },
    plannedEdges: () => [],
    plannedFiles: (site) => [site.filePath],
  };
}

export const MO_CV02: MutationOperator = makeCv02(false);
export const MO_CV02N: MutationOperator = makeCv02(true);
