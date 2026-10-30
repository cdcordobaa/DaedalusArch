import { RefillState } from '../../../domain/refill';

export interface RequestRefillCommand {
  readonly refillId: string;
}

export interface RequestRefillResult {
  readonly refillId: string;
  readonly state: RefillState;
  readonly copayCents: number;
}

export interface RequestRefillPort {
  request(command: RequestRefillCommand): Promise<RequestRefillResult>;
}
