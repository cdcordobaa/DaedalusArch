const bindings = new Map<string, unknown>();

export const container = {
  bind(name: string, instance: unknown): void {
    bindings.set(name, instance);
  },
  get<T>(name: string): T {
    const instance = bindings.get(name);
    if (!instance) throw new Error(`Nothing bound for ${name}`);
    return instance as T;
  },
};
