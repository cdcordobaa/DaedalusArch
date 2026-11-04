import { RecordDispatchPort } from '../../../application/ports/in/record-dispatch.port';
import { MetalReadiness } from '../../../domain/metal-lot';
import { DispatchNoticeDto } from './dispatch.dto';

export class IngotlineDispatchHandler {
  constructor(private readonly recordDispatch: RecordDispatchPort) {}

  async handle(notice: DispatchNoticeDto): Promise<{ accepted: boolean; final?: boolean }> {
    const readiness = this.toReadiness(notice.dispatch_state);
    await this.recordDispatch.record({ lotRef: notice.heat_number, readiness });
    const { isFinalReadiness } = await import('../../../domain/metal-lot');
    return { accepted: true, final: isFinalReadiness(readiness) };
  }

  private toReadiness(state: string): MetalReadiness {
    if (state === 'LANDED') return 'arrived';
    if (state === 'LOADED') return 'shipped';
    return state === 'REJECTED' ? 'refused' : 'reserved';
  }
}
