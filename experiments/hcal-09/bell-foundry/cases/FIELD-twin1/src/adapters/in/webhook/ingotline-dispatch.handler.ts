import { RecordDispatchPort } from '../../../application/ports/in/record-dispatch.port';
import { MetalReadiness } from '../../../domain/metal-lot';
import { DispatchNoticeDto } from './dispatch.dto';

const NOTICE_FIELDS = { lotRef: 'heat_number', state: 'dispatch_state' } as const satisfies Record<string, keyof DispatchNoticeDto>;

export class IngotlineDispatchHandler {
  constructor(private readonly recordDispatch: RecordDispatchPort) {}

  async handle(notice: DispatchNoticeDto): Promise<{ accepted: boolean }> {
    const lotRef = notice[NOTICE_FIELDS.lotRef];
    await this.recordDispatch.record({ lotRef, readiness: this.toReadiness(notice[NOTICE_FIELDS.state]) });
    return { accepted: true };
  }

  private toReadiness(state: string): MetalReadiness {
    if (state === 'LANDED') return 'arrived';
    if (state === 'LOADED') return 'shipped';
    return state === 'REJECTED' ? 'refused' : 'reserved';
  }
}
