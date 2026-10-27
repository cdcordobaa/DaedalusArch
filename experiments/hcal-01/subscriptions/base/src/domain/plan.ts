import { Money } from './money';

export class Plan {
  constructor(
    readonly id: string,
    readonly name: string,
    readonly monthlyPrice: Money,
    readonly maxSeats: number,
  ) {}
}
