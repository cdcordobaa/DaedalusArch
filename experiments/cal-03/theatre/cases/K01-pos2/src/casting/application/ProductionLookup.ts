import { ProductionRepository } from '../../productions/domain/production/ProductionRepository';

export class ProductionLookup {
  constructor(private readonly productions: ProductionRepository) {}

  async titleOf(id: string): Promise<string | undefined> {
    const production = await this.productions.findById(id);
    return production?.title;
  }
}
