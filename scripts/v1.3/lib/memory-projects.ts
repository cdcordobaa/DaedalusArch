/**
 * The projects the parity harness runs (Docs/v1.3/cypher-interpreter.md §4):
 * - the 71 v1.3 reference variants (5 styles), materialised under the OS temp directory exactly as the live
 *   reference run does, each with its style's spec;
 * - the APG v2 fixture suite (`tests/fixtures/v1.3-apg2`), whose graphs carry the APG v2 node and edge types;
 * - one synthetic APG with the shapes none of them has (`syntheticProject`).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { componentsFromLayerModel } from '../../../src/apg-extractor/index.js';
import type { ComponentDeclaration } from '../../../src/apg-extractor/index.js';
import type { LayerDefinition, LayerModel } from '../../../src/shared/types/spec.js';
import type { LayerKind } from '../../../src/shared/types/enums.js';
import type { APGEdge, APGNode, APGResult } from '../../../src/shared/types/apg.js';
import { loadAllReferences } from './reference-model.js';
import { materialiseVariant } from './materialise.js';

export interface ReferenceProject {
  readonly kind: 'reference';
  readonly id: string;
  readonly specPath: string;
  /** Materialises the variant under `root` and returns its directory. */
  readonly materialise: (root: string) => string;
}

export interface Apg2FixtureProject {
  readonly kind: 'apg2-fixture';
  readonly id: string;
  readonly dir: string;
  readonly layerModel: LayerModel;
  readonly components: ComponentDeclaration[];
  readonly allowedAsync: readonly string[];
}

export function referenceProjects(repoRoot: string, only?: (id: string) => boolean): ReferenceProject[] {
  const out: ReferenceProject[] = [];
  for (const ref of loadAllReferences(repoRoot)) {
    for (const v of ref.variants) {
      const id = `${ref.style}/${v.manifest.variant}`;
      if (only !== undefined && !only(id)) continue;
      out.push({ kind: 'reference', id, specPath: ref.specPath, materialise: (root) => materialiseVariant(ref, v, root).projectDir });
    }
  }
  return out;
}

interface SuiteProject {
  readonly layers: ReadonlyArray<{ name: string; directories: string[]; filePatterns?: string[]; kind: LayerKind }>;
  readonly components: 'layers' | 'folders' | ComponentDeclaration[];
  readonly allowedAsync?: string[];
}

/** As `scripts/v1.3/apg2-live.ts`: the suite's layer model and component declarations per fixture project. */
export function apg2FixtureProjects(repoRoot: string, only?: (id: string) => boolean): Apg2FixtureProject[] {
  const suiteDir = path.join(repoRoot, 'tests/fixtures/v1.3-apg2');
  const suite = JSON.parse(fs.readFileSync(path.join(suiteDir, 'cases.json'), 'utf8')) as { projects: Record<string, SuiteProject> };
  const out: Apg2FixtureProject[] = [];
  for (const [name, p] of Object.entries(suite.projects)) {
    const id = `apg2-fixture/${name}`;
    if (only !== undefined && !only(id)) continue;
    const layers: LayerDefinition[] = p.layers.map((l) => ({
      name: l.name, directories: l.directories, naming: [], role: '', kind: l.kind, kindSource: 'explicit',
      ...(l.filePatterns !== undefined ? { filePatterns: l.filePatterns } : {}),
    }));
    const layerModel: LayerModel = { layers };
    const components = p.components === 'folders' ? [] : p.components === 'layers' ? componentsFromLayerModel(layerModel) : p.components;
    out.push({ kind: 'apg2-fixture', id, dir: path.join(suiteDir, name), layerModel, components, allowedAsync: p.allowedAsync ?? [] });
  }
  return out;
}

export interface SyntheticProject {
  readonly kind: 'synthetic';
  readonly id: string;
  readonly apg: APGResult;
  readonly layerModel: LayerModel;
}

/**
 * A hand-built APG with the shapes no reference project has, so the templates that read them are compared on rows,
 * not on empty results: a four-class EXTENDS chain (inheritance-depth, domain-event-placement), MODULE_IMPORTS
 * (module-domain-imports-infrastructure), class decorators (naming-controllers), a barrel that declares code
 * (no-index-logic), an interface with many methods, injections across layers, unlayered files and null-valued
 * properties (three-valued logic). It goes through the real `ingestAPG`, like every other graph.
 */
export function syntheticProject(): SyntheticProject {
  const layer = (name: string, kind: LayerKind): LayerDefinition => ({ name, directories: [`src/${name}/**`], naming: [], role: '', kind, kindSource: 'explicit' });
  const layerModel: LayerModel = { layers: [layer('domain', 'domain'), layer('application', 'application'), layer('infrastructure', 'infrastructure'), layer('presentation', 'presentation')] };
  const nodes: APGNode[] = [];
  const edges: APGEdge[] = [];
  const node = (id: string, type: APGNode['type'], name: string, filePath: string, properties: Record<string, unknown> = {}): void => {
    nodes.push({ id, type, name, filePath, decorators: [], properties });
  };
  const edge = (type: APGEdge['type'], sourceId: string, targetId: string, properties: Record<string, unknown> = {}): void => {
    edges.push({ id: `${type}:${sourceId}->${targetId}`, type, sourceId, targetId, properties });
  };
  const files = ['src/domain/Base.ts', 'src/domain/Entities.ts', 'src/domain/index.ts', 'src/application/OrderService.ts', 'src/infrastructure/OrderRepository.ts',
    'src/infrastructure/InfraModule.ts', 'src/domain/DomainModule.ts', 'src/presentation/OrderController.ts', 'src/presentation/BadController.ts', 'scripts/tool.ts', 'src/domain/Base.spec.ts'];
  for (const f of files) node(`file:${f}`, 'File', f.slice(f.lastIndexOf('/') + 1), f, { isBarrel: f.endsWith('index.ts') });
  node('class:Base', 'Class', 'BaseEntity', 'src/domain/Base.ts');
  node('class:Mid', 'Class', 'AggregateRoot', 'src/domain/Entities.ts');
  node('class:Leaf', 'Class', 'OrderEntity', 'src/domain/Entities.ts');
  node('class:Leaf2', 'Class', 'SpecialOrderEntity', 'src/domain/Entities.ts', { isAbstract: null });
  node('class:Event', 'Class', 'OrderPlacedEvent', 'src/application/OrderService.ts');
  node('class:Svc', 'Class', 'OrderService', 'src/application/OrderService.ts');
  node('class:Repo', 'Class', 'OrderRepository', 'src/infrastructure/OrderRepository.ts');
  node('class:DomMod', 'Class', 'DomainModule', 'src/domain/DomainModule.ts');
  node('class:InfMod', 'Class', 'InfraModule', 'src/infrastructure/InfraModule.ts');
  node('class:Ctrl', 'Class', 'OrderController', 'src/presentation/OrderController.ts', { decorators: ['Controller', 'UseGuards'] });
  node('class:Bad', 'Class', 'orders_ctrl', 'src/presentation/BadController.ts', { decorators: ['Controller'] });
  node('iface:Repo', 'Interface', 'IOrderRepository', 'src/domain/Entities.ts');
  node('fn:helper', 'Function', 'helper', 'src/domain/index.ts');
  for (const m of ['find', 'save', 'delete', 'count', 'exists']) {
    node(`method:IOrderRepository.${m}`, 'Method', `IOrderRepository.${m}`, 'src/domain/Entities.ts');
    edge('CONTAINS', 'iface:Repo', `method:IOrderRepository.${m}`);
  }
  for (const [m, isStatic] of [['setTotal', false], ['setStatus', null], ['create', true]] as const) {
    node(`method:OrderEntity.${m}`, 'Method', `OrderEntity.${m}`, 'src/domain/Entities.ts', { isStatic });
    edge('CONTAINS', 'class:Leaf', `method:OrderEntity.${m}`);
  }
  edge('EXTENDS', 'class:Mid', 'class:Base');
  edge('EXTENDS', 'class:Leaf', 'class:Mid');
  edge('EXTENDS', 'class:Leaf2', 'class:Leaf');
  edge('EXTENDS', 'class:Event', 'class:Base');
  edge('IMPLEMENTS', 'class:Repo', 'iface:Repo');
  edge('MODULE_IMPORTS', 'class:DomMod', 'class:InfMod', { line: 4 });
  edge('CONSTRUCTOR_INJECTS', 'class:Svc', 'class:Repo', { parameterName: 'repo', line: 7 });
  edge('CONSTRUCTOR_INJECTS', 'class:Svc', 'iface:Repo', { parameterName: 'port' });
  edge('CONSTRUCTOR_INJECTS', 'class:Ctrl', 'class:Svc', { parameterName: 'svc' });
  edge('CONSTRUCTOR_INJECTS', 'class:Ctrl', 'class:Leaf', { parameterName: 'entity' });
  edge('CONSTRUCTOR_INJECTS', 'class:Leaf', 'class:Repo', { parameterName: 'leak' });
  edge('FLOWS_TO', 'class:Leaf2', 'class:Repo', { field: 'repo', line: 3 });
  edge('DECLARES', 'file:src/domain/index.ts', 'fn:helper');
  edge('DECLARES', 'file:src/domain/Base.ts', 'class:Base');
  edge('DECLARES', 'file:src/domain/Entities.ts', 'class:Leaf');
  const imp = (s: string, t: string, line: number, extra: Record<string, unknown> = {}): void => edge('IMPORTS', `file:${s}`, `file:${t}`, { line, lines: [line], isTypeOnly: false, specifier: t, ...extra });
  imp('src/domain/Entities.ts', 'src/domain/Base.ts', 1);
  imp('src/domain/Entities.ts', 'src/infrastructure/OrderRepository.ts', 2, { isTypeOnly: true });
  imp('src/application/OrderService.ts', 'src/domain/index.ts', 1, { reExportHop: true });
  imp('src/application/OrderService.ts', 'src/domain/Entities.ts', 1, { viaReExport: true });
  imp('src/presentation/OrderController.ts', 'src/application/OrderService.ts', 3);
  imp('src/presentation/OrderController.ts', 'src/domain/Entities.ts', 4);
  imp('src/infrastructure/OrderRepository.ts', 'src/domain/Entities.ts', 1);
  imp('src/infrastructure/InfraModule.ts', 'src/infrastructure/OrderRepository.ts', 2);
  imp('scripts/tool.ts', 'src/presentation/OrderController.ts', 9);
  edge('RE_EXPORTS', 'file:src/domain/index.ts', 'file:src/domain/Entities.ts', { line: 1, lines: [1], exportedNames: ['*'], isTypeOnly: false });
  edge('RE_EXPORTS', 'file:src/domain/Base.ts', 'file:src/domain/Entities.ts', { line: 5, lines: [5], exportedNames: ['OrderEntity'], isTypeOnly: false });
  node('pkg:express', 'Package', 'express', '');
  node('pkg:typeorm', 'Package', 'typeorm', '');
  edge('IMPORTS', 'file:src/domain/Entities.ts', 'pkg:typeorm', { line: 3, lines: [3], isTypeOnly: false });
  edge('IMPORTS', 'file:src/domain/Base.ts', 'pkg:express', { line: 2, lines: [2, 8], isTypeOnly: true });
  return { kind: 'synthetic', id: 'synthetic/shapes', apg: { nodes, edges } as unknown as APGResult, layerModel };
}
