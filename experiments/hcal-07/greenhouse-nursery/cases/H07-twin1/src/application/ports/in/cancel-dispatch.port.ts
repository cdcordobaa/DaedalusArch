export interface CancelDispatchResult {
  readonly outcome: 'cancelled' | 'too-late';
}

export interface CancelDispatchPort {
  cancel(dispatchId: string): Promise<CancelDispatchResult>;
}
