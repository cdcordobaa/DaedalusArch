/**
 * SP-* probes of the pattern templates (BR-U5a-30): `domain-purity`, `dependency-inversion` (ratio, seeded by a
 * stated amount), `repository-pattern`, `use-case-isolation`, `controller-no-entity`, and SP-DF01-ci
 * (`domain-state-purity`, the FR-21 data-flow check; U3 adds the template).
 *
 * - **SP-FF-P01**: MO-P01's edit (domain file default-imports a forbidden package).
 * - **SP-FF-P02**: an application-layer class with constructor injections `i` interfaces of `t` gains the smallest
 *   number `n` of concrete domain-class injections with `i / (t + n) < threshold` (`detail.amount`); key
 *   `(site, '', [class]; none)`. Preconditions: `metric-already-violating` (`i / t < threshold` in the base),
 *   `threshold-arithmetic` (fewer than `n` domain classes to inject), `type-shape` (the class is constructed with
 *   `new` somewhere, so a new parameter would break the call).
 * - **SP-FF-P03**: an infrastructure class whose name contains `Repository`/`Repo` loses its `implements` clause;
 *   key `(site, '', [implementation]; none)`.
 * - **SP-FF-P04**: a use-case class (name contains `UseCase`, `Service` or `Handler`, U1's default roles) of an
 *   application layer gains a constructor injection of an outer-layer class; key `(site, '', [useCase]; none)`.
 *   Preconditions: `metric-already-violating` (already injects an outer-layer type), `type-shape` as above.
 * - **SP-FF-P05**: a controller class of the controller layer gains a constructor injection of a domain class whose
 *   name carries an entity role (U1's `Entity`, `Aggregate`, `ValueObject`); when the domain layer has none, the
 *   probe creates `ProbeEntity.ts` next to the first domain file; key `(site, '', [controller, entity]; none)`.
 * - **SP-DF01-ci** (constructor injection, U3 BR-U3-22): a domain class with a constructor gains a parameter
 *   `private readonly probe<Type>: <Type>` of an exported infrastructure class or interface; key
 *   `(site, target file, [class, targetName, 'CONSTRUCTOR_INJECTS', parameter name]; none)` (injection rows carry no
 *   line, U3 hand-off). Precondition `type-shape` when the domain class is constructed with `new` somewhere.
 */
import { DomainResult } from '../../../../../src/shared/errors/domain-result.js';
import type { MutationEdit, MutationOperator, MutationSite, PreconditionResult } from '../../types.js';
import { MO_P01 } from '../mo-p01.js';
import { ENTITY_ROLES, editOf, fail, fileAt, hasEntityRole, specView } from '../common.js';
import {
  OK,
  classRule,
  createFile,
  firstDirOfLayer,
  importsFile,
  injectParameters,
  injectedTypes,
  isConstructedAnywhere,
  layerClasses,
  layeredFiles,
  probeFrom,
  probeOperator,
  specThreshold,
} from './common.js';
import type { SpProbe } from './common.js';

const CLEAN = 'specs/clean-arch.yaml';
const CORRECT = 'fixtures/correct-reference';

/** U1's default use-case roles (`fitness-compiler.ts` `useCaseRoles`). */
export const USE_CASE_ROLES: readonly string[] = ['UseCase', 'Service', 'Handler'];
/** Name of the entity class SP-FF-P05 creates when the domain layer has no entity-role class. */
export const PROBE_ENTITY = 'ProbeEntity';

/** `Name=path;Name=path` ↔ list (site detail values are strings). */
function encodeDeps(deps: readonly { readonly typeName: string; readonly file: string }[]): string {
  return deps.map((d) => `${d.typeName}=${d.file}`).join(';');
}
function decodeDeps(text: string | undefined): { typeName: string; file: string }[] {
  if (text === undefined || text.length === 0) return [];
  return text.split(';').map((p) => {
    const i = p.indexOf('=');
    return { typeName: p.slice(0, i), file: p.slice(i + 1) };
  });
}

/** Files of `deps` the site file does not import yet (the planned edges). */
function newImportTargets(handle: Parameters<MutationOperator['findSites']>[0], siteRel: string, deps: readonly { readonly file: string }[]): string[] {
  const sf = fileAt(handle, siteRel);
  const out: string[] = [];
  for (const d of deps) {
    const t = fileAt(handle, d.file);
    if (sf === undefined || t === undefined || t === sf || importsFile(sf, t) || out.includes(d.file)) continue;
    out.push(d.file);
  }
  return out;
}

function plannedFromDetail(site: MutationSite): { source: string; target: string }[] {
  const targets = site.detail.newImports ?? '';
  return targets.length === 0 ? [] : targets.split(';').map((target) => ({ source: site.filePath, target }));
}

/** Injects `detail.deps` into `detail.class`; the planned edges are `detail.newImports`. */
function applyInjection(handle: Parameters<MutationOperator['apply']>[0], site: MutationSite, keyValues: Readonly<Record<string, string>>): DomainResult<MutationEdit> {
  const sf = fileAt(handle, site.filePath);
  const cls = sf?.getClass(site.detail.class ?? '');
  if (sf === undefined || cls === undefined || cls.getConstructors().length === 0) return fail('MUT_SITE_STALE', `site ${site.filePath} has no constructor class ${site.detail.class ?? ''}`);
  const { edges, names } = injectParameters(handle, cls, site.filePath, decodeDeps(site.detail.deps));
  return DomainResult.ok(editOf([site.filePath], [], edges, { values: { ...keyValues, field: names[0] ?? '' } }));
}

export const SP_P01: MutationOperator = probeFrom(MO_P01, {
  id: 'SP-FF-P01',
  dimension: 'pattern',
  expectedTemplates: MO_P01.expectedTemplates,
  coveredByTemplates: ['domain-purity'],
});

export const SP_P02: MutationOperator = probeOperator(
  { id: 'SP-FF-P02', dimension: 'pattern', expectedTemplates: [classRule('dependency-inversion', ['class'])], coveredByTemplates: ['dependency-inversion'] },
  {
    findSites(handle, spec): MutationSite[] {
      const view = specView(spec);
      const threshold = specThreshold(spec, 'dependency-inversion');
      if (threshold === undefined || view.binding.domainLayer === undefined) return [];
      const domainClasses = layerClasses(handle, spec, [view.binding.domainLayer]);
      const sites: MutationSite[] = [];
      for (const c of layerClasses(handle, spec, view.binding.applicationLayers)) {
        if (c.cls.getConstructors().length === 0) continue;
        const injected = injectedTypes(handle, c.cls);
        const i = injected.filter((x) => x.kind === 'interface').length;
        const t = injected.length;
        let amount = 1;
        while (i / (t + amount) >= threshold && amount < 1000) amount++;
        const available = domainClasses.filter((d) => !injected.some((x) => x.name === d.name && x.file === d.file) && d.file !== c.file);
        const deps = available.slice(0, amount).map((d) => ({ typeName: d.name, file: d.file }));
        sites.push({
          filePath: c.file,
          line: c.cls.getStartLineNumber(),
          kind: 'class-members',
          detail: {
            class: c.name,
            threshold: String(threshold),
            interfaceDeps: String(i),
            totalDeps: String(t),
            amount: String(amount),
            deps: encodeDeps(deps),
            newImports: newImportTargets(handle, c.file, deps).join(';'),
          },
        });
      }
      return sites;
    },
    checkPreconditions(handle, _spec, site): PreconditionResult {
      const i = Number(site.detail.interfaceDeps);
      const t = Number(site.detail.totalDeps);
      if (t > 0 && i / t < Number(site.detail.threshold)) return { ok: false, reason: 'metric-already-violating' };
      if (decodeDeps(site.detail.deps).length < Number(site.detail.amount)) return { ok: false, reason: 'threshold-arithmetic' };
      if (isConstructedAnywhere(handle, site.detail.class ?? '')) return { ok: false, reason: 'type-shape' };
      return OK;
    },
    apply: (handle, site) => applyInjection(handle, site, { class: site.detail.class ?? '' }),
    plannedEdges: plannedFromDetail,
    plannedFiles: (site) => [site.filePath],
  },
);

export const SP_P03: MutationOperator = probeOperator(
  { id: 'SP-FF-P03', dimension: 'pattern', expectedTemplates: [classRule('repository-pattern', ['implementation'])], coveredByTemplates: ['repository-pattern'] },
  {
    findSites(handle, spec): MutationSite[] {
      const infra = specView(spec).binding.infraLayer;
      if (infra === undefined) return [];
      return layerClasses(handle, spec, [infra])
        .filter((c) => (c.name.includes('Repository') || c.name.includes('Repo')) && c.cls.getImplements().length > 0)
        .map((c) => ({ filePath: c.file, line: c.cls.getStartLineNumber(), kind: 'class-members' as const, detail: { implementation: c.name } }));
    },
    checkPreconditions: () => OK,
    apply(handle, site): DomainResult<MutationEdit> {
      const cls = fileAt(handle, site.filePath)?.getClass(site.detail.implementation ?? '');
      if (cls === undefined || cls.getImplements().length === 0) return fail('MUT_SITE_STALE', `site ${site.filePath} has no implementing class`);
      for (let i = cls.getImplements().length - 1; i >= 0; i--) cls.removeImplements(i);
      return DomainResult.ok(editOf([site.filePath], [], [], { values: { implementation: site.detail.implementation ?? '' } }));
    },
    plannedEdges: () => [],
    plannedFiles: (site) => [site.filePath],
  },
);

export const SP_P04: MutationOperator = probeOperator(
  { id: 'SP-FF-P04', dimension: 'pattern', expectedTemplates: [classRule('use-case-isolation', ['useCase'])], coveredByTemplates: ['use-case-isolation'] },
  {
    findSites(handle, spec): MutationSite[] {
      const view = specView(spec);
      const { domainLayer, applicationLayers } = view.binding;
      if (domainLayer === undefined || applicationLayers.length === 0) return [];
      const outer = layeredFiles(handle, spec)
        .filter((f) => f.layer !== domainLayer && !applicationLayers.includes(f.layer))
        .map((f) => f.layer);
      const outerClasses = layerClasses(handle, spec, [...new Set(outer)]);
      const sites: MutationSite[] = [];
      for (const c of layerClasses(handle, spec, applicationLayers)) {
        if (!USE_CASE_ROLES.some((r) => c.name.includes(r)) || c.cls.getConstructors().length === 0) continue;
        const injected = injectedTypes(handle, c.cls);
        const already = injected.some((x) => outerClasses.some((o) => o.file === x.file)) ? 'yes' : 'no';
        for (const o of outerClasses) {
          const deps = [{ typeName: o.name, file: o.file }];
          sites.push({
            filePath: c.file,
            line: c.cls.getStartLineNumber(),
            kind: 'class-members',
            detail: { class: c.name, useCase: c.name, deps: encodeDeps(deps), newImports: newImportTargets(handle, c.file, deps).join(';'), alreadyOuter: already },
          });
        }
      }
      return sites;
    },
    checkPreconditions(handle, _spec, site): PreconditionResult {
      if (site.detail.alreadyOuter === 'yes') return { ok: false, reason: 'metric-already-violating' };
      if (isConstructedAnywhere(handle, site.detail.class ?? '')) return { ok: false, reason: 'type-shape' };
      return OK;
    },
    apply: (handle, site) => applyInjection(handle, site, { useCase: site.detail.useCase ?? '' }),
    plannedEdges: plannedFromDetail,
    plannedFiles: (site) => [site.filePath],
  },
);

export const SP_P05: MutationOperator = probeOperator(
  {
    id: 'SP-FF-P05',
    dimension: 'pattern',
    expectedTemplates: [classRule('controller-no-entity', ['controller', 'entity'])],
    coveredByTemplates: ['controller-no-entity'],
  },
  {
    findSites(handle, spec): MutationSite[] {
      const { controllerLayer, domainLayer } = specView(spec).binding;
      if (controllerLayer === undefined || domainLayer === undefined) return [];
      const entities = layerClasses(handle, spec, [domainLayer]).filter((c) => hasEntityRole(c.name));
      const domainDir = firstDirOfLayer(handle, spec, domainLayer);
      const entity =
        entities[0] !== undefined
          ? { name: entities[0].name, file: entities[0].file, create: 'no' }
          : domainDir === undefined
            ? undefined
            : { name: PROBE_ENTITY, file: `${domainDir}/${PROBE_ENTITY}.ts`, create: 'yes' };
      if (entity === undefined || (entity.create === 'yes' && fileAt(handle, entity.file) !== undefined)) return [];
      return layerClasses(handle, spec, [controllerLayer])
        .filter((c) => c.cls.getConstructors().length > 0 && !hasEntityRole(c.name))
        .map((c) => {
          const deps = [{ typeName: entity.name, file: entity.file }];
          return {
            filePath: c.file,
            line: c.cls.getStartLineNumber(),
            kind: 'class-members' as const,
            detail: {
              class: c.name,
              controller: c.name,
              entity: entity.name,
              createEntity: entity.create,
              deps: encodeDeps(deps),
              newImports: entity.create === 'yes' ? entity.file : newImportTargets(handle, c.file, deps).join(';'),
            },
          };
        });
    },
    checkPreconditions: (handle, _spec, site): PreconditionResult => (isConstructedAnywhere(handle, site.detail.class ?? '') ? { ok: false, reason: 'type-shape' } : OK),
    apply(handle, site): DomainResult<MutationEdit> {
      const dep = decodeDeps(site.detail.deps)[0];
      if (dep === undefined) return fail('MUT_SITE_STALE', `site ${site.filePath} names no entity`);
      if (site.detail.createEntity === 'yes') {
        if (fileAt(handle, dep.file) !== undefined) return fail('MUT_SITE_STALE', `${dep.file} already exists`);
        createFile(handle, dep.file, `export class ${dep.typeName} {\n  constructor(public readonly id: string) {}\n}\n`);
      }
      const r = applyInjection(handle, site, { controller: site.detail.controller ?? '', entity: site.detail.entity ?? '' });
      if (!r.success) return r;
      const created = site.detail.createEntity === 'yes' ? [dep.file] : [];
      return DomainResult.ok({ ...r.data, createdFiles: created });
    },
    plannedEdges: plannedFromDetail,
    plannedFiles: (site) => [site.filePath],
  },
);

export const SP_DF01_CI: MutationOperator = probeOperator(
  {
    id: 'SP-DF01-ci',
    dimension: 'pattern',
    expectedTemplates: [{ template: 'domain-state-purity', filePath: 'site', target: 'site-target', discriminator: ['class', 'targetName', 'relType', 'field'], line: 'none' }],
    coveredByTemplates: ['domain-state-purity'],
  },
  {
    findSites(handle, spec): MutationSite[] {
      const { domainLayer, infraLayer } = specView(spec).binding;
      if (domainLayer === undefined || infraLayer === undefined) return [];
      const targets = layeredFiles(handle, spec)
        .filter((f) => f.layer === infraLayer)
        .flatMap((f) => [...f.sf.getClasses(), ...f.sf.getInterfaces()].filter((d) => d.isExported() && (d.getName() ?? '') !== '').map((d) => ({ typeName: d.getName() ?? '', file: f.rel })));
      const sites: MutationSite[] = [];
      for (const c of layerClasses(handle, spec, [domainLayer])) {
        if (c.cls.getConstructors().length === 0) continue;
        for (const t of targets) {
          sites.push({
            filePath: c.file,
            line: c.cls.getStartLineNumber(),
            kind: 'field-new',
            detail: { class: c.name, targetFile: t.file, targetName: t.typeName, deps: encodeDeps([t]), newImports: newImportTargets(handle, c.file, [t]).join(';') },
          });
        }
      }
      return sites;
    },
    checkPreconditions: (handle, _spec, site): PreconditionResult => (isConstructedAnywhere(handle, site.detail.class ?? '') ? { ok: false, reason: 'type-shape' } : OK),
    apply: (handle, site) => applyInjection(handle, site, { class: site.detail.class ?? '', targetName: site.detail.targetName ?? '', relType: 'CONSTRUCTOR_INJECTS' }),
    plannedEdges: plannedFromDetail,
    plannedFiles: (site) => [site.filePath],
  },
);

export const PATTERN_PROBES: readonly SpProbe[] = [
  { op: SP_P01, targetTemplate: 'domain-purity', spec: CLEAN, fixture: CORRECT, declaredBy: 'expected', edit: 'domain file default-imports a forbidden package (MO-P01 edit)' },
  {
    op: SP_P02,
    targetTemplate: 'dependency-inversion',
    spec: CLEAN,
    fixture: CORRECT,
    declaredBy: 'expected',
    edit: 'application class gains the smallest number n of concrete domain-class constructor injections with interfaceDeps / (totalDeps + n) < threshold (n in detail.amount)',
  },
  { op: SP_P03, targetTemplate: 'repository-pattern', spec: CLEAN, fixture: CORRECT, declaredBy: 'expected', edit: 'infrastructure repository class loses its implements clause' },
  {
    op: SP_P04,
    targetTemplate: 'use-case-isolation',
    spec: CLEAN,
    fixture: CORRECT,
    declaredBy: 'expected',
    edit: 'use-case class gains a constructor injection of an outer-layer (infrastructure) class',
  },
  {
    op: SP_P05,
    targetTemplate: 'controller-no-entity',
    spec: CLEAN,
    fixture: CORRECT,
    declaredBy: 'expected',
    edit: `controller gains a constructor injection of a domain class with an entity role (${ENTITY_ROLES.join(', ')}); ${PROBE_ENTITY}.ts is created next to the first domain file when none exists`,
  },
  {
    op: SP_DF01_CI,
    targetTemplate: 'domain-state-purity',
    spec: CLEAN,
    fixture: CORRECT,
    declaredBy: 'expected',
    edit: 'domain class gains a constructor parameter of an infrastructure class or interface (CONSTRUCTOR_INJECTS; no line)',
  },
];

