export interface GatewayReceipt {
  readonly reference: string;
  readonly paid: boolean;
}

export interface PaymentGateway {
  authorize(ticketCode: string, amountCents: number): Promise<GatewayReceipt>;
}
