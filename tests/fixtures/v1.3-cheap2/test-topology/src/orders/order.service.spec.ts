import { OrdersService } from './order.service';

describe('OrdersService', () => {
  it('places', () => {
    expect(new OrdersService().place('a')).toBe(1);
  });
});
