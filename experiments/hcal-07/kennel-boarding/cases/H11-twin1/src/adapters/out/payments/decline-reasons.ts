import { RefusalReason } from '../../../domain/deposit';

export const REASON_BY_DECLINE: Record<string, RefusalReason> = {
  card_declined: 'card-refused',
  insufficient_funds: 'no-funds',
  expired_card: 'card-expired',
  do_not_honor: 'card-refused',
};
