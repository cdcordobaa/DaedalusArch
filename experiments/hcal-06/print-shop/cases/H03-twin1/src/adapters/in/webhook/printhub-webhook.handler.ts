import { RecordDispatchPort } from '../../../application/ports/in/record-dispatch.port';
import type { RequestContext } from '../shared/request-context';
import { JobEventDto } from './job-event.dto';

export class PrintHubWebhookHandler {
  constructor(private readonly recordDispatch: RecordDispatchPort) {}

  async handle(event: JobEventDto, ctx?: RequestContext): Promise<{ accepted: boolean }> {
    console.log(`[${ctx?.correlationId ?? '-'}] job event ${event.job_id}`);
    if (event.job_status !== 'SHIPPED') return { accepted: false };
    await this.recordDispatch.record({ productionRef: event.job_id, trackingRef: event.carrier_tracking_id });
    return { accepted: true };
  }
}
