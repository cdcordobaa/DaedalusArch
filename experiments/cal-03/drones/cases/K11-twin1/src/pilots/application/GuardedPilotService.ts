import type { UnitOfWork } from '../../shared-kernel/UnitOfWork';
import type { PilotRepository } from '../domain/pilot/PilotRepository';

export class GuardedPilotService {
  constructor(
    private readonly pilots: PilotRepository,
    private readonly uow: UnitOfWork,
  ) {}

  assign(pilotId: string, surveyId: string, hours: number): void {
    this.uow.run(() => {
      const pilot = this.pilots.findById(pilotId);
      if (!pilot) {
        throw new Error('unknown pilot');
      }
      pilot.assign(surveyId, hours);
      this.pilots.save(pilot);
    });
  }
}
