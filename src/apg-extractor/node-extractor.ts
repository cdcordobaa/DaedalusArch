import { Node, SourceFile, SyntaxKind } from 'ts-morph';
import type { APGNode } from '../shared/types/apg.js';
import type { SkippedFile } from '../shared/types/apg.js';
import type { NodeType } from '../shared/types/enums.js';
import type { ExtractorOptions, NodeLookup, DecoratorMetadata } from './types.js';
import { DEFAULT_OPTIONS } from './types.js';
import { generateNodeId, normalizeFilePath } from './id-generator.js';

export interface NodeExtractionResult {
  readonly nodes: APGNode[];
  readonly lookup: NodeLookup;
  readonly skipped: SkippedFile[];
}

/**
 * First pass: extract all 5 node types from source files and build the NodeLookup registry.
 */
export function extractNodes(
  sourceFiles: SourceFile[],
  projectRoot: string,
  options: ExtractorOptions = {},
): NodeExtractionResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const nodes: APGNode[] = [];
  const skipped: SkippedFile[] = [];

  const lookup: NodeLookup = {
    nodeIds: new Set(),
    fileNodes: new Map(),
    typeNodes: new Map(),
    methodNodes: new Map(),
    functionNodes: new Map(),
  };

  for (const sf of sourceFiles) {
    try {
      const filePath = normalizeFilePath(sf.getFilePath(), projectRoot);
      const fileNode = extractFileNode(sf, filePath, opts);
      registerNode(fileNode, lookup);
      nodes.push(fileNode);

      lookup.fileNodes.set(filePath, fileNode.id);

      for (const cls of sf.getClasses()) {
        try {
          const clsNode = extractClassNode(cls, filePath, opts);
          registerNode(clsNode, lookup);
          nodes.push(clsNode);
          lookup.typeNodes.set(`${clsNode.name.toLowerCase()}@${filePath}`, clsNode.id);

          for (const method of cls.getMethods()) {
            try {
              const methodNode = extractMethodNode(method, cls.getName() ?? '<anonymous>', filePath, opts);
              registerNode(methodNode, lookup);
              nodes.push(methodNode);
              lookup.methodNodes.set(`${methodNode.name.toLowerCase()}@${filePath}`, methodNode.id);
            } catch {
              // lenient: skip individual method failures
            }
          }
        } catch {
          // lenient: skip individual class failures
        }
      }

      for (const iface of sf.getInterfaces()) {
        try {
          const ifaceNode = extractInterfaceNode(iface, filePath);
          registerNode(ifaceNode, lookup);
          nodes.push(ifaceNode);
          lookup.typeNodes.set(`${ifaceNode.name.toLowerCase()}@${filePath}`, ifaceNode.id);
        } catch {
          // lenient: skip individual interface failures
        }
      }

      for (const fn of sf.getFunctions()) {
        try {
          const fnNode = extractFunctionNode(fn, filePath);
          registerNode(fnNode, lookup);
          nodes.push(fnNode);
          lookup.functionNodes.set(`${fnNode.name.toLowerCase()}@${filePath}`, fnNode.id);
        } catch {
          // lenient: skip individual function failures
        }
      }

      // Exported const arrow functions with explicit type annotation
      for (const varStmt of sf.getVariableStatements()) {
        if (!varStmt.isExported()) continue;
        for (const decl of varStmt.getDeclarations()) {
          const typeNode = decl.getTypeNode();
          const init = decl.getInitializer();
          if (typeNode && init && Node.isArrowFunction(init)) {
            try {
              const name = decl.getName();
              const fnNode = buildNode('Function', filePath, name, {
                isAsync: init.isAsync(),
                isExported: true,
              });
              registerNode(fnNode, lookup);
              nodes.push(fnNode);
              lookup.functionNodes.set(`${name.toLowerCase()}@${filePath}`, fnNode.id);
            } catch {
              // lenient: skip
            }
          }
        }
      }
    } catch (err) {
      skipped.push({
        filePath: normalizeFilePath(sf.getFilePath(), projectRoot),
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { nodes, lookup, skipped };
}

// ── Private helpers ──────────────────────────────────────────────────────────

function extractFileNode(sf: SourceFile, filePath: string, _opts: Required<ExtractorOptions>): APGNode {
  const isBarrel = detectBarrel(sf);
  return buildNode('File', filePath, filePath.split('/').pop() ?? filePath, { isBarrel });
}

function extractClassNode(
  cls: ReturnType<SourceFile['getClasses']>[number],
  filePath: string,
  opts: Required<ExtractorOptions>,
): APGNode {
  const name = cls.getName() ?? '<anonymous>';
  const decorators = opts.includeDecorators ? extractDecorators(cls) : [];
  return buildNode('Class', filePath, name, {
    isAbstract: cls.isAbstract(),
    typeParameters: cls.getTypeParameters().map(tp => tp.getName()),
  }, decorators.map(d => d.name));
}

function extractInterfaceNode(
  iface: ReturnType<SourceFile['getInterfaces']>[number],
  filePath: string,
): APGNode {
  const name = iface.getName();
  return buildNode('Interface', filePath, name, {
    typeParameters: iface.getTypeParameters().map(tp => tp.getName()),
  });
}

function extractMethodNode(
  method: ReturnType<ReturnType<SourceFile['getClasses']>[number]['getMethods']>[number],
  className: string,
  filePath: string,
  opts: Required<ExtractorOptions>,
): APGNode {
  const methodName = method.getName();
  const qualifiedName = `${className}.${methodName}`;
  const decorators = opts.includeDecorators ? extractDecorators(method) : [];
  return buildNode('Method', filePath, qualifiedName, {
    isAsync: method.isAsync(),
    isStatic: method.isStatic(),
    isAbstract: method.isAbstract(),
    returnType: method.getReturnType().getText(),
  }, decorators.map(d => d.name));
}

function extractFunctionNode(
  fn: ReturnType<SourceFile['getFunctions']>[number],
  filePath: string,
): APGNode {
  const name = fn.getName() ?? '<anonymous>';
  return buildNode('Function', filePath, name, {
    isAsync: fn.isAsync(),
    isExported: fn.isExported(),
  });
}

function buildNode(
  type: NodeType,
  filePath: string,
  name: string,
  properties: Record<string, unknown>,
  decorators: string[] = [],
): APGNode {
  return {
    id: generateNodeId(type, filePath, name),
    type,
    filePath,
    name,
    decorators,
    properties,
  };
}

function registerNode(node: APGNode, lookup: NodeLookup): void {
  (lookup.nodeIds as Set<string>).add(node.id);
}

function extractDecorators(
  node: { getDecorators(): Array<{ getName(): string; getArguments(): Array<{ getText(): string }> }> },
): DecoratorMetadata[] {
  return node.getDecorators().map(d => ({
    name: d.getName(),
    arguments: d.getArguments().map(a => a.getText()),
  }));
}

/**
 * A file is a barrel if every statement is an ExportDeclaration or an
 * ImportDeclaration that is immediately re-exported.
 */
export function detectBarrel(sf: SourceFile): boolean {
  const stmts = sf.getStatements();
  if (stmts.length === 0) return false;
  return stmts.every(
    s =>
      s.getKind() === SyntaxKind.ExportDeclaration ||
      s.getKind() === SyntaxKind.ImportDeclaration,
  );
}
