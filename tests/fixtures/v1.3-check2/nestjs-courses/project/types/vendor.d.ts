// Minimal ambient typings for the framework packages these projects import (no install needed).
declare module 'typeorm' {
  export function Entity(name?: string): ClassDecorator;
  export function Column(options?: Record<string, unknown>): PropertyDecorator;
  export function PrimaryColumn(options?: Record<string, unknown>): PropertyDecorator;
  export function PrimaryGeneratedColumn(strategy?: string): PropertyDecorator;
  export type FindOptionsWhere<T> = { [P in keyof T]?: T[P] };
  export interface FindManyOptions<T> {
    where?: FindOptionsWhere<T>;
  }
  export class Repository<T> {
    create(entity: Partial<T>): T;
    save(entity: T): Promise<T>;
    findOne(options: FindManyOptions<T>): Promise<T | null>;
    find(options?: FindManyOptions<T>): Promise<T[]>;
    delete(criteria: FindOptionsWhere<T>): Promise<void>;
    count(options?: FindManyOptions<T>): Promise<number>;
  }
  export type EntityTarget<T> = new () => T;
  export function getRepository<T>(target: EntityTarget<T>): Repository<T>;
  export class DataSource {
    getRepository<T>(target: EntityTarget<T>): Repository<T>;
  }
}

declare module 'express' {
  export interface Request {
    params: Record<string, string>;
    body: Record<string, unknown>;
    query: Record<string, string | undefined>;
    header(name: string): string | undefined;
  }
  export interface Response {
    status(code: number): Response;
    json(body: unknown): Response;
  }
  export type Handler = (req: Request, res: Response) => void;
  export interface Router {
    get(path: string, handler: Handler): Router;
    post(path: string, handler: Handler): Router;
  }
  export function Router(): Router;
}

declare module '@nestjs/common' {
  export function Injectable(): ClassDecorator;
  export function Controller(prefix?: string): ClassDecorator;
  export function Module(metadata: { imports?: unknown[]; controllers?: unknown[]; providers?: unknown[]; exports?: unknown[] }): ClassDecorator;
  export function Inject(token: unknown): ParameterDecorator;
  export function Get(path?: string): MethodDecorator;
  export function Post(path?: string): MethodDecorator;
  export function Patch(path?: string): MethodDecorator;
  export function Body(): ParameterDecorator;
  export function Param(name?: string): ParameterDecorator;
  export class HttpException extends Error {
    constructor(response: string | Record<string, unknown>, status: number);
    getStatus(): number;
  }
  export class BadRequestException extends HttpException {
    constructor(message?: string);
  }
  export class NotFoundException extends HttpException {
    constructor(message?: string);
  }
  export class ConflictException extends HttpException {
    constructor(message?: string);
  }
}

declare module '@nestjs/typeorm' {
  export function InjectRepository(entity: abstract new (...args: never[]) => unknown): ParameterDecorator;
  export class TypeOrmModule {
    static forFeature(entities: unknown[]): unknown;
  }
}

declare module '@nestjs/core' {
  export class NestFactory {
    static create(module: unknown): Promise<{ listen(port: number): Promise<void> }>;
  }
}
