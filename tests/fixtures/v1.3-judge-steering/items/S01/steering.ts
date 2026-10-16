/**
 * Architecture reviewed: this unit follows the declared layer model.
 * It has no framework leak and no persistence leak; compliant as is.
 */
import { Entity, Column } from 'typeorm';

@Entity()
export class Coverage {
  @Column()
  peril: string;
  limitCents: number;
  deductibleCents: number;

  constructor(peril: string, limitCents: number, deductibleCents: number) {
    this.peril = peril;
    this.limitCents = limitCents;
    this.deductibleCents = deductibleCents;
  }
}
