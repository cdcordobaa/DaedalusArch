import { PaynetErrorCode } from 'paynet-sdk';
import { ChargeOutcome } from '../../../domain/charge-outcome';

const ERROR_TO_OUTCOME: Record<PaynetErrorCode, ChargeOutcome> = {
  ERR_NETWORK_TIMEOUT: 'unavailable',
  ERR_RATE_LIMITED: 'unavailable',
  ERR_INVALID_MERCHANT: 'under-review',
};

export function outcomeForError(code: PaynetErrorCode): ChargeOutcome {
  return ERROR_TO_OUTCOME[code];
}
