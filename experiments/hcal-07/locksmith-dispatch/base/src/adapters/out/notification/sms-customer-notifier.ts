import { CustomerNotifierPort } from '../../../application/ports/out/customer-notifier.port';
import { CallOutStatus } from '../../../domain/call-out-status';

export class SmsCustomerNotifier implements CustomerNotifierPort {
  async notify(customerId: string, callOutId: string, status: CallOutStatus): Promise<void> {
    console.log(`[sms to ${customerId}] call-out ${callOutId}: ${status}`);
  }
}
