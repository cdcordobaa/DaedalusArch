import { RecordDispatchPort } from '../../../application/ports/in/record-dispatch.port';
import { JobEventDto } from './job-event.dto';

export class PrintHubWebhookHandler {
  constructor(private readonly recordDispatch: RecordDispatchPort) {}

  async handle(event: JobEventDto): Promise<{ accepted: boolean }> {
    await this.recordDispatch.record({ productionRef: event.job_id, trackingRef: event.carrier_tracking_id, jobStatus: event.job_status });
    return { accepted: true };
  }
}
