import { CallOutStatus } from '../../../domain/call-out-status';

export interface CustomerNotifierPort {
  notify(customerId: string, callOutId: string, status: CallOutStatus): Promise<void>;
}
