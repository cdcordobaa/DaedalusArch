export interface Plot {
  number: number;
  sizeM2: number;
  raisedBed: boolean;
}

export interface Gardener {
  id: string;
  name: string;
  email: string;
  appliedAt: string;
}

export type AllocationStatus = 'awaiting-payment' | 'payment-failed' | 'paid' | 'released';

export interface Allocation {
  id: string;
  plotNumber: number;
  gardenerId: string;
  allocatedAt: string;
  fee: number;
  status: AllocationStatus;
  paymentLink?: string;
  paymentRef?: string;
}

export const PAYMENT_DEADLINE_DAYS = 14;

export function feeFor(plot: Plot): number {
  // yearly fee: 1.5 per m2, raised beds +10
  return Math.round(plot.sizeM2 * 1.5 + (plot.raisedBed ? 10 : 0));
}

export function isPaymentOverdue(a: Allocation, now: Date): boolean {
  if (a.status !== 'awaiting-payment' && a.status !== 'payment-failed') return false;
  const deadline = new Date(a.allocatedAt).getTime() + PAYMENT_DEADLINE_DAYS * 24 * 3600 * 1000;
  return now.getTime() > deadline;
}

export function isActive(a: Allocation): boolean {
  return a.status !== 'released';
}
