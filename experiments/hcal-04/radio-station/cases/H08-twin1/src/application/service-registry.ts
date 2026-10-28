export class ServiceRegistry {
  private static readonly services = new Map<string, unknown>();

  static register(name: string, service: unknown): void {
    ServiceRegistry.services.set(name, service);
  }

  static resolve<T>(name: string): T {
    const service = ServiceRegistry.services.get(name);
    if (!service) throw new Error(`Service not registered: ${name}`);
    return service as T;
  }
}
