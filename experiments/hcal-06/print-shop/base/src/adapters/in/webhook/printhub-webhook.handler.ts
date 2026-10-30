import { RecordDispatchPort } from '../../../application/ports/in/record-dispatch.port';
import { JobEventDto } from './job-event.dto';

export class PrintHubWebhookHandler {
  constructor(private readonly recordDispatch: RecordDispatchPort) {}

  async handle(event: JobEventDto): Promise<{ accepted: boolean }> {
    if (event.job_status !== 'SHIPPED') return { accepted: false };
    await this.recordDispatch.record({ productionRef: event.job_id, trackingRef: event.carrier_tracking_id });
    return { accepted: true };
  }
}
