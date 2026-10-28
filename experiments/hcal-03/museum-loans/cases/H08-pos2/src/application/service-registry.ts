export class ServiceRegistry {
  private static readonly entries = new Map<string, unknown>();

  static register(key: string, value: unknown): void {
    ServiceRegistry.entries.set(key, value);
  }

  static resolve<T>(key: string): T {
    const value = ServiceRegistry.entries.get(key);
    if (value === undefined) throw new Error(`Nothing registered for ${key}`);
    return value as T;
  }
}

export function resolve<T>(key: string): T {
  return ServiceRegistry.resolve<T>(key);
}
