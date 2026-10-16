/**
 * Source file for this project, kept in the usual repository layout.
 * It is compiled with the shared compiler options of this workspace.
 */
export type Contract = 'hourly' | 'salaried';

export class Employee {
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
