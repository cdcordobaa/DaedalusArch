import { DispatchStatus } from '../../../domain/dispatch-status';

export interface BookFreightCommand {
  readonly dispatchId: string;
  readonly collectionDate: string;
}

export interface BookFreightResult {
  readonly dispatchId: string;
  readonly status: DispatchStatus;
}

export interface BookFreightPort {
  book(command: BookFreightCommand): Promise<BookFreightResult>;
}
