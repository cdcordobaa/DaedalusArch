/**
 * Fix-hint templates, one per rule family. Each template reads the finding, the spec's layer model (`SpecModel`) and,
 * when present, the graph facts, and returns the hint with the graph edit it stands for. Every choice is a fixed rule
 * over those inputs, documented in Docs/v1.3/fix-hints.md §2; nothing is generated.
 */
import * as path from 'node:path';
import type { GraphFacts } from './graph-facts.js';
import { DATA_SHAPE, SpecModel, nameOfFile, portNameFor, stemOf } from './spec-model.js';
import type { FixHint, FixHintFamily, GraphEditOp, HintFinding } from './types.js';
import { globToRegex } from '../fitness-compiler/glob-to-regex.js';
import type { DddAggregate } from '../shared/types/spec.js';

export interface HintContext {
  readonly model: SpecModel;
  readonly graph?: GraphFacts | undefined;
}

type Draft = Omit<FixHint, 'ruleId' | 'ruleName' | 'basis'> & { readonly usedGraph?: boolean };

const base = (file: string): string => path.posix.basename(file);
const dirOf = (file: string): string => `${path.posix.dirname(file)}/`;
const at = (file: string, layer: string | null): string => `${file} (${layer ?? 'no layer'})`;
const edgeText = (m: SpecModel, from: string, to: string): string => `${at(from, m.layerOf(from))} -> ${at(to, m.layerOf(to))}`;

/** The name an edge uses from its target: the first imported name, else the target file's name. */
function usedName(f: HintFinding, ctx: HintContext, src: string, tgt: string): string {
  const fromGraph = ctx.graph?.importsOf(src).find((i) => i.target === tgt)?.importedNames;
  const names = (f.importedNames ?? fromGraph ?? []).filter((n) => n !== '*' && n !== 'default');
  return names[0] ?? nameOfFile(tgt);
}

/** A layer that both `a` and `b` may import, `prefer` first, then the spec's layer order. */
function sharedLayer(m: SpecModel, a: string | null, b: string | null, prefer: readonly (string | null)[]): string | undefined {
  const order = [...prefer.filter((p): p is string => p !== null), ...m.names];
  return order.find((l) => m.mayImport(a, l) && m.mayImport(b, l));
}

// ── Dependency direction (FF-S01, FF-S04, FF-S03 upward, hexagonal graph rules) ────────────────────────────────

function introducePort(ctx: HintContext, src: string, srcL: string | null, tgt: string, tgtL: string | null, name: string): Draft | undefined {
  const m = ctx.model;
  const layer = sharedLayer(m, srcL, tgtL, [srcL]);
  if (layer === undefined) return undefined;
  const place = m.placement(layer, src, name);
  if (place === undefined) return undefined;
  const classes = ctx.graph?.declarations(tgt).classes ?? [];
  const edit: GraphEditOp[] = [
    { op: 'remove-import', from: src, to: tgt },
    { op: 'add-file', path: place.path, layer, declares: { kind: 'Interface', name } },
    { op: 'add-import', from: src, to: place.path, typeOnly: true },
    { op: 'add-import', from: tgt, to: place.path, typeOnly: true },
    ...classes.slice(0, 1).map((c): GraphEditOp => ({ op: 'add-implements', classFile: tgt, className: c, interfaceFile: place.path, interfaceName: name })),
  ];
  return {
    family: 'dependency-direction', problem: '', breaks: { dependency: '', rule: '' },
    target: { layer, folder: place.folder, path: place.path },
    fix: {
      action: 'introduce-port',
      text: `Introduce a port interface ${name} in ${place.path} (${layer}) for what ${base(src)} uses from ${base(tgt)}; make ${base(src)} depend on ${name}, let ${base(tgt)} implement it, and wire the implementation in the composition root.`,
    },
    edit,
  };
}

/**
 * The declaration the source uses moves out of the target into its own file in the source's layer (or a layer both may
 * import); the target imports it from there. `kind` words the hint: a type the source owns, or a value (constant).
 */
function moveDeclaration(ctx: HintContext, src: string, srcL: string | null, tgt: string, tgtL: string | null, name: string, kind: 'type' | 'value'): Draft | undefined {
  const m = ctx.model;
  const layer = sharedLayer(m, srcL, tgtL, [srcL]);
  if (layer === undefined) return undefined;
  const fileBase = kind === 'value' ? camelOf(name) : name;
  const place = m.placement(layer, src, fileBase);
  if (place === undefined) return undefined;
  return {
    family: 'dependency-direction', problem: '', breaks: { dependency: '', rule: '' },
    target: { layer, folder: place.folder, path: place.path },
    fix: {
      action: 'move-declaration',
      text: kind === 'value'
        ? `Move the value ${name} out of ${base(tgt)} into ${place.path} (${layer}), where ${base(src)} may import it; ${base(tgt)} imports it from there.`
        : `Declare the type ${name} that ${base(src)} needs in ${place.path} (${layer}) and import it from there; ${base(tgt)} (${tgtL ?? 'no layer'}) imports or maps to it instead of owning it.`,
    },
    edit: [
      { op: 'remove-import', from: src, to: tgt },
      { op: 'add-file', path: place.path, layer, declares: { kind: kind === 'value' ? 'Class' : 'Interface', name } },
      { op: 'add-import', from: src, to: place.path, typeOnly: true },
      { op: 'add-import', from: tgt, to: place.path, typeOnly: true },
    ],
  };
}

/** `PAYMENT_FEE_CENTS` -> `paymentFeeCents`; other names unchanged. */
function camelOf(name: string): string {
  if (!/^[A-Z0-9_]+$/.test(name)) return name;
  return name.toLowerCase().replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}

/**
 * A layer an abstraction file (`file`, declaring only types) may move to: the source may import it, every importer of the
 * file may import it, and it may import every file the moved file imports. `prefer` first, then the layer order.
 */
function moveTargetLayer(ctx: HintContext, file: string, srcL: string | null, prefer: string | null): string | undefined {
  const m = ctx.model;
  const g = ctx.graph;
  const fileL = m.layerOf(file);
  const importers = g?.importersOf(file) ?? [];
  const deps = (g?.importsOf(file) ?? []).filter((i) => !i.package).map((i) => m.layerOf(i.target));
  return [prefer, ...m.names].find(
    (l): l is string => l !== null && l !== fileL && m.mayImport(srcL, l) && importers.every((i) => m.mayImport(m.layerOf(i), l)) && deps.every((dl) => m.mayImport(l, dl)),
  );
}

function isAbstraction(g: GraphFacts | undefined, file: string): boolean {
  const d = g?.declarations(file);
  return d?.classes.length === 0 && d.functions.length === 0 && d.interfaces.length > 0;
}

function edgeDirection(ctx: HintContext, f: HintFinding, src: string, tgt: string): Draft | undefined {
  const m = ctx.model;
  const g = ctx.graph;
  const srcL = m.layerOf(src);
  const tgtL = m.layerOf(tgt);
  const srcRole = m.roleOf(srcL);
  const tgtRole = m.roleOf(tgtL);
  const name = usedName(f, ctx, src, tgt);
  const core = m.style !== 'layered' && (srcRole === 'domain' || srcRole === 'application') && tgtRole !== 'presentation';

  if (core) {
    const d = g?.declarations(tgt);
    // (0) The source imports a value (a constant), not a class or a type: move that value into the source's layer.
    const imported = g?.importsOf(src).find((i) => i.target === tgt)?.importedNames ?? [];
    if (d !== undefined && imported.includes(name) && !d.classes.includes(name) && !d.interfaces.includes(name) && !DATA_SHAPE.test(name)) {
      return mapDraft(moveDeclaration(ctx, src, srcL, tgt, tgtL, name, 'value'), (x) => ({ ...x, usedGraph: true }));
    }
    if (g !== undefined) {
      const ports = g.implementedBy(tgt).filter((p): p is { name: string; file: string } => p.file !== undefined && p.file !== tgt).sort((a, b) => a.file.localeCompare(b.file));
      // (a) The target implements a port the source may import: depend on that port.
      const usable = ports.find((p) => m.mayImport(srcL, m.layerOf(p.file)));
      if (usable !== undefined) {
        const layer = m.layerOf(usable.file);
        return {
          family: 'dependency-direction', problem: '', breaks: { dependency: '', rule: '' },
          target: { layer, folder: dirOf(usable.file), path: usable.file },
          fix: { action: 'use-existing-port', text: `Depend on the port ${usable.name} (${usable.file}, ${layer ?? 'no layer'}) that ${base(tgt)} already implements, instead of on ${base(tgt)} itself; inject the implementation from the composition root.` },
          edit: [{ op: 'remove-import', from: src, to: tgt }, { op: 'add-import', from: src, to: usable.file, typeOnly: true }],
          usedGraph: true,
        };
      }
      // (b) The target implements a port (interfaces only) in a layer the source may not import: move that port inward.
      for (const p of ports) {
        if (!isAbstraction(g, p.file)) continue;
        const layer = moveTargetLayer(ctx, p.file, srcL, srcL);
        const place = layer === undefined ? undefined : m.placement(layer, src, nameOfFile(p.file));
        const to = place === undefined ? undefined : `${place.folder}${base(p.file)}`;
        if (layer === undefined || place === undefined || to === undefined || m.layerOf(to) !== layer) continue;
        return {
          family: 'dependency-direction', problem: '', breaks: { dependency: '', rule: '' },
          target: { layer, folder: place.folder, path: to },
          fix: { action: 'move-file', text: `Move the port ${p.name} that ${base(tgt)} implements from ${p.file} to ${to} (${layer}), and make ${base(src)} depend on ${p.name} instead of ${base(tgt)}; inject ${base(tgt)} from the composition root.` },
          edit: [{ op: 'move-file', from: p.file, to, layer }, { op: 'remove-import', from: src, to: tgt }, { op: 'add-import', from: src, to, typeOnly: true }],
          usedGraph: true,
        };
      }
    }
    // (c) The target declares only types (graph): move the whole file inward.
    if (isAbstraction(g, tgt)) {
      const layer = moveTargetLayer(ctx, tgt, srcL, srcL);
      const place = layer === undefined ? undefined : m.placement(layer, src, nameOfFile(tgt));
      const to = place === undefined ? undefined : `${place.folder}${base(tgt)}`;
      if (layer !== undefined && place !== undefined && to !== undefined && m.layerOf(to) === layer) {
        return {
          family: 'dependency-direction', problem: '', breaks: { dependency: '', rule: '' },
          target: { layer, folder: place.folder, path: to },
          fix: { action: 'move-file', text: `Move ${base(tgt)} (it declares only types) to ${to} in ${layer}, where ${base(src)} may depend on it; update its importers' paths.` },
          edit: [{ op: 'move-file', from: tgt, to, layer }],
          usedGraph: true,
        };
      }
    }
    // (d) The source uses a type of the target, not a class: move that declaration into the source's layer.
    if (d !== undefined) {
      if (d.interfaces.includes(name)) return mapDraft(moveDeclaration(ctx, src, srcL, tgt, tgtL, name, 'type'), (x) => ({ ...x, usedGraph: true }));
    } else if (f.isTypeOnly === true || DATA_SHAPE.test(name)) {
      return moveDeclaration(ctx, src, srcL, tgt, tgtL, DATA_SHAPE.test(name) ? `${stemOf(name)}Data` : name, 'type');
    }
    // (e) A class: a data shape (DTO, record) becomes a type the source owns; anything else gets a port (dependency inversion).
    if (DATA_SHAPE.test(name)) return mapDraft(moveDeclaration(ctx, src, srcL, tgt, tgtL, `${stemOf(name)}Data`, 'type'), (x) => ({ ...x, usedGraph: g !== undefined }));
    return introducePort(ctx, src, srcL, tgt, tgtL, portNameFor(name));
  }

  // Lift: an outer or lower layer reaches up (layered, nestjs data access, a core file using a presentation type).
  // The code that needs the target moves to the source's caller in a layer that may import both ends, else a new file there.
  const layer = [tgtL, ...m.names].find((l): l is string => l !== null && m.mayImport(l, srcL) && m.mayImport(l, tgtL));
  if (layer === undefined) return introducePort(ctx, src, srcL, tgt, tgtL, portNameFor(name));
  const callers = (g?.importersOf(src) ?? []).filter((c) => m.layerOf(c) === layer);
  const caller = pickByStem(callers, stemOf(nameOfFile(src)));
  if (caller !== undefined) {
    const imports = g?.importsOf(caller).some((i) => i.target === tgt) === true;
    return {
      family: 'dependency-direction', problem: '', breaks: { dependency: '', rule: '' },
      target: { layer, folder: dirOf(caller), path: caller },
      fix: {
        action: 'lift-to-caller',
        text: `Move the code in ${base(src)} that needs ${name} into its caller ${caller} (${layer}), which may import both ${srcL ?? 'the source'} and ${tgtL ?? 'the target'}: ${base(src)} returns its own data or raises its own error, and ${base(caller)} converts it with ${base(tgt)}.`,
      },
      edit: [{ op: 'remove-import', from: src, to: tgt }, ...(imports ? [] : [{ op: 'add-import', from: caller, to: tgt } as const])],
      usedGraph: true,
    };
  }
  const helper = `${nameOfFile(src)}${tgtRole === 'presentation' ? 'Presenter' : 'Mapper'}`;
  const place = m.placement(layer, tgt, helper);
  if (place === undefined) return introducePort(ctx, src, srcL, tgt, tgtL, portNameFor(name));
  return {
    family: 'dependency-direction', problem: '', breaks: { dependency: '', rule: '' },
    target: { layer, folder: place.folder, path: place.path },
    fix: {
      action: 'lift-to-caller',
      text: `Move the code in ${base(src)} that needs ${name} up into ${layer}, e.g. a new ${helper} in ${place.path}, which may import both ${srcL ?? 'the source'} and ${tgtL ?? 'the target'}: ${base(src)} returns its own data or raises its own error, and the ${layer} code converts it with ${base(tgt)}.`,
    },
    edit: [
      { op: 'remove-import', from: src, to: tgt },
      { op: 'add-file', path: place.path, layer, declares: { kind: 'Class', name: helper } },
      { op: 'add-import', from: place.path, to: src },
      { op: 'add-import', from: place.path, to: tgt },
    ],
  };
}

/** The file whose name shares `stem` (CatalogController -> CatalogService), else a *Service, else the first; sorted. */
function pickByStem(files: readonly string[], stem: string): string | undefined {
  const sorted = [...files].sort();
  return sorted.find((f) => stemOf(nameOfFile(f)) === stem) ?? sorted.find((f) => nameOfFile(f).endsWith('Service')) ?? sorted[0];
}

/** FF-S03 in closed layering, an inward import that skips a layer: route it through the layer in between. */
function layerSkip(ctx: HintContext, f: HintFinding, src: string, tgt: string): Draft | undefined {
  const m = ctx.model;
  const g = ctx.graph;
  const srcL = m.layerOf(src);
  const tgtL = m.layerOf(tgt);
  const via = m.names.find((l) => l !== srcL && l !== tgtL && m.mayImport(srcL, l) && m.mayImport(l, tgtL));
  if (via === undefined) return undefined;
  const name = usedName(f, ctx, src, tgt);
  const stem = stemOf(nameOfFile(tgt));
  const inVia = (g?.files ?? []).filter((file) => m.layerOf(file) === via);
  const sameStem = inVia.find((file) => nameOfFile(file) === stem);
  const wrapper = pickByStem(inVia.filter((file) => g?.importsOf(file).some((i) => i.target === tgt) === true), stemOf(nameOfFile(src)));
  const existing = DATA_SHAPE.test(nameOfFile(tgt)) ? sameStem ?? wrapper : wrapper ?? sameStem;
  if (existing !== undefined) {
    return {
      family: 'layer-skip', problem: '', breaks: { dependency: '', rule: '' },
      target: { layer: via, folder: dirOf(existing), path: existing },
      fix: {
        action: 'route-through',
        text: DATA_SHAPE.test(nameOfFile(tgt)) && existing === sameStem
          ? `Use the ${via} type ${nameOfFile(existing)} (${existing}) instead of ${name}; ${via} maps ${base(tgt)} to it.`
          : `Route through ${existing} (${via}), which already uses ${base(tgt)}: call it instead of importing ${base(tgt)} directly.`,
      },
      edit: [{ op: 'remove-import', from: src, to: tgt }, { op: 'add-import', from: src, to: existing }],
      usedGraph: true,
    };
  }
  const svc = `${stem}Service`;
  const place = m.placement(via, src, svc);
  if (place === undefined) return undefined;
  return {
    family: 'layer-skip', problem: '', breaks: { dependency: '', rule: '' },
    target: { layer: via, folder: place.folder, path: place.path },
    fix: { action: 'route-through', text: `Route through ${via}: add ${svc} in ${place.path} that wraps what ${base(src)} needs from ${base(tgt)}, and call it instead.` },
    edit: [
      { op: 'remove-import', from: src, to: tgt },
      { op: 'add-file', path: place.path, layer: via, declares: { kind: 'Class', name: svc } },
      { op: 'add-import', from: src, to: place.path },
      { op: 'add-import', from: place.path, to: tgt },
    ],
  };
}

// ── Cycles (FF-S02) ──────────────────────────────────────────────────────────────────────────────────────────────

function cycleFiles(f: HintFinding): readonly string[] {
  const raw = f.discriminator?.[0];
  if (raw?.startsWith('[') === true) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      /* fall through to the file path */
    }
  }
  return f.filePath.split(',').map((s) => s.trim()).filter((s) => s.length > 0);
}

function cycle(ctx: HintContext, f: HintFinding): Draft | undefined {
  const m = ctx.model;
  const files = cycleFiles(f);
  if (files.length < 3) return undefined;
  const edges = files.slice(0, -1).map((a, i) => ({ a, b: files[i + 1] ?? '' }));
  const typeOnly = (e: { a: string; b: string }): boolean => ctx.graph?.importsOf(e.a).some((i) => i.target === e.b && i.typeOnly) === true;
  const cut =
    edges.find((e) => !m.mayImport(m.layerOf(e.a), m.layerOf(e.b))) ??
    edges.find(typeOnly) ??
    edges[edges.length - 1];
  if (cut === undefined) return undefined;
  const ring = files.slice(0, -1).map(base).join(' -> ') + ` -> ${base(files[0] ?? '')}`;
  const name = `${usedName({ ruleId: f.ruleId, filePath: cut.a }, ctx, cut.a, cut.b)}Contract`;
  const port = introducePort(ctx, cut.a, m.layerOf(cut.a), cut.b, m.layerOf(cut.b), name);
  if (port === undefined) return undefined;
  return {
    ...port,
    family: 'cycle',
    problem: `The files ${ring} import each other in a cycle.`,
    breaks: { dependency: `${edgeText(m, cut.a, cut.b)} (the edge that closes the cycle${typeOnly(cut) ? ', type-only' : ''})`, rule: 'no import cycle between files (acyclic dependencies principle, FF-S02)' },
    fix: {
      action: 'break-cycle',
      text: `Break the cycle at ${base(cut.a)} -> ${base(cut.b)}: declare the part of ${base(cut.b)} that ${base(cut.a)} uses as an interface ${name} in ${port.target.path ?? ''} (${port.target.layer ?? ''}); ${base(cut.a)} depends on ${name} and ${base(cut.b)} implements it.`,
    },
  };
}

// ── Domain purity (FF-P01, FF-DT04) ─────────────────────────────────────────────────────────────────────────────

const WEB_PACKAGES = /^(express|koa|fastify|@hapi\/|hapi$|@nestjs\/platform-)/;
const DI_PACKAGES = /^(@nestjs\/common|@nestjs\/core|inversify|tsyringe|typedi)$/;

function forbiddenPackage(ctx: HintContext, f: HintFinding, src: string, pkg: string): Draft | undefined {
  const m = ctx.model;
  const srcL = m.layerOf(src);
  const stem = nameOfFile(src);
  if (f.isTypeOnly === true) {
    const own = `${stem}${WEB_PACKAGES.test(pkg) ? 'Input' : 'Shape'}`;
    const place = srcL === null ? undefined : m.placement(srcL, src, own);
    if (place === undefined || srcL === null) return undefined;
    return {
      family: 'forbidden-package', problem: '', breaks: { dependency: '', rule: '' },
      target: { layer: srcL, folder: place.folder, path: place.path },
      fix: { action: 'replace-with-own-type', text: `Replace the ${pkg} type with a type the ${srcL} owns: declare ${own} in ${place.path} with only the fields ${base(src)} needs, and convert the ${pkg} type to it in the adapter that calls ${base(src)}.` },
      edit: [
        { op: 'remove-import', from: src, to: pkg, package: true },
        { op: 'add-file', path: place.path, layer: srcL, declares: { kind: 'Interface', name: own } },
        { op: 'add-import', from: src, to: place.path, typeOnly: true },
      ],
    };
  }
  const wantRole = WEB_PACKAGES.test(pkg) ? 'presentation' : DI_PACKAGES.test(pkg) ? 'composition' : 'infrastructure';
  const forbiddenIn = (l: string): boolean => l === m.domainLayer() || l === srcL;
  const ranked = [...m.names.filter((l) => m.roleOf(l) === wantRole), ...m.names.filter((l) => m.roleOf(l) === 'infrastructure'), ...m.names].filter((l) => !forbiddenIn(l));
  const layer = ranked.find((l) => m.mayImport(l, srcL) || m.mayImport(srcL, l));
  if (layer === undefined) return undefined;
  const inverted = m.mayImport(layer, srcL);
  const adapter = `${stem}${wantRole === 'presentation' ? 'HttpAdapter' : wantRole === 'composition' ? 'Provider' : 'Record'}`;
  const place = m.placement(layer, src, adapter);
  if (place === undefined) return undefined;
  const composition = m.roleOf(layer) === 'composition';
  return {
    family: 'forbidden-package', problem: '', breaks: { dependency: '', rule: '' },
    target: { layer, folder: place.folder, path: place.path },
    fix: {
      action: 'extract-adapter',
      text: composition && inverted
        ? `Remove the ${pkg} decorators and imports from ${base(src)} and register it in the composition root instead: ${place.path} (${layer}) imports ${pkg}, declares the provider and constructs the plain ${nameOfFile(src)}.`
        : inverted
        ? `Move the ${pkg}-dependent code (decorators, framework calls) out of ${base(src)} into ${adapter} in ${place.path} (${layer}); ${adapter} imports ${pkg} and maps to and from the plain ${base(src)}, which keeps no ${pkg} import.`
        : `Move the ${pkg}-dependent code (decorators, mappings) out of ${base(src)} into ${adapter} in ${place.path} (${layer}); ${base(src)} uses ${adapter} through ${layer}, and only ${layer} imports ${pkg}.`,
    },
    edit: [
      { op: 'remove-import', from: src, to: pkg, package: true },
      { op: 'add-file', path: place.path, layer, declares: { kind: 'Class', name: adapter } },
      { op: 'add-import', from: place.path, to: pkg, package: true },
      inverted ? { op: 'add-import', from: place.path, to: src } : { op: 'add-import', from: src, to: place.path },
    ],
  };
}

// ── Domain state (FF-P06) ───────────────────────────────────────────────────────────────────────────────────────

function heldInfrastructure(ctx: HintContext, f: HintFinding, src: string, tgt: string): Draft | undefined {
  const m = ctx.model;
  const [cls, tgtName, relType, field] = f.discriminator ?? [];
  if (cls === undefined || tgtName === undefined) return undefined;
  const srcL = m.layerOf(src);
  const g = ctx.graph;
  const implemented = (g?.implementedBy(tgt, tgtName) ?? []).filter((p): p is { name: string; file: string } => p.file !== undefined).sort((a, b) => a.file.localeCompare(b.file));
  const existing = implemented.find((p) => m.mayImport(srcL, m.layerOf(p.file)));
  // A port it implements in a layer the domain may not import, interfaces only: move it into the domain (as the edge hint does).
  const movable = existing === undefined
    ? implemented
        .filter((p) => isAbstraction(g, p.file))
        .map((p) => {
          const layer = moveTargetLayer(ctx, p.file, srcL, srcL);
          const place = layer === undefined ? undefined : m.placement(layer, src, nameOfFile(p.file));
          const to = place === undefined ? undefined : `${place.folder}${base(p.file)}`;
          return layer !== undefined && to !== undefined && m.layerOf(to) === layer ? { p, to, layer } : undefined;
        })
        .find((x) => x !== undefined)
    : undefined;
  let portFile: string;
  let portName: string;
  let folder: string;
  const edit: GraphEditOp[] = [];
  if (existing !== undefined) {
    portFile = existing.file;
    portName = existing.name;
    folder = dirOf(portFile);
  } else if (movable !== undefined) {
    portFile = movable.to;
    portName = movable.p.name;
    folder = dirOf(portFile);
    edit.push({ op: 'move-file', from: movable.p.file, to: movable.to, layer: movable.layer });
  } else {
    portName = portNameFor(tgtName);
    const place = srcL === null ? undefined : m.placement(srcL, src, portName);
    if (place === undefined) return undefined;
    portFile = place.path;
    folder = place.folder;
    edit.push(
      { op: 'add-file', path: portFile, layer: srcL, declares: { kind: 'Interface', name: portName } },
      { op: 'add-implements', classFile: tgt, className: tgtName, interfaceFile: portFile, interfaceName: portName },
      { op: 'add-import', from: tgt, to: portFile, typeOnly: true },
    );
  }
  edit.push(
    { op: 'redirect-holding', classFile: src, className: cls, fromFile: tgt, interfaceFile: portFile, interfaceName: portName },
    { op: 'remove-import', from: src, to: tgt },
    { op: 'add-import', from: src, to: portFile, typeOnly: true },
  );
  const via = relType === 'CONSTRUCTOR_INJECTS' ? 'constructor parameter' : 'field';
  return {
    family: 'held-infrastructure',
    problem: `The ${srcL ?? 'domain'} class ${cls} holds the infrastructure class ${tgtName} (${via} ${field ?? '?'}).`,
    breaks: { dependency: `${cls} (${at(src, srcL)}) holds ${tgtName} (${at(tgt, m.layerOf(tgt))}) via ${relType ?? 'a field'}`, rule: `a ${srcL ?? 'domain'} class holds no infrastructure state; ${m.ruleText(srcL)}` },
    target: { layer: srcL, folder, path: portFile },
    fix: {
      action: existing !== undefined ? 'use-existing-port' : movable !== undefined ? 'move-file' : 'introduce-port',
      text: `${
        existing !== undefined
          ? `Hold the port ${portName} (${portFile})`
          : movable !== undefined
            ? `Move the port ${portName} that ${tgtName} implements from ${movable.p.file} to ${portFile} and hold it`
            : `Introduce a port interface ${portName} in ${portFile} and hold it`
      } instead of ${tgtName}: declare ${field ?? 'the field'} as ${portName}, take it as a constructor parameter, and pass ${tgtName} from the composition root.`,
    },
    edit,
    usedGraph: existing !== undefined || movable !== undefined,
  };
}

// ── Missing port (FF-P03 repository-pattern, port-adapter-pattern) ──────────────────────────────────────────────

function missingPort(ctx: HintContext, f: HintFinding, src: string, ruleName: string): Draft | undefined {
  const m = ctx.model;
  const g = ctx.graph;
  const cls = f.discriminator?.[0] ?? nameOfFile(src);
  const srcL = m.layerOf(src);
  const portLayers = ruleName === 'port-adapter-pattern'
    ? m.names.filter((l) => (m.roleOf(l) === 'domain' || m.roleOf(l) === 'application') && m.mayImport(srcL, l))
    : [m.domainLayer()].filter((l): l is string => l !== undefined);
  const wanted = portNameFor(cls);
  const problem = `The adapter class ${cls} implements no port interface declared in ${portLayers.join(' or ') || 'the core'}.`;
  const breaks = { dependency: `${cls} (${at(src, srcL)}) has no IMPLEMENTS edge to an interface in ${portLayers.join(' or ') || 'the core'}`, rule: `an ${srcL ?? 'adapter'} repository or gateway implements a port of the core; ${m.ruleText(srcL)}` };

  // Where the core's ports already live: the first interface-only file named like a port in a port layer (graph).
  const home = (g?.files ?? []).find(
    (file) => portLayers.includes(m.layerOf(file) ?? '') && isAbstraction(g, file) && /Repository|Gateway|Port|Sender|Store|Clock|Generator/.test(nameOfFile(file)),
  );
  const homeLayer = home === undefined ? undefined : m.layerOf(home) ?? undefined;

  // A local interface the class implements, outside the port layers: move it into a port layer.
  const local = g?.implementedBy(src, cls).find((p) => p.file !== undefined && !portLayers.includes(m.layerOf(p.file) ?? ''));
  const moveLayer = homeLayer ?? portLayers[portLayers.length - 1];
  if (local?.file !== undefined && moveLayer !== undefined) {
    const place = m.placement(moveLayer, home ?? src, local.name);
    const to = place === undefined ? undefined : `${place.folder}${base(local.file)}`;
    if (place !== undefined && to !== undefined && m.layerOf(to) === moveLayer) {
      return {
        family: 'missing-port', problem, breaks,
        target: { layer: moveLayer, folder: place.folder, path: to },
        fix: { action: 'move-file', text: `Move the interface ${local.name} from ${local.file} to ${to} (${moveLayer}): the port belongs to the core, the adapter ${cls} implements it there.` },
        edit: [{ op: 'move-file', from: local.file, to, layer: moveLayer }],
        usedGraph: true,
      };
    }
  }
  // An existing core interface with the port's name: declare `implements`.
  const known = g?.fileDeclaring(wanted);
  if (known !== undefined && portLayers.includes(m.layerOf(known) ?? '') && g?.declarations(known).interfaces.includes(wanted) === true) {
    const layer = m.layerOf(known);
    return {
      family: 'missing-port', problem, breaks,
      target: { layer, folder: dirOf(known), path: known },
      fix: { action: 'implement-port', text: `Declare \`class ${cls} implements ${wanted}\`, importing the port from ${known} (${layer ?? ''}).` },
      edit: [
        { op: 'add-import', from: src, to: known, typeOnly: true },
        { op: 'add-implements', classFile: src, className: cls, interfaceFile: known, interfaceName: wanted },
      ],
      usedGraph: true,
    };
  }
  // Otherwise introduce the port next to the core's other ports, else in the first port layer.
  const layer = homeLayer ?? portLayers[0];
  if (layer === undefined) return undefined;
  const place = m.placement(layer, home ?? src, wanted);
  if (place === undefined) return undefined;
  return {
    family: 'missing-port', problem, breaks,
    target: { layer, folder: place.folder, path: place.path },
    fix: { action: 'introduce-port', text: `Introduce the port interface ${wanted} in ${place.path} (${layer}) with the methods the core calls, and declare \`class ${cls} implements ${wanted}\`.` },
    edit: [
      { op: 'add-file', path: place.path, layer, declares: { kind: 'Interface', name: wanted } },
      { op: 'add-import', from: src, to: place.path, typeOnly: true },
      { op: 'add-implements', classFile: src, className: cls, interfaceFile: place.path, interfaceName: wanted },
    ],
    usedGraph: home !== undefined,
  };
}

// ── DDD (FF-DS01, FF-DS02, FF-DT01, FF-DT02, FF-DT03) ───────────────────────────────────────────────────────────

const rx = (glob: string): RegExp => new RegExp(globToRegex(glob, { segmentGlobstar: true }));
const literalPath = (glob: string): boolean => !/[*?{[]/.test(glob);

function contextOf(m: SpecModel, file: string): { name: string; root: string } | undefined {
  return m.spec.layerModel.ddd?.contexts.find((c) => file.startsWith(c.root));
}

function contextMembership(ctx: HintContext, src: string): Draft | undefined {
  const m = ctx.model;
  const ddd = m.spec.layerModel.ddd;
  if (ddd === undefined) return undefined;
  const importers = ctx.graph?.importersOf(src) ?? [];
  const contexts = [...new Set(importers.map((i) => contextOf(m, i)?.name).filter((n): n is string => n !== undefined))].sort();
  const shared = ddd.outsideContexts.map((g) => /^(.*\/)\*\*$/.exec(g)?.[1]).find((d): d is string => d !== undefined);
  let to: string | undefined;
  let why: string;
  if (contexts.length === 1) {
    const c = ddd.contexts.find((x) => x.name === contexts[0]);
    const layers = m.names.filter((l) => importers.every((i) => m.mayImport(m.layerOf(i), l)) && m.roleOf(l) !== 'composition');
    const near = importers.find((i) => contextOf(m, i)?.name === contexts[0]) ?? `${c?.root ?? ''}x/x.ts`;
    const place = layers.map((l) => m.placement(l, near, nameOfFile(src))).find((p) => p !== undefined);
    to = place === undefined ? undefined : `${place.folder}${base(src)}`;
    why = `only the ${contexts[0] ?? ''} context uses it`;
  } else {
    to = shared === undefined ? undefined : `${shared}${base(src)}`;
    why = contexts.length === 0 ? 'no context imports it yet, so it is shared code' : `${contexts.join(' and ')} both use it`;
  }
  if (to === undefined) return undefined;
  const layer = m.layerOf(to);
  return {
    family: 'context-membership',
    problem: `${src} lies in no declared bounded context and in no path declared outside the contexts.`,
    breaks: { dependency: `${src} (outside every context root: ${ddd.contexts.map((c) => c.root).join(', ')})`, rule: `every file under ${ddd.sourceRoot} lies in a context root or in architecture.ddd.outside_contexts (${ddd.outsideContexts.join(', ')})` },
    target: { layer, folder: dirOf(to), path: to },
    fix: { action: 'move-file', text: `Move ${base(src)} to ${to} (${layer ?? 'no layer'}): ${why}.` },
    edit: [{ op: 'move-file', from: src, to, layer }],
    usedGraph: importers.length > 0,
  };
}

function contextBoundary(ctx: HintContext, f: HintFinding, src: string, tgt: string): Draft | undefined {
  const m = ctx.model;
  const ddd = m.spec.layerModel.ddd;
  const tc = ddd?.contexts.find((c) => tgt.startsWith(c.root));
  const sc = ddd?.contexts.find((c) => src.startsWith(c.root));
  if (ddd === undefined || tc === undefined || sc === undefined) return undefined;
  const api = tc.publicApi.find(literalPath) ?? (tc.publicApi[0] !== undefined ? `${tc.publicApi[0].replace(/\*\*.*$/, '')}index.ts` : `${tc.root}index.ts`);
  const name = usedName(f, ctx, src, tgt);
  const acl = sc.acl[0];
  return {
    family: 'context-boundary',
    problem: `${base(src)} in context ${sc.name} imports ${base(tgt)}, an internal file of context ${tc.name}.`,
    breaks: { dependency: `${src} (${sc.name}) -> ${tgt} (${tc.name}, not public)`, rule: `a context imports another context only through its public API (${tc.publicApi.join(', ')})${sc.acl.length > 0 ? ` or from its anti-corruption layer (${sc.acl.join(', ')})` : ''}` },
    target: { layer: m.layerOf(api), folder: dirOf(api), path: api },
    fix: {
      action: 'use-public-api',
      text: `Import ${name} through ${tc.name}'s public API ${api} (add \`export { ${name} } from './${path.posix.relative(path.posix.dirname(api), tgt).replace(/\.ts$/, '')}'\` there if it is missing)${acl !== undefined ? `, or move the translation into ${sc.name}'s anti-corruption layer ${acl.replace(/\*\*$/, '')}` : ''}.`,
    },
    edit: [
      { op: 'remove-import', from: src, to: tgt },
      { op: 'add-import', from: src, to: api, typeOnly: true, reExportHop: true },
      { op: 'add-import', from: api, to: tgt, reExport: true },
      { op: 'add-import', from: src, to: tgt, typeOnly: true, viaReExport: true },
    ],
  };
}

function aggregateFor(m: SpecModel, f: HintFinding, tgt: string): DddAggregate | undefined {
  const aggs = m.spec.layerModel.ddd?.aggregates ?? [];
  return aggs.find((a) => a.name === f.discriminator?.[0]) ?? aggs.find((a) => a.innerEntities.some((g) => rx(g).test(tgt)));
}

function aggregateBoundary(ctx: HintContext, f: HintFinding, src: string, tgt: string): Draft | undefined {
  const m = ctx.model;
  const agg = aggregateFor(m, f, tgt);
  if (agg === undefined) return undefined;
  const root = literalPath(agg.root) ? agg.root : ctx.graph?.files.find((file) => rx(agg.root).test(file));
  if (root === undefined) return undefined;
  const layer = m.layerOf(root);
  return {
    family: 'aggregate-boundary',
    problem: `${base(src)} references ${nameOfFile(tgt)}, an inner entity of aggregate ${agg.name}, from outside the aggregate.`,
    breaks: { dependency: edgeText(m, src, tgt), rule: `only the root of aggregate ${agg.name} (${agg.root}) may be referenced from outside ${agg.module}` },
    target: { layer, folder: dirOf(root), path: root },
    fix: { action: 'reference-root', text: `Reference the aggregate root ${nameOfFile(root)} (${root}) instead, and reach ${nameOfFile(tgt)} through its methods (or expose the values you need from the root).` },
    edit: [{ op: 'remove-import', from: src, to: tgt }, { op: 'add-import', from: src, to: root, typeOnly: true }],
  };
}

function aggregateRepository(ctx: HintContext, f: HintFinding, src: string, tgt: string): Draft | undefined {
  const m = ctx.model;
  const g = ctx.graph;
  const ddd = m.spec.layerModel.ddd;
  const agg = aggregateFor(m, f, tgt);
  if (ddd === undefined || agg === undefined) return undefined;
  const rootName = nameOfFile(agg.root);
  const repoFiles = (g?.files ?? []).filter((file) => file !== src && ddd.repositories.some((r) => rx(r).test(file)));
  const rootRepo =
    repoFiles.find((file) => nameOfFile(file) === `${rootName}Repository` && m.layerOf(file) === m.layerOf(src)) ??
    repoFiles.find((file) => nameOfFile(file) === `${rootName}Repository`) ??
    `${dirOf(src)}${rootName}Repository.ts`;
  const edit: GraphEditOp[] = [{ op: 'remove-file', path: src }];
  for (const imp of g?.importersOf(src) ?? []) if (imp !== rootRepo) edit.push({ op: 'add-import', from: imp, to: rootRepo, typeOnly: true });
  return {
    family: 'aggregate-repository',
    problem: `${base(src)} is a repository for ${nameOfFile(tgt)}, an inner entity of aggregate ${agg.name}; repositories exist only for aggregate roots.`,
    breaks: { dependency: edgeText(m, src, tgt), rule: `a repository's contract names only an aggregate root; ${nameOfFile(tgt)} is inside aggregate ${agg.name} (root ${agg.root})` },
    target: { layer: m.layerOf(rootRepo), folder: dirOf(rootRepo), path: rootRepo },
    fix: { action: 'remove-repository', text: `Remove ${base(src)}; load and save ${nameOfFile(tgt)} as part of ${rootName} through ${rootRepo}, and point its callers there.` },
    edit,
    usedGraph: g !== undefined,
  };
}

function valueObjectMutability(ctx: HintContext, f: HintFinding, src: string): Draft | undefined {
  const m = ctx.model;
  const cls = f.discriminator?.[0];
  if (cls === undefined) return undefined;
  const members = (f.discriminator?.[1] ?? '').split(', ').filter((s) => s.length > 0);
  const layer = m.layerOf(src);
  const steps: string[] = [];
  const of = (tag: string): string[] => members.filter((x) => x.includes(`(${tag})`)).map((x) => x.replace(/ \(.*\)$/, '').replace(`${cls}.`, ''));
  if (of('public mutable field').length > 0) steps.push(`make ${of('public mutable field').join(', ')} readonly (or private with a getter)`);
  if (of('set accessor').length > 0) steps.push(`remove the set accessor(s) ${of('set accessor').join(', ')}`);
  const mut = [...of('mutator method'), ...members.filter((x) => !x.includes('(')).map((x) => x.replace(`${cls}.`, ''))];
  if (mut.length > 0) steps.push(`let ${mut.join(', ')} return a new ${cls} instead of assigning a field`);
  return {
    family: 'value-object-mutability',
    problem: `The value object ${cls} can be changed after construction (${members.join(', ') || 'a mutable member'}).`,
    breaks: { dependency: `${cls} (${at(src, layer)}) exposes ${members.length === 1 ? 'a mutable member' : 'mutable members'}`, rule: 'a value object (architecture.ddd.value_objects) is immutable: no public mutable field, no setter, no method that assigns a field' },
    target: { layer, folder: dirOf(src), path: src },
    fix: { action: 'make-immutable', text: `Keep ${cls} where it is and make it immutable: ${steps.join('; ') || 'make every field readonly'}.` },
    edit: [{ op: 'make-immutable', classFile: src, className: cls }],
  };
}

// ── Dispatch ────────────────────────────────────────────────────────────────────────────────────────────────────

const EDGE_RULES = new Set(['dependency-direction', 'no-domain-outward-dep', 'dependency-direction-graph', 'core-isolation', 'no-layer-skip', 'layer-skip-graph']);

/** The family a rule's findings fall into, or undefined when the rule has no template. */
export function familyOf(ruleName: string): FixHintFamily | undefined {
  if (EDGE_RULES.has(ruleName)) return ruleName === 'no-layer-skip' || ruleName === 'layer-skip-graph' ? 'layer-skip' : 'dependency-direction';
  const map: Readonly<Record<string, FixHintFamily>> = {
    'no-cyclic-deps': 'cycle',
    'domain-purity': 'forbidden-package',
    'domain-state-purity': 'held-infrastructure',
    'repository-pattern': 'missing-port',
    'port-adapter-pattern': 'missing-port',
    'bounded-context-modules': 'context-membership',
    'context-isolation': 'context-boundary',
    'aggregate-boundary': 'aggregate-boundary',
    'repository-aggregate-root': 'aggregate-repository',
    'value-object-immutability': 'value-object-mutability',
  };
  return map[ruleName];
}

/** Fills the edge-family problem and breaks fields every edge template shares. */
function withEdgeText(m: SpecModel, d: Draft, src: string, tgt: string, ruleName: string): Draft {
  if (d.problem !== '') return d;
  const srcL = m.layerOf(src);
  const tgtL = m.layerOf(tgt);
  const skip = ruleName === 'no-layer-skip' || ruleName === 'layer-skip-graph';
  const domainOnly = ruleName === 'no-domain-outward-dep' || ruleName === 'core-isolation';
  return {
    ...d,
    problem: `${base(src)} in ${srcL ?? 'no layer'} imports ${base(tgt)} in ${tgtL ?? 'no layer'}, which ${srcL ?? 'its layer'} may not depend on.`,
    breaks: {
      dependency: edgeText(m, src, tgt),
      rule: domainOnly ? `the ${srcL ?? 'domain'} layer imports no other layer; ${m.ruleText(srcL)}` : skip && m.style === 'layered' ? `closed layering: each layer imports only the layer directly below it; ${m.ruleText(srcL)}` : m.ruleText(srcL),
    },
  };
}

/** The hint draft for one finding of the template `ruleName`, or undefined when no template applies. */
export function draftHint(ctx: HintContext, ruleName: string, f: HintFinding): Draft | undefined {
  const m = ctx.model;
  const src = f.filePath;
  const tgt = f.target;
  switch (familyOf(ruleName)) {
    case 'dependency-direction':
      return tgt === undefined ? undefined : mapDraft(edgeDirection(ctx, f, src, tgt), (d) => withEdgeText(m, d, src, tgt, ruleName));
    case 'layer-skip': {
      if (tgt === undefined) return undefined;
      const inward = m.names.indexOf(m.layerOf(src) ?? '') > m.names.indexOf(m.layerOf(tgt) ?? '');
      const d = m.style === 'layered' && inward ? layerSkip(ctx, f, src, tgt) : edgeDirection(ctx, f, src, tgt);
      return mapDraft(d, (x) => withEdgeText(m, { ...x, family: 'layer-skip' }, src, tgt, ruleName));
    }
    case 'cycle':
      return cycle(ctx, f);
    case 'forbidden-package': {
      if (tgt === undefined) return undefined;
      const srcL = m.layerOf(src);
      return mapDraft(forbiddenPackage(ctx, f, src, tgt), (d) => ({
        ...d,
        problem: `${base(src)} in the ${srcL ?? 'domain'} layer imports the framework package ${tgt}.`,
        breaks: { dependency: `${at(src, srcL)} -> package ${tgt}`, rule: `the ${srcL ?? 'domain'} layer is framework-free: no import of ${(m.spec.fitnessFunctions.find((x) => x.name === 'domain-purity')?.forbiddenImports ?? [tgt]).join(', ')}` },
      }));
    }
    case 'held-infrastructure':
      return tgt === undefined ? undefined : heldInfrastructure(ctx, f, src, tgt);
    case 'missing-port':
      return missingPort(ctx, f, src, ruleName);
    case 'context-membership':
      return contextMembership(ctx, src);
    case 'context-boundary':
      return tgt === undefined ? undefined : contextBoundary(ctx, f, src, tgt);
    case 'aggregate-boundary':
      return tgt === undefined ? undefined : aggregateBoundary(ctx, f, src, tgt);
    case 'aggregate-repository':
      return tgt === undefined ? undefined : aggregateRepository(ctx, f, src, tgt);
    case 'value-object-mutability':
      return valueObjectMutability(ctx, f, src);
    default:
      return undefined;
  }
}

function mapDraft(d: Draft | undefined, fn: (d: Draft) => Draft): Draft | undefined {
  return d === undefined ? undefined : fn(d);
}
