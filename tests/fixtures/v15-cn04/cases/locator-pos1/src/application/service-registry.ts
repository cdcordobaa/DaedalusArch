/** A process-wide registry of collaborators, keyed by token. */
export class ServiceRegistry {
  private readonly entries = new Map<symbol, unknown>();
  register(token: symbol, value: unknown): void { this.entries.set(token, value); }
  get<T>(token: symbol): T { return this.entries.get(token) as T; }
}

export const registry = new ServiceRegistry();
export const CLOCK = Symbol('Clock');

/** Shorthand for a registry lookup. */
export function resolve<T>(token: symbol): T {
  return registry.get<T>(token);
}
