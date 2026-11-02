export interface RefundRequest {
  readonly paymentReference: string;
  readonly amount: number;
  readonly currency: string;
}

export interface RefundView {
  readonly reference: string;
  readonly settled: boolean;
}

export interface RefundPayment {
  refund(request: RefundRequest): Promise<RefundView>;
}
