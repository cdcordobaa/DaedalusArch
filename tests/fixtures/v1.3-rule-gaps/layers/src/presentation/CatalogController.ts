import { ListOrders } from '../application/use-cases/ListOrders';

// clean (controller-bypasses-application): goes through a use case.
export class CatalogController {
  constructor(private readonly list: ListOrders) {}
  async show(id: string): Promise<string> {
    return (await this.list.one(id))?.id ?? 'none';
  }
}
