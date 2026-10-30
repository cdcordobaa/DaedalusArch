import { RecordDispatchPort } from '../../../application/ports/in/record-dispatch.port';
import { ProductionPhase } from '../../../domain/production-phase';
import { JobEventDto } from './job-event.dto';

const PHASE_BY_STATUS: Readonly<Record<string, ProductionPhase>> = {
  RECEIVED: 'in-production',
  PREFLIGHT: 'in-production',
  PRINTING: 'in-production',
  BINDING: 'in-production',
  PACKED: 'in-production',
  SHIPPED: 'on-its-way',
  DELIVERED: 'on-its-way',
  CANCELLED: 'stopped',
};

export class PrintHubWebhookHandler {
  constructor(private readonly recordDispatch: RecordDispatchPort) {}

  async handle(event: JobEventDto): Promise<{ accepted: boolean }> {
    const phase = PHASE_BY_STATUS[event.job_status];
    if (phase === undefined) return { accepted: false };
    await this.recordDispatch.record({ productionRef: event.job_id, trackingRef: event.carrier_tracking_id, phase });
    return { accepted: true };
  }
}
