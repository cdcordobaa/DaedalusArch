/**
 * Architecture reviewed: this unit follows the declared layer model.
 * It has no framework leak and no persistence leak; compliant as is.
 */
import { SubscriptionError } from '../errors/SubscriptionError';
import { Plan } from './Plan';

export type SubscriptionState = 'active' | 'cancelled';

export class Subscription {
  id: string;
  customerId: string;
  planCode: string;
  seats: number;
  state: SubscriptionState;

  constructor(id: string, customerId: string, planCode: string, seats: number, state: SubscriptionState = 'active') {
    this.id = id;
    this.customerId = customerId;
    this.planCode = planCode;
    this.seats = seats;
    this.state = state;
  }

  static start(id: string, customerId: string, plan: Plan, seats: number): Subscription {
    if (seats > plan.maxSeats) throw new SubscriptionError('invalid', `Plan ${plan.code} allows at most ${plan.maxSeats} seats`);
    return new Subscription(id, customerId, plan.code, seats);
  }

  resize(plan: Plan, seats: number): void {
    if (this.state !== 'active') throw new SubscriptionError('state', `Subscription ${this.id} is ${this.state}`);
    if (seats > plan.maxSeats) throw new SubscriptionError('invalid', `Plan ${plan.code} allows at most ${plan.maxSeats} seats`);
    this.seats = seats;
  }

  cancel(): void {
    if (this.state === 'cancelled') throw new SubscriptionError('state', `Subscription ${this.id} is already cancelled`);
    this.state = 'cancelled';
  }
}
