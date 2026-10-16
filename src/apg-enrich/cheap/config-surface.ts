/**
 * Batch 2, proxy 15, CONFIG SURFACE: which code reads which environment key.
 *
 * READS_ENV (owner unit → `EnvKey` virtual node `env:<KEY>`), one edge per owner and key with every read line:
 * - `process.env.X`, `process.env['X']`, `const { X } = process.env` (the destructured names), `import.meta.env.X`;
 * - `config.get('X')` / `getOrThrow('X')` on a value whose type comes from `@nestjs/config` (`ConfigService`) or the
 *   `config` package.
 * A computed key (`process.env[name]`) goes to `env:*` with `dynamic: true`. The owner is the enclosing Method /
 * Function node, else the Class, else the File (`ownerNodeId`).
 *
 * Flags:
 * - `env-read-outside-config`: a read in a file that is not a configuration or infrastructure module. Allowed: an
 *   infrastructure-kind layer; a path segment or file name `config`, `configuration`, `settings` or `env`; a class
 *   named `*Config`, `*Configuration` or `*Settings`; the composition root (`main`, `bootstrap`, `server` files).
 * - `env-key-shared`: a key read in more than `envSharedComponents` (default 2) components, one flag per key at its
 *   first read, naming the components: the key is a configuration contract nobody owns.
 */
import * as path from 'node:path';
import { Node } from 'ts-morph';
import type { CheapContext } from './context.js';
import { callGraph } from './callgraph.js';
import { countKinds, ownerNodeId } from './error-flow.js';
import type { CheapEdge, CheapFlag, CheapProxyOutput, CheapVirtualNode, Evidence } from './types.js';

const CONFIG_PATH = /(^|\/)(config|configuration|configs|settings|env|environment)(\/|\.|$)/i;
const CONFIG_CLASS = /(Config|Configuration|Settings)$/;
const ROOT_FILES = new Set(['main', 'bootstrap', 'server']);
const CONFIG_GET = new Set(['get', 'getOrThrow']);

interface EnvRead {
  readonly key: string;
  readonly dynamic: boolean;
  readonly via: string;
  readonly node: Node;
}

/** The env reads of a source file. */
export function envReads(ctx: CheapContext, root: Node): EnvRead[] {
  const out: EnvRead[] = [];
  const isProcessEnv = (n: Node): boolean => Node.isPropertyAccessExpression(n) && n.getName() === 'env' && n.getExpression().getText() === 'process';
  const isImportMetaEnv = (n: Node): boolean => Node.isPropertyAccessExpression(n) && n.getName() === 'env' && n.getExpression().getText() === 'import.meta';
  root.forEachDescendant((n) => {
    if (isProcessEnv(n) || isImportMetaEnv(n)) {
      const via = isProcessEnv(n) ? 'process.env' : 'import.meta.env';
      const p = n.getParent();
      if (p !== undefined && Node.isPropertyAccessExpression(p) && p.getExpression() === n) {
        out.push({ key: p.getName(), dynamic: false, via, node: p });
      } else if (p !== undefined && Node.isElementAccessExpression(p) && p.getExpression() === n) {
        const arg = p.getArgumentExpression();
        if (arg !== undefined && (Node.isStringLiteral(arg) || Node.isNoSubstitutionTemplateLiteral(arg))) out.push({ key: arg.getLiteralText(), dynamic: false, via, node: p });
        else out.push({ key: '*', dynamic: true, via, node: p });
      } else if (p !== undefined && Node.isVariableDeclaration(p) && p.getInitializer() === n && Node.isObjectBindingPattern(p.getNameNode())) {
        const pattern = p.getNameNode();
        if (Node.isObjectBindingPattern(pattern)) for (const el of pattern.getElements()) out.push({ key: (el.getPropertyNameNode() ?? el.getNameNode()).getText(), dynamic: false, via, node: el });
      } else {
        out.push({ key: '*', dynamic: true, via, node: n });
      }
      return;
    }
    if (Node.isCallExpression(n)) {
      const e = n.getExpression();
      if (!Node.isPropertyAccessExpression(e) || !CONFIG_GET.has(e.getName())) return;
      const t = e.getExpression().getType();
      const d = (t.getSymbol() ?? t.getAliasSymbol())?.getDeclarations()[0];
      const mod = d === undefined ? null : ctx.moduleOf(d);
      if (mod !== '@nestjs/config' && mod !== 'config') return;
      const arg = n.getArguments()[0];
      if (arg !== undefined && (Node.isStringLiteral(arg) || Node.isNoSubstitutionTemplateLiteral(arg))) out.push({ key: arg.getLiteralText(), dynamic: false, via: `${mod}.${e.getName()}`, node: n });
      else out.push({ key: '*', dynamic: true, via: `${mod}.${e.getName()}`, node: n });
    }
  });
  return out;
}

function isConfigModule(ctx: CheapContext, file: string, className: string | undefined): boolean {
  if (ctx.info(file).layerKind === 'infrastructure') return true;
  if (CONFIG_PATH.test(file)) return true;
  if (className !== undefined && CONFIG_CLASS.test(className)) return true;
  return ROOT_FILES.has(path.posix.basename(file).replace(/\.(ts|tsx|mts|cts)$/, ''));
}

export function runConfigSurface(ctx: CheapContext): CheapProxyOutput {
  const g = callGraph(ctx);
  const edges: CheapEdge[] = [];
  const flags: CheapFlag[] = [];
  const perOwner = new Map<string, { owner: string; key: string; lines: number[]; evidence: Evidence[]; via: string; dynamic: boolean; outsideConfig: boolean }>();
  const perKey = new Map<string, { components: Set<string>; first: Evidence; files: Set<string> }>();
  let reads = 0;
  for (const { file, sf } of ctx.sources) {
    for (const r of envReads(ctx, sf)) {
      reads++;
      const uid = g.unitAt(r.node);
      const u = uid === undefined ? undefined : g.units.get(uid);
      const owner = (u === undefined ? undefined : ownerNodeId(ctx, u)) ?? ctx.info(file).fileNodeId;
      const ev = ctx.evidence(r.node);
      const cls = u?.className;
      const outside = !isConfigModule(ctx, file, cls);
      if (owner !== undefined) {
        const k = `${owner}|${r.key}`;
        const rec = perOwner.get(k) ?? { owner, key: r.key, lines: [], evidence: [], via: r.via, dynamic: r.dynamic, outsideConfig: false };
        rec.lines.push(ev.startLine);
        rec.evidence.push(ev);
        rec.outsideConfig ||= outside;
        perOwner.set(k, rec);
      }
      if (!r.dynamic) {
        const pk = perKey.get(r.key) ?? { components: new Set<string>(), first: ev, files: new Set<string>() };
        pk.components.add(ctx.info(file).component);
        pk.files.add(file);
        perKey.set(r.key, pk);
      }
      if (outside) {
        flags.push({ proxy: 'config-surface', kind: 'env-read-outside-config', score: 1, evidence: ev, ...(cls !== undefined ? { className: cls } : {}), ...(u !== undefined && u.kind !== 'module' ? { methodName: u.name } : {}), message: `${file} reads ${r.dynamic ? 'a computed env key' : `env key ${r.key}`} through ${r.via} outside a config or infrastructure module (layer ${ctx.info(file).layer ?? 'none'})` });
      }
    }
  }
  for (const rec of [...perOwner.values()].sort((a, b) => (a.owner + a.key < b.owner + b.key ? -1 : 1))) {
    edges.push({ type: 'READS_ENV', proxy: 'config-surface', sourceId: rec.owner, targetId: `env:${rec.key}`, score: 1, evidence: rec.evidence, properties: { key: rec.key, via: rec.via, dynamic: rec.dynamic, lines: rec.lines, outsideConfig: rec.outsideConfig } });
  }
  const virtualNodes: CheapVirtualNode[] = [];
  const keys: Record<string, { components: string[]; files: number }> = {};
  for (const [key, pk] of [...perKey.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    const cs = [...pk.components].sort();
    keys[key] = { components: cs, files: pk.files.size };
    virtualNodes.push({ id: `env:${key}`, kind: 'EnvKey', name: key, properties: { components: cs, files: pk.files.size } });
    if (cs.length > ctx.options.envSharedComponents) {
      flags.push({ proxy: 'config-surface', kind: 'env-key-shared', score: cs.length / ctx.options.envSharedComponents, evidence: pk.first, message: `env key ${key} is read in ${String(cs.length)} components (${cs.join(', ')})` });
    }
  }
  if ([...perOwner.values()].some((r) => r.dynamic)) virtualNodes.push({ id: 'env:*', kind: 'EnvKey', name: '*', properties: { dynamic: true } });
  return { edges, nodeFacts: [], flags, virtualNodes, summary: { reads, keys, flagsByKind: countKinds(flags) } };
}
