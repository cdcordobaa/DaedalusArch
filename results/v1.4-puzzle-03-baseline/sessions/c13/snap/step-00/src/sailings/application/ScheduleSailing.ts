import { Sailing } from '../domain/sailing/Sailing';
import type { SailingRepository } from '../domain/sailing/SailingRepository';

export class ScheduleSailing {
  constructor(private readonly sailings: SailingRepository) {}

  execute(route: string, departsAt: string, capacity: number): string {
    const sailing = Sailing.schedule(this.sailings.nextId(), route, departsAt, capacity);
    this.sailings.save(sailing);
    return sailing.id.value;
  }
}
