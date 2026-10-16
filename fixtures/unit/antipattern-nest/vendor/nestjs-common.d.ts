// Minimal typings of the @nestjs/common surface the fixture uses (no install; resolved through tsconfig paths).
export declare function Injectable(): ClassDecorator;
export declare function Controller(prefix?: string): ClassDecorator;
export declare function Module(metadata: { imports?: unknown[]; controllers?: unknown[]; providers?: unknown[] }): ClassDecorator;
export declare function Get(path?: string): MethodDecorator;
export declare function Post(path?: string): MethodDecorator;
export declare function Body(): ParameterDecorator;
export declare function Param(name?: string): ParameterDecorator;
export declare function Req(): ParameterDecorator;
export declare class HttpException extends Error {
  constructor(response: string | Record<string, unknown>, status: number);
  getStatus(): number;
}
export declare class BadRequestException extends HttpException {
  constructor(message?: string);
}
export declare class NotFoundException extends HttpException {
  constructor(message?: string);
}
