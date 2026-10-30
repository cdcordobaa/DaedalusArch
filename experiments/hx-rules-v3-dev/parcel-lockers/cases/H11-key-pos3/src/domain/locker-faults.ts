export const FAULT_ADVICE = {
  LB_OFFLINE: 'try another locker',
  LB_POWER: 'wait for the power to return',
  LB_TAMPER: 'call the service desk',
};

export function adviceFor(fault: string): string {
  return (FAULT_ADVICE as Record<string, string>)[fault] ?? 'call the service desk';
}
