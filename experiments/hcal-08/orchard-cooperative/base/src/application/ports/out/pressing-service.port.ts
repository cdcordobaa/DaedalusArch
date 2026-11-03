import { PressingTicket } from '../../../domain/pressing';

export interface PressingOrder {
  readonly variety: string;
  readonly crates: number;
  readonly deliveredOn: string;
}

export interface PressingServicePort {
  book(order: PressingOrder): Promise<PressingTicket>;
}
