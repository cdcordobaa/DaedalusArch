export function payoutRateFor(grade: string): number {
  switch (grade) {
    case 'PRIME':
      return 1;
    case 'JUICING':
      return 0.6;
    case 'CULL':
      return 0.1;
    default:
      return 0;
  }
}
