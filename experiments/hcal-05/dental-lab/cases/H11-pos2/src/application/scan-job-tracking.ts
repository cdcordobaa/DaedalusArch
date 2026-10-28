export enum ScanJobState {
  QUEUED = 'QUEUED',
  PROCESSING = 'PROCESSING',
  DONE = 'DONE',
  REJECTED = 'REJECTED',
}

export function isTerminal(state: ScanJobState): boolean {
  return state === ScanJobState.DONE || state === ScanJobState.REJECTED;
}
