import { ClaimResponse } from 'rxclaim-sdk';
import { CoverageVerdict } from '../../../domain/coverage';

export function toVerdict(res: ClaimResponse): CoverageVerdict {
  switch (res.claim_status) {
    case 'PAID':
    case 'CAPTURED':
      return 'covered';
    case 'PENDING_PA':
      return 'prior-auth';
    case 'REJECTED':
      return res.reject_codes.includes('R75') ? 'prior-auth' : 'not-covered';
    case 'REVERSED':
      return 'not-covered';
  }
}
