/**
 * MO-P01 and its twin MO-P01n (FR-v1.2E-24; `business-rules.md` §3; Martin 2017; Evans 2003).
 *
 * - **MO-P01**: a domain-layer file default-imports a package from the spec's `domain-purity` (FF-P01)
 *   `forbidden_imports` list (literal entries only; glob entries such as `@nestjs/*` name no single package) and
 *   exports a value reference to it. An unresolvable package gets a stub with a default export (BR-U5a-10) through
 *   `plannedImportUses`. Expected `domain-purity` keyed `(site file, package, ['IMPORTS']; site-line)`. Package
 *   edges are not File edges, so `newEdges` is empty. Restriction: the file does not already import the package
 *   (`already-imported`).
 * - **MO-P01n**: the same import in a non-controller infrastructure file (`controller-or-entity`,
 *   `already-imported`).
 */
import { Node } from 'ts-morph';
import { DomainResult } from '../../../../src/shared/errors/domain-result.js';
import type { MutationEdit, MutationOperator, MutationSite, ParsedSpec, PreconditionResult, ProjectHandle } from '../types.js';
import {
  appendValueRef,
  editOf,
  fail,
  fileAt,
  freshName,
  insertImport,
  isControllerFile,
  layerFiles,
  relOf,
  specView,
} from './common.js';

/** Literal (non-glob) entries of the spec's `domain-purity` forbidden list, sorted. */
export function forbiddenPackages(spec: ParsedSpec): string[] {
  const ff = spec.fitnessFunctions.find((f) => f.name === 'domain-purity' && f.enabled);
  return [...new Set((ff?.forbiddenImports ?? []).filter((p) => !/[*?[\]{}]/.test(p)))].sort();
}

/** A local identifier for a package's default import (`express` → `express`, `@a/b-c` → `aBC`). */
export function packageLocalName(pkg: string): string {
  const parts = pkg.replace(/^@/, '').split(/[^A-Za-z0-9]+/).filter((x) => x.length > 0);
  const camel = parts.map((x, i) => (i === 0 ? x.charAt(0).toLowerCase() + x.slice(1) : x.charAt(0).toUpperCase() + x.slice(1))).join('');
  return /^[A-Za-z_]/.test(camel) ? camel : `pkg${camel}`;
}

function packageSites(handle: ProjectHandle, spec: ParsedSpec, layer: string | undefined): MutationSite[] {
  const view = specView(spec);
  const pkgs = forbiddenPackages(spec);
  const sites: MutationSite[] = [];
  for (const sf of layerFiles(handle, view, layer)) {
    for (const pkg of pkgs) sites.push({ filePath: relOf(handle, sf), line: 1, kind: 'package-import', detail: { package: pkg } });
  }
  return sites;
}

function alreadyImported(handle: ProjectHandle, site: MutationSite): boolean {
  const sf = fileAt(handle, site.filePath);
  const pkg = site.detail.package ?? '';
  return (
    sf?.getStatements().some(
      (s) =>
        (Node.isImportDeclaration(s) || Node.isExportDeclaration(s)) &&
        (s.getModuleSpecifierValue() === pkg || (s.getModuleSpecifierValue() ?? '').startsWith(`${pkg}/`)),
    ) === true
  );
}

function applyPackageImport(handle: ProjectHandle, site: MutationSite): DomainResult<MutationEdit> {
  const sf = fileAt(handle, site.filePath);
  const pkg = site.detail.package ?? '';
  if (sf === undefined || pkg.length === 0) return fail('MUT_SITE_STALE', `site ${site.filePath} not found`);
  const local = freshName(sf, packageLocalName(pkg));
  const line = insertImport(sf, pkg, { defaultImport: local });
  appendValueRef(sf, local, `${local}Ref`);
  return DomainResult.ok(editOf([site.filePath], [], [], { line, values: { relType: 'IMPORTS' } }));
}

const plannedUses = (site: MutationSite): { specifier: string; fromFile: string; form: 'default' }[] => [
  { specifier: site.detail.package ?? '', fromFile: site.filePath, form: 'default' },
];

const packageRule = {
  template: 'domain-purity',
  filePath: 'site' as const,
  target: 'package' as const,
  discriminator: ['relType' as const],
  line: 'site-line' as const,
};

export const MO_P01: MutationOperator = {
  id: 'MO-P01',
  role: 'positive',
  core: true,
  dimension: 'pattern',
  expectedTemplates: [packageRule],
  operatorCollateral: [],
  coveredByTemplates: ['domain-purity'],
  coverage: 'in',
  source: 'Martin 2017; Evans 2003',
  findSites: (handle, spec) => packageSites(handle, spec, specView(spec).binding.domainLayer),
  checkPreconditions: (handle, _s, site): PreconditionResult => (alreadyImported(handle, site) ? { ok: false, reason: 'already-imported' } : { ok: true }),
  apply: applyPackageImport,
  plannedEdges: () => [],
  plannedImportUses: plannedUses,
  plannedFiles: (site) => [site.filePath],
};

export const MO_P01N: MutationOperator = {
  id: 'MO-P01n',
  role: 'twin',
  core: true,
  twinOf: 'MO-P01',
  dimension: 'pattern',
  expectedTemplates: [],
  operatorCollateral: [],
  coveredByTemplates: [],
  coverage: 'in',
  source: 'Martin 2017; Evans 2003',
  findSites: (handle, spec) => packageSites(handle, spec, specView(spec).binding.infraLayer),
  checkPreconditions(handle, _s, site): PreconditionResult {
    const sf = fileAt(handle, site.filePath);
    if (sf !== undefined && isControllerFile(sf, site.filePath)) return { ok: false, reason: 'controller-or-entity' };
    return alreadyImported(handle, site) ? { ok: false, reason: 'already-imported' } : { ok: true };
  },
  apply: applyPackageImport,
  plannedEdges: () => [],
  plannedImportUses: plannedUses,
  plannedFiles: (site) => [site.filePath],
};
