/** The membership level a booking is priced for, as class bookings see it. The level itself is decided by membership. */
export type CustomerLevel = 'premium' | 'plus' | 'basic';

/** The class-fee discount per level: a pricing rule of class bookings. */
export function discountRateOf(level: CustomerLevel): number {
  return level === 'premium' ? 0.2 : level === 'plus' ? 0.1 : 0;
}
