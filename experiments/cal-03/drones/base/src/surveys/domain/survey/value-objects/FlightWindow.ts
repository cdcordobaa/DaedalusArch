export class FlightWindow {
  constructor(
    readonly start: Date,
    readonly end: Date,
  ) {
    if (start.getTime() >= end.getTime()) {
      throw new Error('flight window must end after it starts');
    }
  }
}
