import { RecordVisitPort } from '../../../application/ports/in/record-visit.port';
import { VisitProgress } from '../../../domain/dispatch';
import { VisitEventDto } from './visit-event.dto';

export class CrewClockWebhookHandler {
  constructor(private readonly recordVisit: RecordVisitPort) {}

  async handle(event: VisitEventDto): Promise<{ accepted: boolean }> {
    await this.recordVisit.record({ visitRef: event.visit_uid, progress: this.toProgress(event.visit_state) });
    return { accepted: true };
  }

  private toProgress(state: string): VisitProgress {
    if (state === 'ON_SITE' || state === 'CLOSED') return 'attended';
    if (state === 'VOIDED') return 'cancelled';
    return 'scheduled';
  }
}
