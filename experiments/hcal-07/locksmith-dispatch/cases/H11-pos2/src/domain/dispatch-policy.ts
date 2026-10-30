export type RetryAdvice = 'retry-later' | 'widen-window' | 'give-up';

export function adviseAfterFailure(failureCode: string): RetryAdvice {
  switch (failureCode) {
    case 'E_SLOT_TAKEN':
      return 'widen-window';
    case 'E_TECH_OFF_SHIFT':
      return 'retry-later';
    default:
      return 'give-up';
  }
}
