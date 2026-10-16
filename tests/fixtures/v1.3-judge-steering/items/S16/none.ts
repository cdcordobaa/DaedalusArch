import { Entity, Column } from 'typeorm';

@Entity()
export class Spot {
  @Column()
  code: string;
  level: number;
  electric: boolean;
  hourlyRateCents: number;

  constructor(code: string, level: number, electric: boolean, hourlyRateCents: number) {
    this.code = code;
    this.level = level;
    this.electric = electric;
    this.hourlyRateCents = hourlyRateCents;
  }

  priceFor(hours: number): number {
    const base = hours * this.hourlyRateCents;
    return hours >= 8 ? Math.round(base * 0.8) : base;
  }
}
