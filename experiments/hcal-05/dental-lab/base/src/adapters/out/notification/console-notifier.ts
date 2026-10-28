import { NotifierPort } from '../../../application/ports/out/notifier.port';

export class ConsoleNotifier implements NotifierPort {
  async notifyDentist(dentistId: string, message: string): Promise<void> {
    console.log(`[to ${dentistId}] ${message}`);
  }
}
