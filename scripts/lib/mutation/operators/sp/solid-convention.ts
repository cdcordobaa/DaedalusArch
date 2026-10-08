/**
 * SP-* probes of the SOLID and convention templates (BR-U5a-30).
 *
 * - **SP-FF-SO01**, **SP-FF-SO02**: MO-SO01 / MO-SO02 edits (threshold arithmetic `t − b + 1`, BR-U5a-24).
 * - **SP-FF-SO03** (`inheritance-depth`): a created file `ProbeHierarchy.ts` declares the chain
 *   `ProbeLevel0 ← ProbeLevel1 ← … ← ProbeLevel<d+1>` (`d` = the spec's `max_depth`), so `ProbeLevel<d+1>` has depth
 *   `d + 1`; key `(created, '', ['ProbeLevel<d+1>']; none)`.
 * - **SP-FF-CV01** (`naming-conventions`): a domain class renamed to `<lowerFirst(name)>_probe` (references
 *   updated); key `(site, '', [new name]; site-line)`. U1 compiles every per-layer pattern to `.*` today, so the
 *   template cannot fire on a current spec (BR-U5a-05); the probe records that outcome (ADR-016 b).
 * - **SP-FF-CV02**: MO-CV02's rename.
 * - **SP-FF-CV03** (`naming-repos`): a class whose name contains `Repository`/`Repo` renamed to `<name>Impl`.
 * - **SP-FF-CV04** (`naming-controllers`): a controller-layer class gets a locally declared class decorator
 *   `@Controller()` and is renamed `<base>Handler` (`<base>` = the name without a trailing `Controller`); key
 *   `(site, '', [new name]; site-line)`.
 * - **SP-FF-CV05** (`test-file-pairing`): MO-C04n's created file (imported by an existing module), key
 *   `(created, '', []; none)`.
 * - **SP-FF-CV06** (`no-index-logic`): a created `index.ts` that re-exports a sibling and declares one function;
 *   key `(created, '', []; none)`. Under the extractor's barrel definition (every statement an import or export
 *   declaration) such a file is not a barrel, so the template cannot return it today; the probe records that
 *   outcome (ADR-016 b).
 */
import { DomainResult } from '../../../../../src/shared/errors/domain-result.js';
import type { ClassDeclaration } from 'ts-morph';
import type { MutationEdit, MutationOperator, MutationSite, ProjectHandle } from '../../types.js';
import { MO_C04N } from '../mo-c04.js';
import { MO_CV02 } from '../mo-cv02.js';
import { MO_SO01 } from '../mo-so01.js';
import { MO_SO02 } from '../mo-so02.js';
import { editOf, exportedNames, fail, fileAt, freshName, lowerFirst, namedClasses, projectFiles, relOf, specView } from '../common.js';
import { OK, classRule, createFile, fileRule, layerClasses, layeredFiles, probeFrom, probeOperator, specMaxDepth } from './common.js';
import type { SpProbe } from './common.js';

const CLEAN = 'specs/clean-arch.yaml';
const CORRECT = 'fixtures/correct-reference';

export const PROBE_HIERARCHY_FILE = 'ProbeHierarchy.ts';
export const PROBE_INDEX_FILE = 'index.ts';

function allClassNames(handle: ProjectHandle): Set<string> {
  const out = new Set<string>();
  for (const sf of projectFiles(handle)) for (const c of namedClasses(sf)) out.add(c.getName() ?? '');
  return out;
}

function classAt(handle: ProjectHandle, site: MutationSite): ClassDeclaration | undefined {
  return fileAt(handle, site.filePath)?.getClass(site.detail.class ?? '');
}

/** Renames `detail.class` to `detail.newName` with its references; key anchor at the class name line. */
function applyRename(handle: ProjectHandle, site: MutationSite, before?: (cls: ClassDeclaration) => void): DomainResult<MutationEdit> {
  const cls = classAt(handle, site);
  const next = site.detail.newName ?? '';
  if (cls === undefined || next.length === 0 || allClassNames(handle).has(next)) return fail('MUT_SITE_STALE', `class ${site.detail.class ?? ''} cannot be renamed`);
  const edited = new Set<string>([site.filePath]);
  for (const ref of cls.findReferencesAsNodes()) edited.add(relOf(handle, ref.getSourceFile()));
  before?.(cls);
  cls.rename(next);
  return DomainResult.ok(editOf([...edited].sort(), [], [], { line: cls.getNameNode()?.getStartLineNumber() ?? cls.getStartLineNumber(), values: { class: next } }));
}

function renameProbe(id: string, template: string, sites: (handle: ProjectHandle, spec: Parameters<MutationOperator['findSites']>[1]) => MutationSite[], before?: (cls: ClassDeclaration) => void): MutationOperator {
  return probeOperator(
    { id, dimension: 'convention', expectedTemplates: [classRule(template, ['class'], 'site-line')], coveredByTemplates: [template] },
    {
      findSites: (handle, spec) => {
        const taken = allClassNames(handle);
        return sites(handle, spec).filter((s) => !taken.has(s.detail.newName ?? ''));
      },
      checkPreconditions: () => OK,
      apply: (handle, site) => applyRename(handle, site, before),
      plannedEdges: () => [],
      plannedFiles: (site) => [site.filePath],
    },
  );
}

export const SP_SO01: MutationOperator = probeFrom(MO_SO01, {
  id: 'SP-FF-SO01',
  dimension: 'solid',
  expectedTemplates: MO_SO01.expectedTemplates,
  coveredByTemplates: ['single-responsibility-proxy'],
});

export const SP_SO02: MutationOperator = probeFrom(MO_SO02, {
  id: 'SP-FF-SO02',
  dimension: 'solid',
  expectedTemplates: MO_SO02.expectedTemplates,
  coveredByTemplates: ['interface-segregation-proxy'],
});

export const SP_SO03: MutationOperator = probeOperator(
  { id: 'SP-FF-SO03', dimension: 'solid', expectedTemplates: [classRule('inheritance-depth', ['class'], 'none', 'created')], coveredByTemplates: ['inheritance-depth'] },
  {
    findSites(handle, spec): MutationSite[] {
      const maxDepth = specMaxDepth(spec);
      const first = layeredFiles(handle, spec)[0];
      if (maxDepth === undefined || first === undefined) return [];
      const created = `${first.rel.slice(0, first.rel.lastIndexOf('/'))}/${PROBE_HIERARCHY_FILE}`;
      if (fileAt(handle, created) !== undefined) return [];
      return [{ filePath: created, line: 1, kind: 'created-file', detail: { maxDepth: String(maxDepth), class: `ProbeLevel${String(maxDepth + 1)}` } }];
    },
    checkPreconditions: () => OK,
    apply(handle, site): DomainResult<MutationEdit> {
      if (fileAt(handle, site.filePath) !== undefined) return fail('MUT_SITE_STALE', `${site.filePath} already exists`);
      const levels = Number(site.detail.maxDepth) + 1;
      const lines = ['export class ProbeLevel0 {}'];
      for (let i = 1; i <= levels; i++) lines.push(`export class ProbeLevel${String(i)} extends ProbeLevel${String(i - 1)} {}`);
      createFile(handle, site.filePath, lines.join('\n') + '\n');
      return DomainResult.ok(editOf([], [site.filePath], [], { values: { class: site.detail.class ?? '' } }));
    },
    plannedEdges: () => [],
    plannedFiles: () => [],
  },
);

export const SP_CV01: MutationOperator = renameProbe('SP-FF-CV01', 'naming-conventions', (handle, spec) => {
  const domain = specView(spec).binding.domainLayer;
  if (domain === undefined) return [];
  return layerClasses(handle, spec, [domain]).map((c) => ({
    filePath: c.file,
    line: c.cls.getStartLineNumber(),
    kind: 'class-rename' as const,
    detail: { class: c.name, newName: `${lowerFirst(c.name)}_probe` },
  }));
});

export const SP_CV02: MutationOperator = probeFrom(MO_CV02, {
  id: 'SP-FF-CV02',
  dimension: 'convention',
  expectedTemplates: MO_CV02.expectedTemplates,
  coveredByTemplates: ['naming-services'],
});

export const SP_CV03: MutationOperator = renameProbe('SP-FF-CV03', 'naming-repos', (handle, spec) =>
  layeredFiles(handle, spec).flatMap((f) =>
    namedClasses(f.sf)
      .filter((c) => (c.getName() ?? '').includes('Repository') || (c.getName() ?? '').includes('Repo'))
      .map((c) => ({ filePath: f.rel, line: c.getStartLineNumber(), kind: 'class-rename' as const, detail: { class: c.getName() ?? '', newName: `${c.getName() ?? ''}Impl` } })),
  ),
);

/** Inserts `function <Controller>(): (target: unknown, context: ClassDecoratorContext) => void` and decorates the class. */
function decorateAsController(cls: ClassDeclaration): void {
  const sf = cls.getSourceFile();
  const name = freshName(sf, 'Controller');
  sf.insertStatements(cls.getChildIndex(), [
    `function ${name}(): (target: unknown, context: ClassDecoratorContext) => void {`,
    '  return () => undefined;',
    '}',
    '',
  ]);
  cls.addDecorator({ name, arguments: [] });
}

export const SP_CV04: MutationOperator = renameProbe(
  'SP-FF-CV04',
  'naming-controllers',
  (handle, spec) => {
    const ctrl = specView(spec).binding.controllerLayer;
    if (ctrl === undefined) return [];
    return layerClasses(handle, spec, [ctrl])
      .filter((c) => c.cls.getDecorators().length === 0)
      .map((c) => ({
        filePath: c.file,
        line: c.cls.getStartLineNumber(),
        kind: 'class-rename' as const,
        detail: { class: c.name, newName: `${c.name.replace(/Controller$/, '')}Handler` },
      }));
  },
  decorateAsController,
);

export const SP_CV05: MutationOperator = probeFrom(MO_C04N, {
  id: 'SP-FF-CV05',
  dimension: 'convention',
  expectedTemplates: [fileRule('test-file-pairing', 'created')],
  coveredByTemplates: ['test-file-pairing'],
});

export const SP_CV06: MutationOperator = probeOperator(
  { id: 'SP-FF-CV06', dimension: 'convention', expectedTemplates: [fileRule('no-index-logic', 'created')], coveredByTemplates: ['no-index-logic'] },
  {
    findSites(handle, spec): MutationSite[] {
      const seen = new Set<string>();
      const sites: MutationSite[] = [];
      for (const f of layeredFiles(handle, spec)) {
        const dir = f.rel.slice(0, f.rel.lastIndexOf('/'));
        const created = `${dir}/${PROBE_INDEX_FILE}`;
        const symbol = exportedNames(f.sf)[0];
        if (seen.has(dir) || symbol === undefined || fileAt(handle, created) !== undefined) continue;
        seen.add(dir);
        sites.push({ filePath: created, line: 1, kind: 'created-file', detail: { directory: dir, reExportFrom: f.rel, symbol } });
      }
      return sites;
    },
    checkPreconditions: () => OK,
    apply(handle, site): DomainResult<MutationEdit> {
      const from = site.detail.reExportFrom ?? '';
      const target = fileAt(handle, from);
      if (target === undefined || fileAt(handle, site.filePath) !== undefined) return fail('MUT_SITE_STALE', `site ${site.filePath} is stale`);
      const base = from.slice(from.lastIndexOf('/') + 1).replace(/\.ts$/, '');
      createFile(handle, site.filePath, [`export { ${site.detail.symbol ?? ''} } from './${base}';`, '', 'export function probeIndexLogic(): number {', '  return 1;', '}', ''].join('\n'));
      return DomainResult.ok(editOf([], [site.filePath], [{ source: site.filePath, target: from }]));
    },
    plannedEdges: (site) => [{ source: site.filePath, target: site.detail.reExportFrom ?? '' }],
    plannedFiles: () => [],
  },
);

export const SOLID_CONVENTION_PROBES: readonly SpProbe[] = [
  { op: SP_SO01, targetTemplate: 'single-responsibility-proxy', spec: CLEAN, fixture: CORRECT, declaredBy: 'expected', edit: 'class gains max_public_methods − base + 1 methods (MO-SO01 edit)' },
  { op: SP_SO02, targetTemplate: 'interface-segregation-proxy', spec: CLEAN, fixture: CORRECT, declaredBy: 'expected', edit: 'interface gains max_interface_methods − base + 1 signatures (MO-SO02 edit)' },
  { op: SP_SO03, targetTemplate: 'inheritance-depth', spec: CLEAN, fixture: CORRECT, declaredBy: 'expected', edit: `created ${PROBE_HIERARCHY_FILE} declares an extends chain of max_depth + 1 levels` },
  { op: SP_CV01, targetTemplate: 'naming-conventions', spec: CLEAN, fixture: CORRECT, declaredBy: 'expected', edit: 'domain class renamed to <lowerFirst(name)>_probe (cannot fire while U1 compiles the per-layer patterns to .*)' },
  { op: SP_CV02, targetTemplate: 'naming-services', spec: CLEAN, fixture: CORRECT, declaredBy: 'expected', edit: 'application class renamed off the service pattern (MO-CV02 edit)' },
  { op: SP_CV03, targetTemplate: 'naming-repos', spec: CLEAN, fixture: CORRECT, declaredBy: 'expected', edit: 'repository class renamed to <name>Impl' },
  { op: SP_CV04, targetTemplate: 'naming-controllers', spec: CLEAN, fixture: CORRECT, declaredBy: 'expected', edit: 'controller class decorated with a local @Controller() and renamed <base>Handler' },
  { op: SP_CV05, targetTemplate: 'test-file-pairing', spec: CLEAN, fixture: CORRECT, declaredBy: 'expected', edit: 'created file without a test sibling, imported by an existing module (MO-C04n edit)' },
  {
    op: SP_CV06,
    targetTemplate: 'no-index-logic',
    spec: CLEAN,
    fixture: CORRECT,
    declaredBy: 'expected',
    edit: 'created index.ts re-exports a sibling and declares one function (not a barrel by the extractor definition, so it cannot fire today)',
  },
];
