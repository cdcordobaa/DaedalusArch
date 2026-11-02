// Typings of the Debitora direct debit SDK (debitora-sdk 3.2), as shipped by the vendor. Amounts are in cents.
declare module 'debitora-sdk' {
  export type DebitoraMandateStatus = 'pending_customer_approval' | 'pending_submission' | 'submitted' | 'mandate_active' | 'suspended_by_payer' | 'cancelled' | 'expired';
  export type DebitoraPaymentStatus = 'pending_submission' | 'submitted' | 'confirmed' | 'paid_out' | 'collection_failed' | 'charged_back';
  export interface DebitoraMandate {
    id: string;
    status: DebitoraMandateStatus;
    scheme: 'sepa_core' | 'bacs';
    reference: string;
    next_possible_charge_date: string;
  }
  export interface DebitoraPayment {
    id: string;
    mandate: string;
    amount: number;
    currency: string;
    status: DebitoraPaymentStatus;
    charge_date: string;
    description?: string;
  }
  export class DebitoraError extends Error {
    readonly type: 'invalid_api_usage' | 'invalid_state' | 'gateway_error';
  }
  export class DebitoraClient {
    constructor(options: { accessToken: string; environment?: 'live' | 'sandbox' });
    getMandate(id: string): Promise<DebitoraMandate>;
    createPayment(params: { mandate: string; amount: number; currency: string; description?: string }): Promise<DebitoraPayment>;
    getPayment(id: string): Promise<DebitoraPayment>;
  }
}
