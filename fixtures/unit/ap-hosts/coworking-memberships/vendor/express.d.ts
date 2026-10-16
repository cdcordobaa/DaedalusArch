// Minimal typings of express 4 (no install; resolved through tsconfig paths).
export interface Request {
  body: unknown;
  params: Record<string, string>;
  query: Record<string, string | undefined>;
  headers: Record<string, string | undefined>;
}
export interface Response {
  status(code: number): Response;
  json(body: unknown): Response;
  send(body?: unknown): Response;
  end(): void;
}
export type NextFunction = (error?: unknown) => void;
export type RequestHandler = (req: Request, res: Response, next: NextFunction) => void;
export type ErrorRequestHandler = (error: unknown, req: Request, res: Response, next: NextFunction) => void;
export interface Router {
  get(path: string, ...handlers: RequestHandler[]): Router;
  post(path: string, ...handlers: RequestHandler[]): Router;
  patch(path: string, ...handlers: RequestHandler[]): Router;
  delete(path: string, ...handlers: RequestHandler[]): Router;
}
export declare function Router(): Router;
export interface Application {
  use(handler: RequestHandler | ErrorRequestHandler): Application;
  use(path: string, router: Router): Application;
  listen(port: number, callback?: () => void): void;
}
declare function express(): Application;
declare namespace express {
  function json(): RequestHandler;
}
export default express;
