declare module 'typeorm' {
  export function Entity(name?: string): ClassDecorator;
  export function Column(): PropertyDecorator;
  export function PrimaryColumn(): PropertyDecorator;
}
declare module 'pg' {
  export interface PoolClient {
    query(sql: string, params?: unknown[]): Promise<{ rows: unknown[] }>;
    release(): void;
  }
}
declare module 'axios' {
  export interface AxiosResponse<T = unknown> {
    status: number;
    data: T;
  }
}
declare module 'express' {
  export interface Request {
    body: unknown;
    params: Record<string, string>;
  }
  export interface Response {
    status(code: number): Response;
    json(body: unknown): void;
  }
}
declare module 'node:child_process' {
  export function execFileSync(cmd: string, args?: string[]): string;
}
declare module 'node:fs' {
  export function readFileSync(path: string, encoding: string): string;
  export function writeFileSync(path: string, data: string): void;
}
declare const process: { env: Record<string, string | undefined> };
