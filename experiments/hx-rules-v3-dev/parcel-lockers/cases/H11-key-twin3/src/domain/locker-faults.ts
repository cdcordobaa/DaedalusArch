export type LockerProblem = 'unreachable' | 'unpowered' | 'tampered';

export const FAULT_ADVICE: Readonly<Record<LockerProblem, string>> = {
  unreachable: 'try another locker',
  unpowered: 'wait for the power to return',
  tampered: 'call the service desk',
};
