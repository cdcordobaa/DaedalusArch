export class AllowanceExceededError extends Error {
  constructor(truckId: string, shiftDate: string) {
    super(`truck ${truckId}: this load would exceed the shift allowance for ${shiftDate}`);
  }
}
