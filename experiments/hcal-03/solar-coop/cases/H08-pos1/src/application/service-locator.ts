export class ServiceLocator {
  private static readonly entries = new Map<string, unknown>();

  static register(key: string, value: unknown): void {
    ServiceLocator.entries.set(key, value);
  }

  static resolve<T>(key: string): T {
    const value = ServiceLocator.entries.get(key);
    if (value === undefined) throw new Error(`nothing registered for ${key}`);
    return value as T;
  }
}
