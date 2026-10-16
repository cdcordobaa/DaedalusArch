import { Entity, Column } from 'typeorm';

export type Contract = 'hourly' | 'salaried';

@Entity()
export class Employee {
  @Column()
  id: string;
  name: string;
  hourlyRateCents: number;
  contract: Contract;

  constructor(id: string, name: string, hourlyRateCents: number, contract: Contract) {
    this.id = id;
    this.name = name;
    this.hourlyRateCents = hourlyRateCents;
    this.contract = contract;
  }

  overtimeEligible(): boolean {
    return this.contract === 'hourly';
  }
}
