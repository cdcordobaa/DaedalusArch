import { RecordDispatchPort } from '../../../application/ports/in/record-dispatch.port';
import { DispatchNoticeDto } from './dispatch.dto';

export class IngotlineDispatchHandler {
  constructor(private readonly recordDispatch: RecordDispatchPort) {}

  async handle(notice: DispatchNoticeDto): Promise<{ accepted: boolean }> {
    await this.recordDispatch.record({ lotRef: notice.heat_number, dispatchState: notice.dispatch_state });
    return { accepted: true };
  }
}
