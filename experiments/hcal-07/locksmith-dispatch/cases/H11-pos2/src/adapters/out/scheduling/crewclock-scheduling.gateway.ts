import { CrewClockClient, SchedulingConflict } from 'crewclock-sdk';
import { SchedulingRequest, TechnicianSchedulingPort } from '../../../application/ports/out/technician-scheduling.port';
import { TechnicianAssignment } from '../../../domain/dispatch';
import { NoTechnicianFreeError, SchedulingUnavailableError } from '../../../domain/errors';

export class CrewClockSchedulingGateway implements TechnicianSchedulingPort {
  private readonly client: CrewClockClient;

  constructor(tenantId: string, apiSecret: string) {
    this.client = new CrewClockClient({ tenant_id: tenantId, api_secret: apiSecret });
  }

  async request(request: SchedulingRequest): Promise<TechnicianAssignment> {
    try {
      const res = await this.client.schedule({
        zone_code: request.district.toUpperCase(),
        skill_tag: `lock-${request.lockType}`,
        window_start_iso: request.earliestStart,
        priority_level: request.urgency === 'emergency' ? 1 : 3,
      });
      return { visitRef: res.visit_uid, technicianRef: res.tech_uid, minutesToArrival: res.eta_minutes };
    } catch (e) {
      if (e instanceof SchedulingConflict) {
        if (e.code === 'E_RATE_LIMIT') throw new SchedulingUnavailableError(`scheduling unavailable: ${e.message}`);
        throw new NoTechnicianFreeError(request.district, e.code);
      }
      throw e;
    }
  }
}
