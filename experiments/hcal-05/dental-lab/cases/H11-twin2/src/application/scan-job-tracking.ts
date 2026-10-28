export enum ScanJobState {
  Waiting = 'waiting',
  Working = 'working',
  Finished = 'finished',
  Refused = 'refused',
}

export function isTerminal(state: ScanJobState): boolean {
  return state === ScanJobState.Finished || state === ScanJobState.Refused;
}
