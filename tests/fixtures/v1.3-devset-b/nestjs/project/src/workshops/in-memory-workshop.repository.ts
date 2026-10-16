import { Injectable } from '@nestjs/common';
import { Workshop } from '../domain/workshop';
import { WorkshopRepository } from '../domain/workshop-repository';

@Injectable()
export class InMemoryWorkshopRepository implements WorkshopRepository {
  private readonly rows = new Map<string, Workshop>();

  async findById(id: string): Promise<Workshop | undefined> {
    return this.rows.get(id);
  }

  async findAll(): Promise<Workshop[]> {
    return [...this.rows.values()];
  }

  async save(workshop: Workshop): Promise<void> {
    this.rows.set(workshop.id, workshop);
  }
}
