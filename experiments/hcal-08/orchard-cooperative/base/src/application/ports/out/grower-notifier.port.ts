import { LotStatus } from '../../../domain/lot-status';

export interface GrowerNotifierPort {
  notify(growerId: string, lotId: string, status: LotStatus): Promise<void>;
}
