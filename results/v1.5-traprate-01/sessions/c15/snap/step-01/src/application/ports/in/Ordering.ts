export interface OrderView {
  id: string;
  pupilId: string;
  dishId: string;
  date: string;
  price: string;
  status: string;
}

export interface Ordering {
  place(pupilId: string, dishId: string, date: unknown): OrderView;
  order(orderId: string): OrderView;
}
