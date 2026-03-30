import picomatch from 'picomatch';
import type { APGNode } from '../shared/types/apg.js';
import type { LayerModel, LayerDefinition } from '../shared/types/spec.js';
import type { LayerAnnotationSummary } from '../shared/types/evaluation.js';
import type { LayerAnnotation, LayerMapping } from './types.js';

export interface AnnotationResult {
  readonly annotations: ReadonlyMap<string, LayerAnnotation>;
  readonly summary: LayerAnnotationSummary;
}

/**
 * Build LayerMapping[] from LayerModel for use in annotation.
 */
export function buildLayerMappings(layerModel: LayerModel): LayerMapping[] {
  return layerModel.layers.map((layer: LayerDefinition) => ({
    layerName: layer.name,
    directories: layer.directories,
    roles: layer.role ? layer.role.split(', ') : [],
    decorators: layer.decorators ?? [],
  }));
}

/**
 * Annotate all nodes with layer/role based on LayerModel.
 * Priority: directory > naming > decorator.
 * Returns a map of nodeId → LayerAnnotation.
 */
export function annotateNodes(
  nodes: readonly APGNode[],
  layerModel: LayerModel,
): AnnotationResult {
  const mappings = buildLayerMappings(layerModel);
  const annotations = new Map<string, LayerAnnotation>();

  // Pre-compile picomatch matchers for each layer's directory patterns
  const matchers = mappings.map((m) => ({
    mapping: m,
    match: picomatch(m.directories as string[], { dot: true }),
  }));

  // Build file-to-layer map first (File nodes only)
  const fileAnnotations = new Map<string, LayerAnnotation>();
  const fileNodes = nodes.filter((n) => n.type === 'File');

  for (const node of fileNodes) {
    const annotation = annotateFileNode(node, matchers);
    fileAnnotations.set(node.id, annotation);
    annotations.set(node.id, annotation);
  }

  // Propagate to non-File nodes (Method, Function inherit parent File's layer)
  for (const node of nodes) {
    if (node.type === 'File') continue;

    // Try to find parent file annotation via filePath
    const parentFile = fileNodes.find((f) => f.filePath === node.filePath);
    if (parentFile) {
      const parentAnnotation = fileAnnotations.get(parentFile.id);
      if (parentAnnotation) {
        annotations.set(node.id, parentAnnotation);
        continue;
      }
    }

    // For Class/Interface nodes, try direct annotation
    if (node.type === 'Class' || node.type === 'Interface') {
      const annotation = annotateEntityNode(node, matchers);
      annotations.set(node.id, annotation);
      // Also set for child methods via filePath propagation above
    } else {
      annotations.set(node.id, { layer: null, role: null, matchMethod: null });
    }
  }

  // Build summary
  const fileCount = fileNodes.length;
  let mapped = 0;
  const unmappedFiles: string[] = [];

  for (const node of fileNodes) {
    const ann = annotations.get(node.id);
    if (ann?.layer != null) {
      mapped++;
    } else {
      unmappedFiles.push(node.filePath);
    }
  }

  return {
    annotations,
    summary: {
      mapped,
      unmapped: fileCount - mapped,
      unmappedFiles,
    },
  };
}

function annotateFileNode(
  node: APGNode,
  matchers: { mapping: LayerMapping; match: (path: string) => boolean }[],
): LayerAnnotation {
  // Priority 1: Directory matching
  for (const { mapping, match } of matchers) {
    if (match(node.filePath)) {
      return {
        layer: mapping.layerName,
        role: mapping.roles[0] ?? null,
        matchMethod: 'directory',
      };
    }
  }

  // Priority 2/3: naming and decorator are handled on Class nodes
  return { layer: null, role: null, matchMethod: null };
}

function annotateEntityNode(
  node: APGNode,
  matchers: { mapping: LayerMapping; match: (path: string) => boolean }[],
): LayerAnnotation {
  // Try directory match first via filePath
  for (const { mapping, match } of matchers) {
    if (match(node.filePath)) {
      return {
        layer: mapping.layerName,
        role: mapping.roles[0] ?? null,
        matchMethod: 'directory',
      };
    }
  }

  // Priority 2: Naming match (role-based pattern on class name)
  for (const { mapping } of matchers) {
    for (const role of mapping.roles) {
      const pattern = roleToPattern(role);
      if (pattern.test(node.name)) {
        return {
          layer: mapping.layerName,
          role,
          matchMethod: 'naming',
        };
      }
    }
  }

  // Priority 3: Decorator match
  const nodeDecorators = (node.properties?.['decorators'] as string[] | undefined) ?? [];
  for (const { mapping } of matchers) {
    for (const dec of mapping.decorators) {
      if (nodeDecorators.includes(dec)) {
        return {
          layer: mapping.layerName,
          role: null,
          matchMethod: 'decorator',
        };
      }
    }
  }

  return { layer: null, role: null, matchMethod: null };
}

function roleToPattern(role: string): RegExp {
  // Convert role like "entity" to /Entity$/i, "use-case" to /UseCase$/i
  const pascal = role.split('-').map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('');
  return new RegExp(`${pascal}$`, 'i');
}
