import { RecordDispatchPort } from '../../../application/ports/in/record-dispatch.port';
import { MetalReadiness } from '../../../domain/metal-lot';
import { DispatchNoticeDto } from './dispatch.dto';

export class IngotlineDispatchHandler {
  constructor(private readonly recordDispatch: RecordDispatchPort) {}

  async handle(notice: DispatchNoticeDto): Promise<{ accepted: boolean }> {
    if (typeof notice.heat_number !== 'string' || notice.heat_number.length === 0) return { accepted: false };
    if (typeof notice.dispatch_state !== 'string') return { accepted: false };
    await this.recordDispatch.record({ lotRef: notice.heat_number, readiness: this.toReadiness(notice.dispatch_state) });
    return { accepted: true };
  }

  private toReadiness(state: string): MetalReadiness {
    if (state === 'LANDED') return 'arrived';
    if (state === 'LOADED') return 'shipped';
    return state === 'REJECTED' ? 'refused' : 'reserved';
  }
}
