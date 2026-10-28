import type { PilotDto } from '../contracts/PilotDto';
import type { PilotService } from './PilotService';

export class CachedPilotQuery {
  private readonly cache = new Map<string, PilotDto>();

  constructor(private readonly service: PilotService) {}

  get(pilotId: string): PilotDto {
    const cached = this.cache.get(pilotId);
    if (cached) {
      return cached;
    }
    const fresh = this.service.getPilot(pilotId);
    this.cache.set(pilotId, fresh);
    return fresh;
  }

  invalidate(pilotId: string): void {
    this.cache.delete(pilotId);
  }
}
