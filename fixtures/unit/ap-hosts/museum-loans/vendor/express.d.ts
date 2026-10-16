// Minimal typings of express (the platform under @nestjs/platform-express).
export interface Request {
  body: unknown;
  params: Record<string, string>;
  query: Record<string, string | undefined>;
  headers: Record<string, string | undefined>;
}
export interface Response {
  status(code: number): Response;
  json(body: unknown): Response;
}
