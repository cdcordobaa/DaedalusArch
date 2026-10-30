import { RecordDispatchPort } from '../../../application/ports/in/record-dispatch.port';
import { ProductionStage } from '../../../domain/production-stage';
import { JobEventDto } from './job-event.dto';

const STAGE_BY_STATUS: Readonly<Record<string, ProductionStage>> = {
  RECEIVED: ProductionStage.Queued,
  PREFLIGHT: ProductionStage.Checking,
  PRINTING: ProductionStage.OnPress,
  BINDING: ProductionStage.Finishing,
  PACKED: ProductionStage.Boxed,
  SHIPPED: ProductionStage.InTransit,
  DELIVERED: ProductionStage.Arrived,
  CANCELLED: ProductionStage.Stopped,
};

export class PrintHubWebhookHandler {
  constructor(private readonly recordDispatch: RecordDispatchPort) {}

  async handle(event: JobEventDto): Promise<{ accepted: boolean }> {
    const stage = STAGE_BY_STATUS[event.job_status];
    if (stage === undefined) return { accepted: false };
    await this.recordDispatch.record({ productionRef: event.job_id, trackingRef: event.carrier_tracking_id, stage });
    return { accepted: true };
  }
}
