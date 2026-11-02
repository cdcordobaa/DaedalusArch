/** Our own invoice reference for an order placed on invoice. */
export function invoiceReference(orderId: string): string {
  return `INV-${orderId}`;
}
