import type { EventBus } from '../../shared-kernel/EventBus';
import { PilotAssigned } from '../domain/events/PilotAssigned';
import { Pilot } from '../domain/pilot/Pilot';
import type { PilotRepository } from '../domain/pilot/PilotRepository';
import type { PilotDto, RegisterPilotCommand } from '../contracts/PilotDto';

export class PilotService {
  constructor(
    private readonly pilots: PilotRepository,
    private readonly bus: EventBus,
  ) {}

  registerPilot(cmd: RegisterPilotCommand): string {
    const pilot = Pilot.register(this.pilots.nextId(), cmd.name, cmd.licenceNo, cmd.weeklyHourCap);
    this.pilots.save(pilot);
    return pilot.id;
  }

  assignToSurvey(pilotId: string, surveyId: string, hours: number): void {
    const pilot = this.load(pilotId);
    pilot.assign(surveyId, hours);
    this.pilots.save(pilot);
    this.bus.publish(new PilotAssigned(pilot.id, surveyId, hours));
  }

  releaseFromSurvey(pilotId: string, surveyId: string): void {
    const pilot = this.load(pilotId);
    pilot.release(surveyId);
    this.pilots.save(pilot);
  }

  preferDrone(pilotId: string, droneId: string): void {
    const pilot = this.load(pilotId);
    pilot.preferDrone(droneId);
    this.pilots.save(pilot);
  }

  getPilot(pilotId: string): PilotDto {
    const pilot = this.load(pilotId);
    return {
      id: pilot.id,
      name: pilot.name,
      licenceNo: pilot.licenceNo,
      weeklyHourCap: pilot.weeklyHourCap,
      assignedHours: pilot.assignedHours,
      preferredDroneId: pilot.preferredDroneId,
    };
  }

  private load(id: string): Pilot {
    const pilot = this.pilots.findById(id);
    if (!pilot) {
      throw new Error(`pilot ${id} not found`);
    }
    return pilot;
  }
}
