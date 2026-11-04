export interface Money {
  readonly amount: number;
  readonly currency: 'EUR';
}

export const euros = (amount: number): Money => ({ amount, currency: 'EUR' });
