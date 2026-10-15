/**
 * Test helpers of the cheap proxies: a throw-away project on disk (the extractor reads files), with ambient typings of
 * the packages the proxies catalogue, and a small layer model (domain / application / infrastructure / presentation).
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { realpathSync } from 'node:fs';
import { extractAndEnrich } from '../../../../src/apg-enrich/cheap/index.js';
import type { CheapEnrichment, CheapFlag, CheapOptions, ProxyId } from '../../../../src/apg-enrich/cheap/index.js';
import type { LayerDefinition, LayerModel } from '../../../../src/shared/types/spec.js';
import type { APGResult } from '../../../../src/shared/types/apg.js';

export const VENDOR = `
declare module 'typeorm' {
  export function Entity(name?: string): ClassDecorator;
  export function Column(options?: Record<string, unknown>): PropertyDecorator;
  export class Repository<T> { save(e: T): Promise<T>; findOne(o: unknown): Promise<T | null>; }
  export function getRepository<T>(target: new () => T): Repository<T>;
  export class DataSource { query(sql: string): Promise<unknown>; getRepository<T>(t: new () => T): Repository<T>; }
}
declare module 'express' {
  export interface Request { body: unknown; }
  export interface Response { json(b: unknown): Response; }
}
declare module 'axios' {
  const axios: { get(url: string): Promise<unknown>; post(url: string, b: unknown): Promise<unknown> };
  export default axios;
}
declare module '@nestjs/common' {
  export function Controller(prefix?: string): ClassDecorator;
  export function Injectable(): ClassDecorator;
  export function Get(path?: string): MethodDecorator;
  export function Post(path?: string): MethodDecorator;
  export function Body(): ParameterDecorator;
  export class BadRequestException extends Error { constructor(m?: string); }
}
`;

const layer = (name: string, kind: LayerDefinition['kind'], directories: string[]): LayerDefinition => ({
  name, directories, naming: [], role: '', filePatterns: [], ...(kind !== undefined ? { kind } : {}),
});

export const LAYERS: LayerModel = {
  layers: [
    layer('domain', 'domain', ['src/**/domain/**']),
    layer('application', 'application', ['src/**/application/**']),
    layer('infrastructure', 'infrastructure', ['src/**/infrastructure/**']),
    layer('presentation', 'presentation', ['src/**/presentation/**']),
  ],
};

export interface Fixture {
  readonly root: string;
  readonly apg: APGResult;
  readonly enrichment: CheapEnrichment;
  flags(proxy: ProxyId): CheapFlag[];
  cleanup(): void;
}

/** Writes `files` (project-relative) plus tsconfig and vendor typings, extracts and runs `proxies`. */
export async function runOn(files: Record<string, string>, proxies: readonly ProxyId[], options: Partial<CheapOptions> = {}, layerModel: LayerModel = LAYERS): Promise<Fixture> {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'cheap-proxy-')));
  const all: Record<string, string> = {
    'tsconfig.json': JSON.stringify({
      compilerOptions: { target: 'ES2021', module: 'CommonJS', moduleResolution: 'node', strict: true, experimentalDecorators: true, skipLibCheck: true, types: [] },
      include: ['src/**/*.ts', 'types/**/*.d.ts'],
    }),
    'types/vendor.d.ts': VENDOR,
    ...files,
  };
  for (const [rel, text] of Object.entries(all)) {
    mkdirSync(dirname(join(root, rel)), { recursive: true });
    writeFileSync(join(root, rel), text);
  }
  const r = await extractAndEnrich(root, { layerModel, options: { ...options, proxies } });
  return {
    root, apg: r.apg, enrichment: r.enrichment,
    flags: (proxy) => r.enrichment.flags.filter((f) => f.proxy === proxy),
    cleanup: () => {
      rmSync(root, { recursive: true, force: true });
    },
  };
}
