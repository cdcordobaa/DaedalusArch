/** What became of a text we sent: it reached the phone, it never will, or it is still on its way. */
export type TextDelivery = 'delivered' | 'failed' | 'pending';
