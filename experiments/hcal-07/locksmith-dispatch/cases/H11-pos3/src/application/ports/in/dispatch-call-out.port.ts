import { CallOutStatus } from '../../../domain/call-out-status';

export interface DispatchCallOutCommand {
  readonly callOutId: string;
}

export interface DispatchCallOutResult {
  readonly callOutId: string;
  readonly status: CallOutStatus;
  readonly minutesToArrival: number | null;
  readonly windowStart: string;
}

export interface DispatchCallOutPort {
  dispatch(command: DispatchCallOutCommand): Promise<DispatchCallOutResult>;
}
