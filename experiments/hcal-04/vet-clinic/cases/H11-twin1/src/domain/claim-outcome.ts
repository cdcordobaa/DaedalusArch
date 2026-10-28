export type ClaimOutcome = 'accepted' | 'rejected' | 'under-review';
export type RejectionReason = 'coverage-ended' | 'limit-reached' | 'existing-condition';
export type RejectionCategory = 'coverage' | 'limit' | 'medical-history';

export function categoryOf(reason: RejectionReason): RejectionCategory {
  switch (reason) {
    case 'coverage-ended':
      return 'coverage';
    case 'limit-reached':
      return 'limit';
    case 'existing-condition':
      return 'medical-history';
  }
}
