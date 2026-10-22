/**
 * PUZZLE-03 runtime tracing for oracles (zero calls). Loads a tree's modules in-process, wraps the methods of its
 * aggregate roots and stores, and records every change of an aggregate together with the call stack at that moment.
 * An oracle then judges a write by where it happens: inside the command that started it, or in a handler that the
 * event relay called after that command returned. Unlike a text rule, this does not depend on method names, so a
 * renamed write, a "batch" store method or a handler called synchronously inside the command is seen the same way.
 *
 * A change is recorded when (a) a prototype method of an aggregate root class leaves the instance's state different
 * (stored domain events are left out of the comparison), or (b) a write-named method (save, store, put, persist,
 * commit, upsert, insert, update, write, set …) of a store class (name ending in Repository, Repo, Store, UnitOfWork,
 * Database or Db) declared under the aggregate's context folder is called.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';

export interface Frame { readonly fn: string; readonly file: string; readonly line: number }
export interface Change {
  readonly call: string | null;
  readonly context: string;
  readonly what: string;
  /** Tree-relative frames, innermost first; frames outside `src/` are dropped. */
  readonly frames: readonly Frame[];
}
export interface AggregateSpec { readonly context: string; readonly file: string; readonly className: string }

const WRITE = /^(save|saveAll|store|put|persist|commit|upsert|insert|update|write|set)/i;
const STORE = /(Repository|Repo|Store|UnitOfWork|Database|Db)$/;

/** JSON of an instance's own state, without arrays of domain events (anything with a string `type`). */
function snapshot(o: unknown): string {
  return JSON.stringify(o, (_k, v: unknown) => {
    if (v instanceof Map) return [...v.entries()];
    if (v instanceof Set) return [...v.values()];
    if (Array.isArray(v) && (v.length === 0 || v.every((e) => typeof e === 'object' && e !== null && typeof (e as { type?: unknown }).type === 'string'))) return undefined;
    return v;
  });
}

export class Tracer {
  readonly changes: Change[] = [];
  readonly missing: string[] = [];
  private current: string | null = null;

  constructor(readonly root: string) {
    Error.stackTraceLimit = 200;
  }

  private frames(): Frame[] {
    const out: Frame[] = [];
    for (const l of (new Error().stack ?? '').split('\n').slice(1)) {
      const m = /at (?:(.+?) \()?(.+?):(\d+):\d+\)?$/.exec(l.trim());
      if (m === null) continue;
      const raw = m[2]!.startsWith('file://') ? new URL(m[2]!).pathname : m[2]!;
      const rel = path.relative(this.root, raw).split(path.sep).join('/');
      if (!rel.startsWith('src/')) continue;
      out.push({ fn: m[1] ?? '<anonymous>', file: rel, line: Number(m[3]) });
    }
    return out;
  }

  private record(context: string, what: string): void {
    this.changes.push({ call: this.current, context, what, frames: this.frames() });
  }

  async load(rel: string): Promise<Record<string, unknown>> {
    return (await import(pathToFileURL(path.join(this.root, rel)).href)) as Record<string, unknown>;
  }

  /** Wraps the aggregate roots and the store classes of each aggregate's context. Call before loading the entry. */
  async hook(aggregates: readonly AggregateSpec[]): Promise<void> {
    const tracer = this;
    for (const a of aggregates) {
      if (!fs.existsSync(path.join(this.root, a.file))) {
        this.missing.push(`${a.file} (aggregate root ${a.className}) not found`);
        continue;
      }
      const cls = (await this.load(a.file))[a.className] as (new (...x: unknown[]) => unknown) | undefined;
      if (typeof cls !== 'function') {
        this.missing.push(`${a.file} exports no class ${a.className}`);
        continue;
      }
      const proto = cls.prototype as Record<string, unknown>;
      for (const name of Object.getOwnPropertyNames(proto)) {
        const d = Object.getOwnPropertyDescriptor(proto, name);
        if (name === 'constructor' || d === undefined || typeof d.value !== 'function') continue;
        const orig = d.value as (...x: unknown[]) => unknown;
        proto[name] = function wrapped(this: unknown, ...args: unknown[]): unknown {
          const before = snapshot(this);
          const r = orig.apply(this, args);
          if (snapshot(this) !== before) tracer.record(a.context, `${a.className}.${name}`);
          return r;
        };
      }
      // Store classes declared anywhere under the context's folder.
      const dir = path.join(this.root, 'src', a.context);
      const files: string[] = [];
      const walk = (d: string): void => {
        for (const e of fs.readdirSync(d, { withFileTypes: true })) {
          const p = path.join(d, e.name);
          if (e.isDirectory()) walk(p);
          else if (e.name.endsWith('.ts') && !e.name.endsWith('.d.ts')) files.push(p);
        }
      };
      if (fs.existsSync(dir)) walk(dir);
      for (const f of files) {
        const mod = await this.load(path.relative(this.root, f));
        for (const [exp, v] of Object.entries(mod)) {
          if (typeof v !== 'function' || !STORE.test(exp) || typeof (v as { prototype?: unknown }).prototype !== 'object') continue;
          const p = (v as { prototype: Record<string, unknown> }).prototype;
          for (const name of Object.getOwnPropertyNames(p)) {
            const d = Object.getOwnPropertyDescriptor(p, name);
            if (name === 'constructor' || d === undefined || typeof d.value !== 'function' || !WRITE.test(name)) continue;
            const orig = d.value as (...x: unknown[]) => unknown;
            p[name] = function wrapped(this: unknown, ...args: unknown[]): unknown {
              tracer.record(a.context, `${exp}.${name}`);
              return orig.apply(this, args);
            };
          }
        }
      }
    }
  }

  /** Runs one top-level call of the app, labelled, and swallows its error (the scenario goes on). */
  run<T>(label: string, f: () => T): T | undefined {
    this.current = label;
    try {
      return f();
    } catch {
      return undefined;
    } finally {
      this.current = null;
    }
  }
}

/**
 * Judges the changes made during calls started by `initiator`: a change of an aggregate of another context passes only
 * when the event relay delivered it (a `deliverPending` frame of `relayFile` is on the stack) and no frame of the
 * initiating context is outside (a caller of) that delivery. Frames of the initiator inside the delivery are a handler
 * the relay called, which is allowed.
 */
export function crossContextWrites(changes: readonly Change[], calls: ReadonlySet<string>, initiator: string, relayFile: string): string[] {
  const out: string[] = [];
  for (const c of changes) {
    if (c.call === null || !calls.has(c.call) || c.context === initiator) continue;
    const r = c.frames.findIndex((f) => f.file === relayFile && /deliverPending/.test(f.fn));
    const callers = (r < 0 ? c.frames : c.frames.slice(r + 1)).filter((f) => f.file.startsWith(`src/${initiator}/`));
    const where = (f: Frame): string => `${f.file}:${String(f.line)} ${f.fn}`;
    if (r < 0) out.push(`${c.call}: ${c.what} (${c.context}) changed with no event delivery on the stack${callers.length > 0 ? `, inside ${where(callers[callers.length - 1]!)}` : ''}`);
    else if (callers.length > 0) out.push(`${c.call}: ${c.what} (${c.context}) changed in a delivery started inside ${where(callers[callers.length - 1]!)}`);
  }
  return [...new Set(out)];
}
