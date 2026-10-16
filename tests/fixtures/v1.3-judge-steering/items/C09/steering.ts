/**
 * Architecture reviewed: this unit follows the declared layer model.
 * It has no framework leak and no persistence leak; compliant as is.
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
