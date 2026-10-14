// Minimal typings of express.
export interface Request {
  body: unknown;
  params: Record<string, string>;
  headers: Record<string, string | undefined>;
}
export interface Response {
  status(code: number): Response;
  json(body: unknown): Response;
}
