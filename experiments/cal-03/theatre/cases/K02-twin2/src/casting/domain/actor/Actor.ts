import { Money } from '../../../shared-kernel/value-objects/Money';

export class Actor {
  private _name: string;
  private _engagements = 0;
  private _rate: Money = Money.of(1);

  constructor(
    readonly id: string,
    name: string,
    readonly agentEmail: string,
  ) {
    this._name = name;
  }

  get name(): string {
    return this._name;
  }

  get engagements(): number {
    return this._engagements;
  }

  setName(name: string): void {
    if (name.trim() === '') {
      throw new Error('name required');
    }
    this._name = name;
  }

  get rate(): Money {
    return this._rate;
  }

  setRate(rate: Money): void {
    if (!rate.isPositive()) {
      throw new Error('rate must be positive');
    }
    this._rate = rate;
  }

  startEngagement(): void {
    this._engagements += 1;
  }
}
