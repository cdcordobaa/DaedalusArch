import { EventBus } from '../../shared-kernel/EventBus';
import { UnitOfWork } from '../../shared-kernel/UnitOfWork';
import { ProductionDto } from '../contracts/ProductionDto';
import { Production } from '../domain/production/Production';
import { ProductionRepository } from '../domain/production/ProductionRepository';
import { TicketingGateway } from './ports/TicketingGateway';

export class ProductionService {
  constructor(
    private readonly productions: ProductionRepository,
    private readonly bus: EventBus,
    private readonly ticketing: TicketingGateway,
    private readonly uow: UnitOfWork,
  ) {}

  async create(id: string, slug: string, title: string, maxCast: number, rehearsalRoomId: string): Promise<void> {
    await this.uow.run(() => this.productions.save(new Production(id, slug, title, maxCast, rehearsalRoomId)));
  }

  async rename(id: string, title: string): Promise<void> {
    const production = await this.load(id);
    production.setTitle(title);
    await this.productions.save(production);
  }

  async scheduleShow(id: string, at: number): Promise<void> {
    const production = await this.load(id);
    production.scheduleShow(at);
    await this.productions.save(production);
  }

  async addCast(id: string, actorId: string): Promise<void> {
    const production = await this.load(id);
    production.addCast(actorId);
    await this.productions.save(production);
  }

  async open(id: string): Promise<void> {
    const production = await this.load(id);
    try {
      production.open();
    } catch (error) {
      throw new Error(`cannot open ${id}: ${error instanceof Error ? error.message : 'unknown'}`);
    }
    await this.uow.run(() => this.productions.save(production));
    await this.ticketing.announce(production.id, production.title, production.firstShowAt);
    await this.publish(production);
  }

  async close(id: string): Promise<void> {
    const production = await this.load(id);
    production.close();
    await this.productions.save(production);
  }

  async get(id: string): Promise<ProductionDto> {
    const production = await this.load(id);
    return {
      id: production.id,
      slug: production.slug,
      title: production.title,
      status: production.status,
      castIds: [...production.castIds],
      showCount: production.showCount,
    };
  }

  private async load(id: string): Promise<Production> {
    const production = await this.productions.findById(id);
    if (!production) {
      throw new Error(`production ${id} not found`);
    }
    return production;
  }

  private async publish(production: Production): Promise<void> {
    for (const event of production.pullEvents()) {
      await this.bus.publish(event);
    }
  }
}
