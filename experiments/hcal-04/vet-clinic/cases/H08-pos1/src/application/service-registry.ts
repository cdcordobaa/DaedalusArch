export class ServiceRegistry {
  private static readonly entries = new Map<string, unknown>();

  static register<T>(key: string, value: T): void {
    ServiceRegistry.entries.set(key, value);
  }

  static get<T>(key: string): T {
    const value = ServiceRegistry.entries.get(key);
    if (value === undefined) throw new Error(`nothing registered for ${key}`);
    return value as T;
  }
}
