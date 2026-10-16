export class FleetError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}
