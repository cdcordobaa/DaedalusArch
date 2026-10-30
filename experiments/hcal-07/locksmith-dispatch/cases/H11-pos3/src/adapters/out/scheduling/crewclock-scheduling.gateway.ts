import { CrewClockClient, SchedulingConflict } from 'crewclock-sdk';
import { SchedulingRequest, TechnicianSchedulingPort, VisitSlot } from '../../../application/ports/out/technician-scheduling.port';
import { NoTechnicianFreeError, SchedulingUnavailableError } from '../../../domain/errors';

export class CrewClockSchedulingGateway implements TechnicianSchedulingPort {
  private readonly client: CrewClockClient;

  constructor(tenantId: string, apiSecret: string) {
    this.client = new CrewClockClient({ tenant_id: tenantId, api_secret: apiSecret });
  }

  async request(request: SchedulingRequest): Promise<VisitSlot> {
    try {
      const res = await this.client.schedule({
        zone_code: request.district.toUpperCase(),
        skill_tag: `lock-${request.lockType}`,
        window_start_iso: request.earliestStart,
        priority_level: request.urgency === 'emergency' ? 1 : 3,
      });
      return { visit_uid: res.visit_uid, tech_uid: res.tech_uid, eta_minutes: res.eta_minutes, window_start_iso: res.window_start_iso };
    } catch (e) {
      if (e instanceof SchedulingConflict) {
        if (e.code === 'E_RATE_LIMIT') throw new SchedulingUnavailableError(`scheduling unavailable: ${e.message}`);
        throw new NoTechnicianFreeError(request.district);
      }
      throw e;
    }
  }
}
