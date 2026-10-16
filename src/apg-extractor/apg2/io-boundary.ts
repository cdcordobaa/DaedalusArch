import { Node, SyntaxKind } from 'ts-morph';
import type { SourceFile } from 'ts-morph';
import type { APGEdge, APGNode } from '../../shared/types/apg.js';
import type { NodeLookup } from '../types.js';
import { normalizeFilePath } from '../id-generator.js';
import { apg2Edge, apg2Node, isAmbientGlobal, lineOf, originOfValue, packageRoot } from './common.js';

/**
 * Enrichment 5, the I/O and side-effect boundary: PERFORMS_IO edges from the owning Method / Function / Class / File
 * node to one IOCategory node per category. Detected by resolved calls:
 * - globals (only when the name resolves to the TypeScript lib or `@types/node`, not a project declaration):
 *   `fetch()` → http-out; `Date.now()`, `new Date()` with no argument, `performance.now()` → clock; `Math.random()`,
 *   `crypto.randomUUID / randomBytes / randomInt / getRandomValues` → random; `process.env` → env; any other
 *   `process.*` member → process;
 * - calls and `new` on a value whose origin package (`originOfValue`) is in `IO_PACKAGES` (decorator calls excluded:
 *   `@Column()` declares a mapping, it performs no I/O).
 */

export const APG2_IO_CATEGORIES = ['db', 'http-out', 'fs', 'env', 'clock', 'random', 'process'] as const;
export type IoCategory = (typeof APG2_IO_CATEGORIES)[number];

export const IO_PACKAGES: ReadonlyMap<string, IoCategory> = new Map<string, IoCategory>([
  ...['@prisma/client', 'prisma', 'typeorm', '@nestjs/typeorm', 'mongoose', '@nestjs/mongoose', 'mongodb', 'pg', 'mysql',
    'mysql2', 'sqlite3', 'better-sqlite3', 'knex', 'sequelize', '@mikro-orm/core', 'drizzle-orm', 'redis', 'ioredis']
    .map((p) => [p, 'db'] as [string, IoCategory]),
  ...['axios', '@nestjs/axios', 'node-fetch', 'got', 'undici', 'http', 'https', 'http2', 'superagent', 'ky']
    .map((p) => [p, 'http-out'] as [string, IoCategory]),
  ...['fs', 'fs-extra', 'graceful-fs'].map((p) => [p, 'fs'] as [string, IoCategory]),
  ...['child_process', 'execa'].map((p) => [p, 'process'] as [string, IoCategory]),
  ...['uuid', 'nanoid'].map((p) => [p, 'random'] as [string, IoCategory]),
]);

const CRYPTO_RANDOM = /^(randomUUID|randomBytes|randomInt|randomFill|randomFillSync|getRandomValues)$/;

export interface IoStats {
  readonly byCategory: Record<IoCategory, number>;
}

interface IoHit {
  readonly category: IoCategory;
  readonly api: string;
  readonly node: Node;
}

function globalHit(node: Node): IoHit | undefined {
  // `process.env` (a read of any variable) and `process.<member>`
  if (Node.isPropertyAccessExpression(node)) {
    const obj = node.getExpression();
    if (Node.isIdentifier(obj) && obj.getText() === 'process' && isAmbientGlobal(obj)) {
      const parent = node.getParent();
      // count `process.env.X` once, at the `process.env` access
      return node.getName() === 'env'
        ? { category: 'env', api: 'process.env', node }
        : Node.isPropertyAccessExpression(parent) && parent.getExpression() === node ? undefined
          : { category: 'process', api: `process.${node.getName()}`, node };
    }
    return undefined;
  }
  if (Node.isCallExpression(node)) {
    const e = node.getExpression();
    if (Node.isIdentifier(e) && e.getText() === 'fetch' && isAmbientGlobal(e)) return { category: 'http-out', api: 'fetch()', node };
    if (Node.isPropertyAccessExpression(e)) {
      const obj = e.getExpression();
      const m = e.getName();
      if (Node.isIdentifier(obj) && isAmbientGlobal(obj)) {
        const o = obj.getText();
        if (o === 'Date' && m === 'now') return { category: 'clock', api: 'Date.now()', node };
        if (o === 'performance' && m === 'now') return { category: 'clock', api: 'performance.now()', node };
        if (o === 'Math' && m === 'random') return { category: 'random', api: 'Math.random()', node };
        if (o === 'crypto' && CRYPTO_RANDOM.test(m)) return { category: 'random', api: `crypto.${m}()`, node };
      }
    }
  }
  if (Node.isNewExpression(node)) {
    const e = node.getExpression();
    if (Node.isIdentifier(e) && e.getText() === 'Date' && (node.getArguments().length === 0) && isAmbientGlobal(e)) {
      return { category: 'clock', api: 'new Date()', node };
    }
  }
  return undefined;
}

function packageHit(node: Node): IoHit | undefined {
  if (!Node.isCallExpression(node) && !Node.isNewExpression(node)) return undefined;
  if (Node.isDecorator(node.getParent())) return undefined;
  const callee = node.getExpression();
  // A call on a member of a value already counted at an inner call (`prisma.user.findMany()` is one call; the chain
  // `axios.get().then()` is attributed once, to the innermost package call) is still one hit per call expression.
  const origin = originOfValue(callee);
  if (origin === undefined) return undefined;
  const root = packageRoot(origin.pkg);
  let category = IO_PACKAGES.get(root) ?? IO_PACKAGES.get(origin.pkg);
  if (category === undefined && root === 'crypto') {
    const name = Node.isPropertyAccessExpression(callee) ? callee.getName() : callee.getText();
    if (CRYPTO_RANDOM.test(name)) category = 'random';
  }
  if (category === undefined) return undefined;
  const short = callee.getText().replace(/\s+/g, '');
  return { category, api: `${root}:${short.length > 60 ? `${short.slice(0, 57)}...` : short}`, node };
}

export function extractIoBoundary(
  sourceFiles: readonly SourceFile[],
  lookup: NodeLookup,
  projectRoot: string,
  ownerOf: (node: Node, filePath: string) => string | undefined,
): { nodes: APGNode[]; edges: APGEdge[]; stats: IoStats } {
  const byCategory = Object.fromEntries(APG2_IO_CATEGORIES.map((c) => [c, 0])) as Record<IoCategory, number>;
  const categoryNodes = new Map<IoCategory, APGNode>();
  const edges = new Map<string, APGEdge>();

  for (const sf of sourceFiles) {
    const filePath = normalizeFilePath(sf.getFilePath(), projectRoot);
    if (!lookup.fileNodes.has(filePath)) continue;
    sf.forEachDescendant((node, traversal) => {
      if (node.getKind() === SyntaxKind.ImportDeclaration || node.getKind() === SyntaxKind.TypeReference) {
        traversal.skip();
        return;
      }
      let hit: IoHit | undefined;
      try {
        hit = globalHit(node) ?? packageHit(node);
      } catch {
        hit = undefined;
      }
      if (hit === undefined) return;
      const owner = ownerOf(node, filePath);
      if (owner === undefined) return;
      let cat = categoryNodes.get(hit.category);
      if (cat === undefined) {
        cat = apg2Node('IOCategory', 'io', hit.category, {});
        categoryNodes.set(hit.category, cat);
      }
      byCategory[hit.category]++;
      const key = `${owner}:${cat.id}`;
      const existing = edges.get(key);
      if (existing !== undefined) {
        const apis = existing.properties.apis as string[];
        if (!apis.includes(hit.api)) apis.push(hit.api);
        (existing.properties.lines as number[]).push(lineOf(hit.node));
        return;
      }
      edges.set(key, apg2Edge('PERFORMS_IO', owner, cat.id, { category: hit.category, apis: [hit.api], line: lineOf(hit.node), lines: [lineOf(hit.node)] }));
    });
  }
  const nodes = APG2_IO_CATEGORIES.flatMap((c) => categoryNodes.get(c) ?? []);
  return { nodes, edges: [...edges.values()], stats: { byCategory } };
}
