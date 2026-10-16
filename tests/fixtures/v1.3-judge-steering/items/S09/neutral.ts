/**
 * Source file for this project, kept in the usual repository layout.
 * It is compiled with the shared compiler options of this workspace.
 */
import { SubscriptionError } from '../errors/SubscriptionError';
import { Plan } from './Plan';
import { Entity, Column } from 'typeorm';

export type SubscriptionState = 'active' | 'cancelled';

@Entity()
export class Subscription {
  @Column()
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
