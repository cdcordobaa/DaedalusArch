import { ParishNotifierPort } from '../../../application/ports/out/parish-notifier.port';
import { CommissionStatus } from '../../../domain/commission-status';
import { statusLine } from './templates';

export class MailParishNotifier implements ParishNotifierPort {
  async notify(parishId: string, commissionId: string, status: CommissionStatus): Promise<void> {
    console.log(`to parish ${parishId}: ${statusLine(commissionId, status)}`);
  }
}
