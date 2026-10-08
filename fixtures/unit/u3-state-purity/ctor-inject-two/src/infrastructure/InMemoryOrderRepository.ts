export class InMemoryOrderRepository {
  private readonly rows: string[] = [];

  save(id: string): void {
    this.rows.push(id);
  }
}
