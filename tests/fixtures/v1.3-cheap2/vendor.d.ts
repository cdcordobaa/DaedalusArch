// Ambient typings of the packages the batch-2 fixtures use (no install). Copied into every fixture project as
// `types/vendor.d.ts` by the test helper; the proxies resolve packages through these `declare module` blocks.
declare module '@nestjs/common' {
  export function Controller(prefix?: string): ClassDecorator;
  export function Injectable(): ClassDecorator;
  export function Module(m: { imports?: unknown[]; controllers?: unknown[]; providers?: unknown[]; exports?: unknown[] }): ClassDecorator;
  export function Inject(token: unknown): ParameterDecorator;
  export function Get(path?: string): MethodDecorator;
  export function Post(path?: string): MethodDecorator;
  export function Body(): ParameterDecorator;
  export class HttpException extends Error { constructor(m?: string, status?: number); }
  export class NotFoundException extends HttpException { constructor(m?: string); }
  export class BadRequestException extends HttpException { constructor(m?: string); }
  export class ConflictException extends HttpException { constructor(m?: string); }
}
declare module '@nestjs/core' {
  export const NestFactory: { create(m: unknown): Promise<{ listen(p: number): Promise<void> }> };
}
declare module '@nestjs/config' {
  export class ConfigService { get<T = string>(key: string): T | undefined; getOrThrow<T = string>(key: string): T; }
}
declare module 'express' {
  export interface Request { body: Record<string, unknown>; params: Record<string, string>; }
  export interface Response { json(b: unknown): Response; status(c: number): Response; }
  export type Handler = (req: Request, res: Response) => unknown;
  export interface Router { get(path: string, ...h: Handler[]): Router; post(path: string, ...h: Handler[]): Router; }
  export interface Express extends Router { listen(port: number): void; use(path: string, r: Router): void; }
  function express(): Express;
  namespace express { function Router(): import('express').Router; }
  export default express;
}
declare module 'stripe' {
  export default class Stripe { constructor(key: string); charges: { create(x: unknown): Promise<unknown> }; }
}
declare module '@aws-sdk/client-s3' {
  export class S3Client { constructor(o: unknown); send(c: unknown): Promise<unknown>; }
  export class PutObjectCommand { constructor(o: unknown); }
}
declare module 'axios' {
  const axios: { get(url: string): Promise<{ data: unknown }> };
  export default axios;
}
declare module 'mongoose' {
  export interface Document { _id: string; }
  export function model(name: string): unknown;
}
declare module 'typeorm' {
  export class Repository<T> { save(e: T): Promise<T>; }
}
declare module 'lodash' {
  export function sortBy<T>(xs: T[], k: string): T[];
}
declare function describe(name: string, fn: () => void): void;
declare function it(name: string, fn: () => void | Promise<void>): void;
declare function expect(x: unknown): { toBe(y: unknown): void; toEqual(y: unknown): void };
