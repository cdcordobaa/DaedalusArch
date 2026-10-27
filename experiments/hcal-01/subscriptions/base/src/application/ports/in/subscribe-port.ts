import { Subscription } from '../../../domain/subscription';

export interface SubscribeCommand {
  readonly customerId: string;
  readonly planId: string;
}

export interface SubscribePort {
  execute(command: SubscribeCommand): Promise<Subscription>;
}
