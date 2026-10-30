/** Taking a seat's price from a voucher: paid, or how much is still due, in euros. */
export type SeatPayment = { readonly paid: true } | { readonly paid: false; readonly due: number };
