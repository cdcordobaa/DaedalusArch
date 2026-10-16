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
