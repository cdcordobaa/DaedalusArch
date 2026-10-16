import type { HttpHandler } from "./http.js";

/** Dispatches to the handler whose path prefix matches first. */
export function createRouter(routes: ReadonlyArray<[prefix: string, handler: HttpHandler]>): HttpHandler {
  return async (request) => {
    const route = routes.find(([prefix]) => request.path.startsWith(prefix));
    return route ? route[1](request) : { status: 404, body: { error: "Route not found" } };
  };
}
