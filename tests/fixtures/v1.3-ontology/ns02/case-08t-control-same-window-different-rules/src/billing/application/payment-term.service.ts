const PAYMENT_TERM_MS = 2_592_000_000;

export class PaymentTermService {
  isWithinPaymentTerm(issuedAtMs: number, nowMs: number): boolean {
    return !(nowMs - issuedAtMs > PAYMENT_TERM_MS);
  }
}
