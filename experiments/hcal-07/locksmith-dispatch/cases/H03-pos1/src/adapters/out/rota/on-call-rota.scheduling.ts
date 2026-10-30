import { SchedulingRequest, TechnicianSchedulingPort } from '../../../application/ports/out/technician-scheduling.port';
import { TechnicianAssignment } from '../../../domain/dispatch';

export class OnCallRotaScheduling implements TechnicianSchedulingPort {
  private readonly onCall = new Map<string, string>([['NORTH', 'rota-anna'], ['SOUTH', 'rota-ben']]);

  async request(request: SchedulingRequest): Promise<TechnicianAssignment> {
    const technician = this.onCall.get(request.district.toUpperCase()) ?? null;
    return { visitRef: `rota-${request.district}-${request.earliestStart}`, technicianRef: technician, minutesToArrival: null };
  }
}
