import type { BillingResult } from './billing.service';

describe('billing', () => {
  it('has a result shape', () => {
    const r: BillingResult = { total: 1 };
    expect(r.total).toBe(1);
  });
});
