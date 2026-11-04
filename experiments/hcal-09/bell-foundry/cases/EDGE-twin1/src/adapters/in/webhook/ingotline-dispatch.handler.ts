import { RecordDispatchPort } from '../../../application/ports/in';
import { MetalReadiness } from '../../../domain/metal-lot';
import { DispatchNoticeDto } from './dispatch.dto';

export class IngotlineDispatchHandler {
  constructor(private readonly recordDispatch: RecordDispatchPort) {}

  async handle(notice: DispatchNoticeDto): Promise<{ accepted: boolean }> {
    await this.recordDispatch.record({ lotRef: notice.heat_number, readiness: this.toReadiness(notice.dispatch_state) });
    return { accepted: true };
  }

  private toReadiness(state: string): MetalReadiness {
    if (state === 'LANDED') return 'arrived';
    if (state === 'LOADED') return 'shipped';
    return state === 'REJECTED' ? 'refused' : 'reserved';
  }
}
