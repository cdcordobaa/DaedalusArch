import { createHash } from 'node:crypto';
import type { EdgeType, NodeType } from '../shared/types/enums.js';

/**
 * Generate a deterministic 16-char hex node ID.
 * Input is lowercased before hashing for macOS/Windows case-insensitivity.
 *
 * Format: SHA-256("{type}:{normalizedFilePath}:{name}")[0..16]
 */
export function generateNodeId(type: NodeType, normalizedFilePath: string, name: string): string {
  const input = `${type}:${normalizedFilePath}:${name}`.toLowerCase();
  return createHash('sha256').update(input).digest('hex').slice(0, 16);
}

/**
 * Generate a deterministic 16-char hex edge ID.
 *
 * Format: SHA-256("{edgeType}:{sourceId}:{targetId}")[0..16]
 */
export function generateEdgeId(edgeType: EdgeType, sourceId: string, targetId: string): string {
  const input = `${edgeType}:${sourceId}:${targetId}`.toLowerCase();
  return createHash('sha256').update(input).digest('hex').slice(0, 16);
}

/**
 * Normalize an absolute file path to a POSIX-style path relative to the project root.
 * Used as the canonical filePath in node IDs and APGNode.filePath.
 */
export function normalizeFilePath(absolutePath: string, projectRoot: string): string {
  const root = projectRoot.endsWith('/') ? projectRoot : projectRoot + '/';
  const relative = absolutePath.startsWith(root)
    ? absolutePath.slice(root.length)
    : absolutePath;
  // Normalize Windows backslashes to POSIX forward slashes
  return relative.replace(/\\/g, '/');
}
