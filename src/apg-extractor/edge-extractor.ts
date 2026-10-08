import { resolve, dirname } from 'node:path';
import { SourceFile, SyntaxKind, Node } from 'ts-morph';
import type { APGEdge, APGNode, ImportResolutionStats } from '../shared/types/apg.js';
import type { ExtractorWarning } from '../shared/types/apg.js';
import type { EdgeType } from '../shared/types/enums.js';
import type { ExtractorOptions, NodeLookup } from './types.js';
import { DEFAULT_OPTIONS, DI_DECORATORS, PRIMITIVE_TYPES } from './types.js';
import { generateEdgeId, normalizeFilePath } from './id-generator.js';
import { ImportEdgeMerger } from './import-edge-merger.js';
import { PackageNodeRegistry } from './package-node-factory.js';
import {
  buildImportResolutionContext,
  countUnsupportedDynamicImports,
  importEqualsSpecifier,
  resolveImportTargets,
  resolveReExportTargets,
} from './import-resolver.js';
import type { StatementResolution } from './import-resolver.js';

// Warning code EXTRACTOR_001 ("External import skipped") is retired and reserved
// (FR-v1.2E-09, BR-U2-02): never emitted, never reused.

export interface EdgeExtractionResult {
  readonly edges: APGEdge[];
  readonly warnings: ExtractorWarning[];
  /** Package nodes referenced by IMPORTS / RE_EXPORTS edges, sorted by name (FR-09). */
  readonly packageNodes: readonly APGNode[];
  /** Partition counts over the counted statements (FR-14, BR-U2-14). */
  readonly importResolution: ImportResolutionStats;
}

/**
 * Second pass: extract the edge types using the NodeLookup built in the first pass.
 * IMPORTS and RE_EXPORTS come from import resolution and the FR-10 merger and are
 * emitted first (IMPORTS, then RE_EXPORTS, each in first-occurrence order); the
 * other types follow in insertion order.
 */
export function extractEdges(
  sourceFiles: SourceFile[],
  lookup: NodeLookup,
  projectRoot: string,
  options: ExtractorOptions = {},
): EdgeExtractionResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const edgeSet = new Map<string, APGEdge>(); // key=(type+sourceId+targetId) for dedup, non-import types only
  const warnings: ExtractorWarning[] = [];
  const counts = { resolvedInternal: 0, external: 0, externalOutOfRootAlias: 0, unresolved: 0, droppedNoFileNode: 0, unsupportedDynamic: 0 };

  const project = sourceFiles[0]?.getProject();
  if (project === undefined) return { edges: [], warnings, packageNodes: [], importResolution: counts };

  // Keep-first insertion for every type except IMPORTS / RE_EXPORTS, which the merger owns (BR-U2-17).
  const addEdge = (edge: APGEdge): void => {
    const key = `${edge.type}:${edge.sourceId}:${edge.targetId}`;
    if (!edgeSet.has(key)) edgeSet.set(key, edge);
  };

  const addWarning = (filePath: string, code: string, message: string): void => {
    warnings.push({ filePath, code, message });
  };

  const packages = new PackageNodeRegistry();
  const importCtx = buildImportResolutionContext(project, lookup, projectRoot, opts, addWarning, packages);
  const merger = new ImportEdgeMerger();

  for (const sf of sourceFiles) {
    const filePath = normalizeFilePath(sf.getFilePath(), projectRoot);
    const fileNodeId = lookup.fileNodes.get(filePath);
    if (!fileNodeId) continue;

    // IMPORTS / RE_EXPORTS: statements in source order, one partition counter each (BR-U2-14, 15).
    for (const stmt of sf.getStatements()) {
      let resolution: StatementResolution;
      if (Node.isImportDeclaration(stmt)) {
        resolution = resolveImportTargets(stmt, importCtx);
      } else if (Node.isImportEqualsDeclaration(stmt) && importEqualsSpecifier(stmt) !== undefined) {
        resolution = resolveImportTargets(stmt, importCtx);
      } else if (Node.isExportDeclaration(stmt) && stmt.getModuleSpecifierValue() !== undefined) {
        resolution = resolveReExportTargets(stmt, importCtx);
      } else {
        continue;
      }
      for (const occ of resolution.occurrences) {
        const targetId = occ.target.kind === 'file' ? occ.target.fileNodeId : packages.getOrCreate(occ.target.root).id;
        merger.add(occ, targetId);
      }
      counts[resolution.outcome]++;
      if (resolution.outOfRootAlias) counts.externalOutOfRootAlias++;
    }

    // import() / require() calls are counted, not modelled (BR-U2-25).
    const dynamic = countUnsupportedDynamicImports(sf);
    if (dynamic > 0) {
      counts.unsupportedDynamic += dynamic;
      addWarning(filePath, 'EXTRACTOR_009', `Unsupported dynamic import(s): ${String(dynamic)}`);
    }

    // DECLARES edges (File → top-level Class / Interface / Function)
    for (const cls of sf.getClasses()) {
      const name = cls.getName() ?? '<anonymous>';
      const targetId = lookup.typeNodes.get(`${name.toLowerCase()}@${filePath}`);
      if (targetId) addEdge(buildEdge('DECLARES', fileNodeId, targetId, {}));
    }
    for (const iface of sf.getInterfaces()) {
      const targetId = lookup.typeNodes.get(`${iface.getName().toLowerCase()}@${filePath}`);
      if (targetId) addEdge(buildEdge('DECLARES', fileNodeId, targetId, {}));
    }
    for (const fn of sf.getFunctions()) {
      const name = fn.getName();
      if (!name) continue;
      const targetId = lookup.functionNodes.get(`${name.toLowerCase()}@${filePath}`);
      if (targetId) addEdge(buildEdge('DECLARES', fileNodeId, targetId, {}));
    }

    // Per-class edges: CONTAINS, EXTENDS, IMPLEMENTS, CONSTRUCTOR_INJECTS, CALLS
    for (const cls of sf.getClasses()) {
      const clsName = cls.getName() ?? '<anonymous>';
      const clsNodeId = lookup.typeNodes.get(`${clsName.toLowerCase()}@${filePath}`);
      if (!clsNodeId) continue;

      // CONTAINS (Class → Method)
      for (const method of cls.getMethods()) {
        const qualifiedName = `${clsName}.${method.getName()}`;
        const methodId = lookup.methodNodes.get(`${qualifiedName.toLowerCase()}@${filePath}`);
        if (methodId) addEdge(buildEdge('CONTAINS', clsNodeId, methodId, {}));
      }

      // EXTENDS (Class → Class)
      const baseClass = cls.getBaseClass();
      if (baseClass) {
        const baseName = baseClass.getName() ?? '';
        const basePath = normalizeFilePath(baseClass.getSourceFile().getFilePath(), projectRoot);
        const targetId = lookup.typeNodes.get(`${baseName.toLowerCase()}@${basePath}`);
        if (targetId) {
          addEdge(buildEdge('EXTENDS', clsNodeId, targetId, {}));
        } else {
          addWarning(filePath, 'EXTRACTOR_003', `EXTENDS target not in extracted set: ${baseName}`);
        }
      }

      // IMPLEMENTS (Class → Interface)
      for (const impl of cls.getImplements()) {
        try {
          const ifaceName = impl.getExpression().getText().split('<')[0]!.trim();

          // Primary path: resolve via ts-morph type symbol (works for same-file interfaces)
          const implType = impl.getType();
          const symbol = implType.getSymbol() ?? implType.getAliasSymbol();
          if (symbol && symbol.getDeclarations().length > 0) {
            const decl = symbol.getDeclarations()[0]!;
            if (Node.isInterfaceDeclaration(decl)) {
              const resolvedPath = normalizeFilePath(decl.getSourceFile().getFilePath(), projectRoot);
              const targetId = lookup.typeNodes.get(`${ifaceName.toLowerCase()}@${resolvedPath}`);
              if (targetId) {
                addEdge(buildEdge('IMPLEMENTS', clsNodeId, targetId, {}));
                continue;
              }
            }
          }

          // Fallback: resolve via the import declarations of the current file.
          // ts-morph type resolution fails for cross-file interfaces when module
          // resolution can't follow relative imports (e.g. no .ts extension in specifier).
          const absoluteFilePath = sf.getFilePath();
          let resolved = false;
          for (const importDecl of sf.getImportDeclarations()) {
            const named = importDecl.getNamedImports().find(n => n.getName() === ifaceName);
            if (!named) continue;
            const specifier = importDecl.getModuleSpecifierValue();
            if (!specifier.startsWith('.') && !specifier.startsWith('/')) continue;

            // Resolve specifier to absolute path, trying .ts and /index.ts
            const base = resolve(dirname(absoluteFilePath), specifier);
            const candidates = [`${base}.ts`, `${base}/index.ts`, base];
            for (const candidate of candidates) {
              const candidateNorm = normalizeFilePath(candidate, projectRoot);
              const targetId = lookup.typeNodes.get(`${ifaceName.toLowerCase()}@${candidateNorm}`);
              if (targetId) {
                addEdge(buildEdge('IMPLEMENTS', clsNodeId, targetId, {}));
                resolved = true;
                break;
              }
            }
            if (resolved) break;
          }

          if (!resolved) {
            addWarning(filePath, 'EXTRACTOR_004', `IMPLEMENTS target not in extracted set: ${ifaceName}`);
          }
        } catch {
          // lenient: skip unresolvable implements
        }
      }

      // CONSTRUCTOR_INJECTS
      const constructors = cls.getConstructors();
      if (constructors.length > 0) {
        const ctor = constructors[0]!;
        const hasDecorator = cls.getDecorators().some(d => DI_DECORATORS.has(d.getName()));

        for (const param of ctor.getParameters()) {
          const typeName = param.getType().getText();
          const paramName = param.getName();

          if (shouldSkipDIType(typeName)) continue;

          // Resolve type to an extracted node
          try {
            const typeSymbol = param.getType().getSymbol() ?? param.getType().getAliasSymbol();
            if (!typeSymbol) continue;
            const decls = typeSymbol.getDeclarations();
            if (decls.length === 0) continue;
            const decl = decls[0]!;
            const targetName = Node.isClassDeclaration(decl) || Node.isInterfaceDeclaration(decl)
              ? decl.getName() ?? ''
              : '';
            if (!targetName) continue;
            const targetPath = normalizeFilePath(decl.getSourceFile().getFilePath(), projectRoot);
            const targetId = lookup.typeNodes.get(`${targetName.toLowerCase()}@${targetPath}`);
            if (targetId) {
              addEdge(buildEdge('CONSTRUCTOR_INJECTS', clsNodeId, targetId, {
                parameterName: paramName,
                decoratorBased: hasDecorator,
              }));
            } else {
              addWarning(filePath, 'EXTRACTOR_005', `CONSTRUCTOR_INJECTS type unresolvable: ${typeName}`);
            }
          } catch {
            // lenient: skip
          }
        }
      }

      // CALLS (cross-boundary Method → Method)
      for (const method of cls.getMethods()) {
        const qualifiedName = `${clsName}.${method.getName()}`;
        const sourceMethodId = lookup.methodNodes.get(`${qualifiedName.toLowerCase()}@${filePath}`);
        if (!sourceMethodId) continue;

        const callsMap = new Map<string, number>(); // targetId → count

        const callExprs = method.getDescendantsOfKind(SyntaxKind.CallExpression);
        for (const call of callExprs) {
          try {
            const expr = call.getExpression();
            // Only handle property access calls (obj.method())
            if (!Node.isPropertyAccessExpression(expr)) continue;

            const symbol = expr.getNameNode().getSymbol();
            if (!symbol) continue;
            const decls = symbol.getDeclarations();
            if (decls.length === 0) continue;
            const decl = decls[0]!;
            if (!Node.isMethodDeclaration(decl)) continue;

            const targetClsDecl = decl.getParentIfKind(SyntaxKind.ClassDeclaration);
            if (!targetClsDecl) continue;
            const targetClsName = targetClsDecl.getName() ?? '';

            // Cross-boundary check: target class must differ from source class
            if (targetClsName.toLowerCase() === clsName.toLowerCase()) continue;

            const targetMethodName = `${targetClsName}.${decl.getName()}`;
            const targetMethodPath = normalizeFilePath(decl.getSourceFile().getFilePath(), projectRoot);
            const targetMethodId = lookup.methodNodes.get(`${targetMethodName.toLowerCase()}@${targetMethodPath}`);
            if (!targetMethodId) continue;

            callsMap.set(targetMethodId, (callsMap.get(targetMethodId) ?? 0) + 1);
          } catch {
            // lenient: skip unresolvable call
          }
        }

        for (const [targetMethodId, callCount] of callsMap) {
          addEdge(buildEdge('CALLS', sourceMethodId, targetMethodId, { callCount }));
        }
      }
    }
  }

  const importEdges = merger.edges();
  const edges = [
    ...importEdges.filter(e => e.type === 'IMPORTS'),
    ...importEdges.filter(e => e.type === 'RE_EXPORTS'),
    ...edgeSet.values(),
  ];
  return { edges, warnings, packageNodes: packages.nodes(), importResolution: counts };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildEdge(
  type: EdgeType,
  sourceId: string,
  targetId: string,
  properties: Record<string, unknown>,
): APGEdge {
  return {
    id: generateEdgeId(type, sourceId, targetId),
    type,
    sourceId,
    targetId,
    properties,
  };
}

function shouldSkipDIType(typeName: string): boolean {
  // Strip generic args and array brackets for the base type check
  const baseType = typeName.replace(/<.*>/, '').replace(/\[\]/, '').trim();
  if (PRIMITIVE_TYPES.has(baseType)) return true;
  // Single uppercase letter = generic type parameter (T, U, K, V, etc.)
  if (/^[A-Z]$/.test(baseType)) return true;
  return false;
}
