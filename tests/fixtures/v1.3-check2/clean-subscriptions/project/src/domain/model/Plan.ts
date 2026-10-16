export class Plan {
  code: string;
  monthlyPricePerSeatCents: number;
  maxSeats: number;

  constructor(code: string, monthlyPricePerSeatCents: number, maxSeats: number) {
    this.code = code;
    this.monthlyPricePerSeatCents = monthlyPricePerSeatCents;
    this.maxSeats = maxSeats;
  }

  monthlyCost(seats: number): number {
    return seats * this.monthlyPricePerSeatCents;
  }
}
