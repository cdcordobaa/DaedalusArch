import { ProductionDto } from '../contracts/ProductionDto';
import { ProductionService } from '../application/ProductionService';

export class ProductionController {
  constructor(private readonly service: ProductionService) {}

  async create(body: { id: string; slug: string; title: string; maxCast: number; roomId: string }): Promise<void> {
    await this.service.create(body.id, body.slug, body.title, body.maxCast, body.roomId);
  }

  async addCast(id: string, actorId: string): Promise<void> {
    const dto = await this.service.get(id);
    if (dto.castIds.length >= dto.maxCast) {
      throw new Error('cast is full');
    }
    await this.service.addCast(id, actorId);
  }

  async open(id: string): Promise<void> {
    await this.service.open(id);
  }

  async show(id: string): Promise<ProductionDto> {
    return this.service.get(id);
  }
}
