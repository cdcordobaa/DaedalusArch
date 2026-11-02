// The invoice export's own columns; two of them happen to be spelled like carrier fields.
export const INVOICE_COLUMNS: string[] = ['booking_ref', 'confirmed_at', 'invoice_no', 'shipper_name'];

export function invoiceHeader(): string {
  return INVOICE_COLUMNS.join(',');
}
