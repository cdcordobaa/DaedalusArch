// Minimal ambient typings for the framework packages the reference projects (and their violating variants) import.
// Ambient `declare module` blocks, not tsconfig `paths`: the import stays a bare specifier, so the extractor sees a
// Package node exactly as it would with the real package installed, and no network install is needed.
declare module 'typeorm' {
  export function Entity(name?: string): ClassDecorator;
  export function Column(options?: Record<string, unknown>): PropertyDecorator;
  export function PrimaryColumn(options?: Record<string, unknown>): PropertyDecorator;
  export class Repository<T> {
    findOneBy(where: Partial<T>): Promise<T | null>;
    save(entity: T): Promise<T>;
  }
}

declare module 'express' {
  export interface Request {
    params: Record<string, string>;
    body: Record<string, unknown>;
    header(name: string): string | undefined;
  }
  export interface Response {
    status(code: number): Response;
    json(body: unknown): Response;
  }
}

declare module '@nestjs/common' {
  export function Injectable(): ClassDecorator;
  export function Controller(prefix?: string): ClassDecorator;
  export function Module(metadata: {
    imports?: unknown[];
    controllers?: unknown[];
    providers?: unknown[];
    exports?: unknown[];
  }): ClassDecorator;
  export function Inject(token: unknown): ParameterDecorator & PropertyDecorator;
  export function Catch(...exceptions: unknown[]): ClassDecorator;
  export function UseGuards(...guards: unknown[]): ClassDecorator & MethodDecorator;
  export function Get(path?: string): MethodDecorator;
  export function Post(path?: string): MethodDecorator;
  export function Delete(path?: string): MethodDecorator;
  export function Body(): ParameterDecorator;
  export function Param(name?: string): ParameterDecorator;
  export interface ExecutionContext {
    switchToHttp(): { getRequest<T = unknown>(): T; getResponse<T = unknown>(): T };
  }
  export interface ArgumentsHost {
    switchToHttp(): { getRequest<T = unknown>(): T; getResponse<T = unknown>(): T };
  }
  export interface CanActivate {
    canActivate(context: ExecutionContext): boolean;
  }
  export interface ExceptionFilter<T = unknown> {
    catch(exception: T, host: ArgumentsHost): void;
  }
  export class HttpException extends Error {
    constructor(response: string | Record<string, unknown>, status: number);
    getStatus(): number;
  }
  export class NotFoundException extends HttpException {
    constructor(message?: string);
  }
  export enum HttpStatus {
    BAD_REQUEST = 400,
    NOT_FOUND = 404,
    CONFLICT = 409,
  }
}

declare module '@nestjs/core' {
  export const APP_FILTER = 'APP_FILTER';
  export const APP_GUARD = 'APP_GUARD';
  export class NestFactory {
    static create(module: unknown): Promise<{ listen(port: number): Promise<void> }>;
  }
}
