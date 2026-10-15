/**
 * Batch 2, proxy 13, THIRD-PARTY SDK SPREAD: how far each external package reaches into the project.
 *
 * Read from the APG: every IMPORTS edge (static, dynamic and `require`, literal view: `viaReExport` edges dropped) from
 * a File node to a Package node. Built-in node modules (`scope: node`) and path aliases (`~`) are not third-party.
 * Per package: the components and layers of the files that import it directly, and
 * spread(p) = |components importing p| / |components|. The project's SDK spread index is the mean spread of the vendor
 * SDKs it imports (null when it imports none).
 *
 * Vendor SDKs (`VENDOR_SDK`): cloud and SaaS clients, HTTP clients and database clients / drivers. ORM frameworks whose
 * decorators define the persistence mapping (TypeORM, Sequelize, MikroORM) are left out: FF-P01 and the batch-1
 * repository-bypass proxy cover them.
 *
 * Flag `vendor-sdk-outside-adapters`: a vendor SDK imported by a file that is not an adapter: with a layer model, a
 * file whose layer is not infrastructure-kind and none of whose classes is in the adapter or repository role by
 * name; without one, a file outside an `infra*`, `adapters`, `persistence`, `gateways`, `clients`, `integrations` or
 * `providers` directory with no adapter or repository class. A type-only import scores 0.5.
 */
import type { CheapContext } from './context.js';
import { classesOf } from './context.js';
import { roleFromName } from './behaviour.js';
import { countKinds } from './error-flow.js';
import type { CheapFlag, CheapNodeFact, CheapProxyOutput } from './types.js';

export const VENDOR_SDK: readonly RegExp[] = [
  /^aws-sdk$/, /^@aws-sdk\/.+/, /^@google-cloud\/.+/, /^googleapis$/, /^@azure\/.+/, /^firebase$/, /^firebase-admin$/,
  /^@firebase\/.+/, /^stripe$/, /^@stripe\/.+/, /^twilio$/, /^@sendgrid\/.+/, /^nodemailer$/, /^mailgun\.js$/,
  /^@slack\/.+/, /^openai$/, /^@anthropic-ai\/sdk$/, /^@octokit\/.+/, /^algoliasearch$/, /^@elastic\/elasticsearch$/,
  /^axios$/, /^node-fetch$/, /^got$/, /^superagent$/, /^undici$/,
  /^@prisma\/client$/, /^prisma$/, /^mongoose$/, /^mongodb$/, /^pg$/, /^mysql2?$/, /^redis$/, /^ioredis$/,
  /^@supabase\/supabase-js$/, /^kafkajs$/, /^amqplib$/, /^@aws-sdk$/,
];

export function isVendorSdk(pkg: string): boolean {
  return VENDOR_SDK.some((re) => re.test(pkg));
}

const ADAPTER_DIRS = /(^|\/)(infra|infrastructure|adapters?|persistence|gateways?|clients?|integrations?|providers?|outbound)(\/|$)/;

export function runSdkSpread(ctx: CheapContext): CheapProxyOutput {
  const byId = new Map(ctx.apg.nodes.map((n) => [n.id, n]));
  const comps = new Set([...ctx.files.values()].map((f) => f.component));
  const sfOf = new Map(ctx.sources.map((s) => [s.file, s.sf]));
  const isAdapterFile = (file: string): boolean => {
    const info = ctx.info(file);
    const roles = (sfOf.get(file) === undefined ? [] : classesOf(sfOf.get(file)!)).map((c) => roleFromName(c.getName() ?? ''));
    if (roles.some((r) => r === 'adapter' || r === 'repository')) return true;
    if (info.layer !== null) return info.layerKind === 'infrastructure';
    return ADAPTER_DIRS.test(file);
  };
  const perPkg = new Map<string, { files: Map<string, { typeOnly: boolean; line: number }>; nodeId: string }>();
  for (const e of ctx.apg.edges) {
    if (e.type !== 'IMPORTS' || e.properties.viaReExport === true) continue;
    const s = byId.get(e.sourceId);
    const t = byId.get(e.targetId);
    if (s?.type !== 'File' || t?.type !== 'Package') continue;
    if (t.properties.scope === 'node' || t.name === '~') continue;
    const rec = perPkg.get(t.name) ?? { files: new Map<string, { typeOnly: boolean; line: number }>(), nodeId: t.id };
    const prev = rec.files.get(s.filePath);
    const typeOnly = e.properties.isTypeOnly === true;
    rec.files.set(s.filePath, { typeOnly: (prev?.typeOnly ?? true) && typeOnly, line: typeof e.properties.line === 'number' ? e.properties.line : 1 });
    perPkg.set(t.name, rec);
  }
  const nodeFacts: CheapNodeFact[] = [];
  const flags: CheapFlag[] = [];
  const packages: Record<string, { vendor: boolean; files: number; components: string[]; layers: string[]; spread: number }> = {};
  const vendorSpreads: number[] = [];
  /** File → vendor SDKs it imports outside an adapter (the `vendor-sdk-outside-adapters` template reads it). */
  const outside = new Map<string, string[]>();
  for (const [pkg, rec] of [...perPkg.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    const files = [...rec.files.keys()].sort();
    const cs = [...new Set(files.map((f) => ctx.info(f).component))].sort();
    const ls = [...new Set(files.map((f) => ctx.info(f).layer ?? '(none)'))].sort();
    const spread = comps.size === 0 ? 0 : cs.length / comps.size;
    const vendor = isVendorSdk(pkg);
    if (vendor) vendorSpreads.push(spread);
    packages[pkg] = { vendor, files: files.length, components: cs, layers: ls, spread: round(spread) };
    nodeFacts.push({ proxy: 'sdk-spread', nodeId: rec.nodeId, key: 'sdkSpread', value: { vendor, importingFiles: files.length, importingComponents: cs, importingLayers: ls, spreadIndex: round(spread) } });
    if (!vendor) continue;
    for (const f of files) {
      if (isAdapterFile(f)) continue;
      outside.set(f, [...(outside.get(f) ?? []), pkg]);
      const imp = rec.files.get(f);
      flags.push({
        proxy: 'sdk-spread', kind: 'vendor-sdk-outside-adapters', score: imp?.typeOnly === true ? 0.5 : 1,
        evidence: { file: f, startLine: imp?.line ?? 1, endLine: imp?.line ?? 1 },
        message: `vendor SDK ${pkg} imported${imp?.typeOnly === true ? ' (type only)' : ''} by ${f} (layer ${ctx.info(f).layer ?? 'none'}, component ${ctx.info(f).component}); ${pkg} spreads over ${String(cs.length)} of ${String(comps.size)} components`,
      });
    }
  }
  for (const [f, pkgs] of [...outside.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    const id = ctx.info(f).fileNodeId;
    if (id !== undefined) nodeFacts.push({ proxy: 'sdk-spread', nodeId: id, key: 'vendorSdkOutsideAdapters', value: pkgs.sort() });
  }
  for (const [pkg, rec] of perPkg) nodeFacts.push({ proxy: 'sdk-spread', nodeId: rec.nodeId, key: 'vendorSdk', value: isVendorSdk(pkg) });
  const index = vendorSpreads.length === 0 ? null : round(vendorSpreads.reduce((s, x) => s + x, 0) / vendorSpreads.length);
  return { edges: [], nodeFacts, flags, summary: { components: comps.size, packages, vendorPackages: vendorSpreads.length, sdkSpreadIndex: index, flagsByKind: countKinds(flags) } };
}

function round(x: number): number {
  return Math.round(x * 1e4) / 1e4;
}
