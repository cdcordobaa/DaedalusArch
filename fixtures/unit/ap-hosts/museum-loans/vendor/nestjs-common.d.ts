// Minimal typings of the @nestjs/common surface this project uses (no install; resolved through tsconfig paths).
export interface ModuleMetadata {
  imports?: unknown[];
  controllers?: unknown[];
  providers?: unknown[];
  exports?: unknown[];
}
export interface ValueProvider {
  provide: string | symbol;
  useValue?: unknown;
  useClass?: abstract new (...args: never[]) => unknown;
}
export declare function Injectable(): ClassDecorator;
export declare function Inject(token: string | symbol): ParameterDecorator;
export declare function Controller(prefix?: string): ClassDecorator;
export declare function Module(metadata: ModuleMetadata): ClassDecorator;
export declare function Get(path?: string): MethodDecorator;
export declare function Post(path?: string): MethodDecorator;
export declare function Patch(path?: string): MethodDecorator;
export declare function Delete(path?: string): MethodDecorator;
export declare function HttpCode(status: number): MethodDecorator;
export declare function Body(): ParameterDecorator;
export declare function Param(name?: string): ParameterDecorator;
export declare function Query(name?: string): ParameterDecorator;
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
export declare class ConflictException extends HttpException {
  constructor(message?: string);
}
export declare class UnprocessableEntityException extends HttpException {
  constructor(message?: string);
}
export interface ArgumentsHost {
  switchToHttp(): { getResponse<T>(): T; getRequest<T>(): T };
}
export interface ExceptionFilter<T = unknown> {
  catch(exception: T, host: ArgumentsHost): void;
}
export declare function Catch(...exceptions: (abstract new (...args: never[]) => unknown)[]): ClassDecorator;
