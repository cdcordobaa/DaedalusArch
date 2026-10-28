import type { PilotRepository } from '../domain/pilot/PilotRepository';

export class PilotTransferService {
  constructor(private readonly pilots: PilotRepository) {}

  transfer(fromId: string, toId: string, surveyId: string, hours: number): void {
    const from = this.pilots.findById(fromId);
    const to = this.pilots.findById(toId);
    if (!from || !to) {
      throw new Error('unknown pilot');
    }
    from.release(surveyId);
    to.assign(surveyId, hours);
    this.pilots.saveBoth(from, to);
  }
}
