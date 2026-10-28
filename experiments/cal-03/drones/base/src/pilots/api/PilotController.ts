import type { PilotService } from '../application/PilotService';
import type { PilotDto, RegisterPilotCommand } from '../contracts/PilotDto';

export class PilotController {
  constructor(private readonly service: PilotService) {}

  register(body: RegisterPilotCommand): { id: string } {
    return { id: this.service.registerPilot(body) };
  }

  assign(pilotId: string, surveyId: string, hours: number): PilotDto {
    this.service.assignToSurvey(pilotId, surveyId, hours);
    return this.service.getPilot(pilotId);
  }

  get(pilotId: string): PilotDto {
    return this.service.getPilot(pilotId);
  }
}
