export class Order {
  async load(): Promise<unknown> {
    const db = await import('../infrastructure/db');
    return db;
  }
}
