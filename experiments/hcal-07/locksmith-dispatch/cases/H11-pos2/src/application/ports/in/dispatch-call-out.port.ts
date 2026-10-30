import { CallOutStatus } from '../../../domain/call-out-status';
import { RetryAdvice } from '../../../domain/dispatch-policy';

export interface DispatchCallOutCommand {
  readonly callOutId: string;
}

export interface DispatchCallOutResult {
  readonly callOutId: string;
  readonly status: CallOutStatus;
  readonly minutesToArrival: number | null;
  readonly advice: RetryAdvice | null;
}

export interface DispatchCallOutPort {
  dispatch(command: DispatchCallOutCommand): Promise<DispatchCallOutResult>;
}
