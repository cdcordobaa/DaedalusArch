import { CommissionStatus } from '../../../domain/commission-status';

export interface ParishNotifierPort {
  notify(parishId: string, commissionId: string, status: CommissionStatus): Promise<void>;
}
