/**
 * Source file for this project, kept in the usual repository layout.
 * It is compiled with the shared compiler options of this workspace.
 */
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
