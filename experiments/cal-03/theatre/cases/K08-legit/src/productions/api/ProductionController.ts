import { ProductionDto } from '../contracts/ProductionDto';
import { ProductionService } from '../application/ProductionService';

export class ProductionController {
  constructor(private readonly service: ProductionService) {}

  async create(body: { id: string; slug: string; title: string; maxCast: number; roomId: string }): Promise<void> {
    await this.service.create(body.id, body.slug, body.title, body.maxCast, body.roomId);
  }

  async open(id: string, role = 'stage-manager'): Promise<void> {
    if (role !== 'stage-manager') {
      throw new Error('only a stage manager can open a production');
    }
    await this.service.open(id);
  }

  async show(id: string): Promise<ProductionDto> {
    return this.service.get(id);
  }
}
