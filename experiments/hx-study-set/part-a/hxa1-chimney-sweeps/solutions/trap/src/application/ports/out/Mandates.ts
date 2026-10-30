import type { MandateRecord } from '../../../domain/model/MandateRecord';

export interface Mandates {
  find(mandateId: string): Promise<MandateRecord>;
  charge(mandateId: string, amount: number): Promise<{ paymentId: string; providerStatus: string }>;
}
