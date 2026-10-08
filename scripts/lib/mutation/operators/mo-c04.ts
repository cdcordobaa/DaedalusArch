/**
 * MO-C04 and its twin MO-C04n (FR-v1.2E-24; `business-rules.md` §3; Lippert and Roock 2006).
 *
 * - **MO-C04**: a new file `OrphanHelper.ts` with one exported const and no import, in a directory that already
 *   holds a layered source file and lies inside a layer, imported by nothing. Expected `no-orphan-files` keyed
 *   `(created file, '', []; none)`. Its missing test sibling is site collateral (`test-file-pairing`).
 * - **MO-C04n**: the same file, imported by an existing (non-test) module of the same layer (`detail.importer`);
 *   one planned edge importer → new file.
 * Site: `filePath` = the created path, `line` 1, `detail.directory` (and `detail.importer` for the twin).
 */
import * as path from 'node:path';
import { DomainResult } from '../../../../src/shared/errors/domain-result.js';
import type { MutationEdit, MutationOperator, MutationSite, ParsedSpec, ProjectHandle } from '../types.js';
import { editOf, fail, fileAt, insertImport, layerOfFile, projectFiles, relOf, specView, specifierTo } from './common.js';

export const ORPHAN_FILE = 'OrphanHelper.ts';
export const ORPHAN_EXPORT = 'orphanHelperValue';

function orphanDirs(handle: ProjectHandle, spec: ParsedSpec): { dir: string; created: string; layer: string }[] {
  const view = specView(spec);
  const existing = new Set(projectFiles(handle).map((sf) => relOf(handle, sf)));
  const dirs = new Map<string, { dir: string; created: string; layer: string }>();
  for (const rel of existing) {
    const dir = path.posix.dirname(rel);
    const created = `${dir}/${ORPHAN_FILE}`;
    const layer = layerOfFile(view, created);
    if (layer === null || existing.has(created) || dirs.has(dir)) continue;
    dirs.set(dir, { dir, created, layer });
  }
  return [...dirs.values()].sort((a, b) => (a.dir < b.dir ? -1 : a.dir > b.dir ? 1 : 0));
}

function createOrphan(handle: ProjectHandle, created: string): void {
  handle.project.createSourceFile(path.join(handle.root, ...created.split('/')), `export const ${ORPHAN_EXPORT} = 1;\n`);
}

export const MO_C04: MutationOperator = {
  id: 'MO-C04',
  role: 'positive',
  core: true,
  dimension: 'coupling',
  expectedTemplates: [{ template: 'no-orphan-files', filePath: 'created', line: 'none' }],
  operatorCollateral: [],
  coveredByTemplates: ['no-orphan-files'],
  coverage: 'in',
  source: 'Lippert and Roock 2006',
  findSites: (handle, spec): MutationSite[] =>
    orphanDirs(handle, spec).map((d) => ({ filePath: d.created, line: 1, kind: 'created-file', detail: { directory: d.dir } })),
  checkPreconditions: () => ({ ok: true }),
  apply(handle, site): DomainResult<MutationEdit> {
    if (fileAt(handle, site.filePath) !== undefined) return fail('MUT_SITE_STALE', `${site.filePath} already exists`);
    createOrphan(handle, site.filePath);
    return DomainResult.ok(editOf([], [site.filePath], []));
  },
  plannedEdges: () => [],
  plannedFiles: () => [],
};

export const MO_C04N: MutationOperator = {
  id: 'MO-C04n',
  role: 'twin',
  core: true,
  twinOf: 'MO-C04',
  dimension: 'coupling',
  expectedTemplates: [],
  operatorCollateral: [],
  coveredByTemplates: [],
  coverage: 'in',
  source: 'Lippert and Roock 2006',
  findSites(handle, spec): MutationSite[] {
    const view = specView(spec);
    const files = projectFiles(handle).map((sf) => relOf(handle, sf));
    const sites: MutationSite[] = [];
    for (const d of orphanDirs(handle, spec)) {
      for (const importer of files) {
        if (layerOfFile(view, importer) !== d.layer) continue;
        sites.push({ filePath: d.created, line: 1, kind: 'created-file', detail: { directory: d.dir, importer } });
      }
    }
    return sites;
  },
  checkPreconditions: () => ({ ok: true }),
  apply(handle, site): DomainResult<MutationEdit> {
    const importer = fileAt(handle, site.detail.importer ?? '');
    if (importer === undefined || fileAt(handle, site.filePath) !== undefined) return fail('MUT_SITE_STALE', `site ${site.filePath} is stale`);
    createOrphan(handle, site.filePath);
    const created = fileAt(handle, site.filePath);
    if (created === undefined) return fail('MUT_SITE_STALE', `${site.filePath} was not created`);
    insertImport(importer, specifierTo(importer, created), { named: [ORPHAN_EXPORT] });
    const imp = site.detail.importer ?? '';
    return DomainResult.ok(editOf([imp], [site.filePath], [{ source: imp, target: site.filePath }]));
  },
  plannedEdges: (site) => [{ source: site.detail.importer ?? '', target: site.filePath }],
  plannedFiles: (site) => [site.detail.importer ?? ''],
};
