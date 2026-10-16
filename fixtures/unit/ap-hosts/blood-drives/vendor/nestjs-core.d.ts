// Minimal typings of @nestjs/core.
export interface INestApplication {
  setGlobalPrefix(prefix: string): void;
  listen(port: number): Promise<void>;
  useGlobalFilters(...filters: unknown[]): void;
}
export declare class NestFactory {
  static create(module: unknown): Promise<INestApplication>;
}
