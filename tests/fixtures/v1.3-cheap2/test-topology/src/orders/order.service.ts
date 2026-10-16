export class OrdersService {
  private readonly ids: string[] = [];

  place(id: string): number {
    this.ids.push(id);
    return this.ids.length;
  }
}
