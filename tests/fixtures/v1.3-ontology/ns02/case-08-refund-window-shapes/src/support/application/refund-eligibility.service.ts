const REFUND_WINDOW_MS = 2_592_000_000;

export class RefundEligibilityService {
  isRefundable(purchasedAtMs: number, nowMs: number): boolean {
    return !(nowMs - purchasedAtMs > REFUND_WINDOW_MS);
  }
}
