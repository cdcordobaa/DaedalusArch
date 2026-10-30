export interface CancelDispatchResult {
  readonly status: number;
}

export interface CancelDispatchPort {
  cancel(dispatchId: string): Promise<CancelDispatchResult>;
}
