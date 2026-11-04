import { RecordDispatchPort } from '../../../application/ports/in/record-dispatch.port';
import { MetalReadiness } from '../../../domain/metal-lot';
import { DispatchNoticeDto } from './dispatch.dto';

const READINESS: Record<string, MetalReadiness> = { LANDED: 'arrived', LOADED: 'shipped', REJECTED: 'refused' };

export class IngotlineDispatchHandler {
  constructor(private readonly recordDispatch: RecordDispatchPort) {}

  async handle(notice: DispatchNoticeDto): Promise<{ accepted: boolean }> {
    await this.recordDispatch.record({ lotRef: notice.heat_number, readiness: READINESS[notice.dispatch_state] ?? 'reserved' });
    return { accepted: true };
  }
}
