import { ProductionService } from '../../productions';
import type { ProductionDto } from '../../productions/contracts/ProductionDto';

export class ProductionLookup {
  constructor(private readonly productions: ProductionService) {}

  async titleOf(id: string): Promise<string> {
    const dto: ProductionDto = await this.productions.get(id);
    return dto.title;
  }
}
