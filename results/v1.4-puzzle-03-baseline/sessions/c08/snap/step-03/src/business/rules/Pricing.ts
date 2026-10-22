/** Labour is charged per started quarter hour at the workshop's hourly rate. */
export const LABOUR_CENTS_PER_HOUR = 6000;

export function labourCents(minutes: number): number {
  return Math.ceil(minutes / 15) * (LABOUR_CENTS_PER_HOUR / 4);
}

/** What the customer pays for a closed job: labour plus parts. */
export function jobTotalCents(labourMinutes: number, partsCents: number): number {
  return labourCents(labourMinutes) + partsCents;
}

export function formatCents(cents: number): string {
  return `EUR ${(cents / 100).toFixed(2)}`;
}
