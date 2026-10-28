import { AvailabilityPolicy } from './AvailabilityPolicy';

export class Actor {
  private _name: string;
  private _engagements = 0;

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

  async canTake(policy: AvailabilityPolicy, from: number, to: number): Promise<boolean> {
    return policy.isFree(this.id, from, to);
  }

  startEngagement(): void {
    this._engagements += 1;
  }
}
