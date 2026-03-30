import { SourceFile, SyntaxKind, Node } from 'ts-morph';
import type { APGEdge } from '../shared/types/apg.js';
import type { ExtractorWarning } from '../shared/types/apg.js';
import type { EdgeType } from '../shared/types/enums.js';
import type { ExtractorOptions, NodeLookup } from './types.js';
import { DEFAULT_OPTIONS, DI_DECORATORS, PRIMITIVE_TYPES } from './types.js';
import { generateEdgeId, normalizeFilePath } from './id-generator.js';

export interface EdgeExtractionResult {
  readonly edges: APGEdge[];
  readonly warnings: ExtractorWarning[];
}

/**
 * Second pass: extract all 7 edge types using the NodeLookup built in the first pass.
 */
export function extractEdges(
  sourceFiles: SourceFile[],
  lookup: NodeLookup,
  projectRoot: string,
  options: ExtractorOptions = {},
): EdgeExtractionResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const edgeSet = new Map<string, APGEdge>(); // key=(type+sourceId+targetId) for dedup
  const warnings: ExtractorWarning[] = [];

  const addEdge = (edge: APGEdge): void => {
    const key = `${edge.type}:${edge.sourceId}:${edge.targetId}`;
    if (!edgeSet.has(key)) edgeSet.set(key, edge);
  };

  const addWarning = (filePath: string, code: string, message: string): void => {
    warnings.push({ filePath, code, message });
  };

  for (const sf of sourceFiles) {
    const filePath = normalizeFilePath(sf.getFilePath(), projectRoot);
    const fileNodeId = lookup.fileNodes.get(filePath);
    if (!fileNodeId) continue;

    // IMPORTS edges
    for (const importDecl of sf.getImportDeclarations()) {
      const result = resolveImport(importDecl, sf, lookup, projectRoot, opts, addWarning);
      if (!result) continue;
      const edge = buildEdge('IMPORTS', fileNodeId, result.targetFileNodeId, {
        importedNames: result.importedNames,
        isTypeOnly: result.isTypeOnly,
      });
      addEdge(edge);
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
          const implType = impl.getType();
          const symbol = implType.getSymbol() ?? implType.getAliasSymbol();
          if (!symbol) continue;
          const declarations = symbol.getDeclarations();
          if (declarations.length === 0) continue;
          const decl = declarations[0];
          if (!Node.isInterfaceDeclaration(decl)) continue;
          const ifaceName = decl.getName();
          const ifacePath = normalizeFilePath(decl.getSourceFile().getFilePath(), projectRoot);
          const targetId = lookup.typeNodes.get(`${ifaceName.toLowerCase()}@${ifacePath}`);
          if (targetId) {
            addEdge(buildEdge('IMPLEMENTS', clsNodeId, targetId, {}));
          } else {
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

  return { edges: Array.from(edgeSet.values()), warnings };
}

// ── Barrel-aware import resolution ──────────────────────────────────────────

function resolveImport(
  importDecl: ReturnType<SourceFile['getImportDeclarations']>[number],
  sf: SourceFile,
  lookup: NodeLookup,
  projectRoot: string,
  opts: Required<ExtractorOptions>,
  addWarning: (fp: string, code: string, msg: string) => void,
): { targetFileNodeId: string; importedNames: string[]; isTypeOnly: boolean } | null {
  const filePath = normalizeFilePath(sf.getFilePath(), projectRoot);
  const moduleSpecifier = importDecl.getModuleSpecifierValue();

  // Skip external / node_modules imports
  if (!moduleSpecifier.startsWith('.') && !moduleSpecifier.startsWith('/')) {
    addWarning(filePath, 'EXTRACTOR_001', `External import skipped: ${moduleSpecifier}`);
    return null;
  }

  try {
    const resolvedSf = importDecl.getModuleSpecifierSourceFile();
    if (!resolvedSf) {
      addWarning(filePath, 'EXTRACTOR_002', `Unresolvable import: ${moduleSpecifier}`);
      return null;
    }

    const ultimateSf = resolveBarrelTransitively(resolvedSf, projectRoot, opts.maxBarrelDepth, new Set(), addWarning);
    const targetPath = normalizeFilePath(ultimateSf.getFilePath(), projectRoot);
    const targetFileNodeId = lookup.fileNodes.get(targetPath);
    if (!targetFileNodeId) return null;

    const namedImports = importDecl.getNamedImports().map(n => n.getName());
    const defaultImport = importDecl.getDefaultImport()?.getText();
    const namespaceImport = importDecl.getNamespaceImport()?.getText();
    const importedNames = [
      ...namedImports,
      ...(defaultImport ? [defaultImport] : []),
      ...(namespaceImport ? [`* as ${namespaceImport}`] : []),
    ];

    return {
      targetFileNodeId,
      importedNames,
      isTypeOnly: importDecl.isTypeOnly(),
    };
  } catch {
    addWarning(filePath, 'EXTRACTOR_002', `Unresolvable import: ${moduleSpecifier}`);
    return null;
  }
}

function resolveBarrelTransitively(
  sf: SourceFile,
  projectRoot: string,
  maxDepth: number,
  visited: Set<string>,
  addWarning: (fp: string, code: string, msg: string) => void,
): SourceFile {
  const sfPath = sf.getFilePath();

  if (visited.has(sfPath)) {
    addWarning(normalizeFilePath(sfPath, projectRoot), 'EXTRACTOR_007', 'Circular barrel chain detected');
    return sf;
  }
  if (visited.size >= maxDepth) {
    addWarning(normalizeFilePath(sfPath, projectRoot), 'EXTRACTOR_006', 'Barrel resolution depth exceeded');
    return sf;
  }

  const stmts = sf.getStatements();
  const isBarrel = stmts.length > 0 && stmts.every(
    s => s.getKind() === SyntaxKind.ExportDeclaration || s.getKind() === SyntaxKind.ImportDeclaration,
  );
  if (!isBarrel) return sf;

  visited.add(sfPath);

  // Follow first re-export to next file
  for (const stmt of stmts) {
    if (stmt.getKind() !== SyntaxKind.ExportDeclaration) continue;
    try {
      const exportDecl = stmt.asKindOrThrow(SyntaxKind.ExportDeclaration);
      const nextSf = exportDecl.getModuleSpecifierSourceFile();
      if (nextSf && nextSf.getFilePath() !== sfPath) {
        return resolveBarrelTransitively(nextSf, projectRoot, maxDepth, new Set(visited), addWarning);
      }
    } catch {
      // skip
    }
  }

  return sf;
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
