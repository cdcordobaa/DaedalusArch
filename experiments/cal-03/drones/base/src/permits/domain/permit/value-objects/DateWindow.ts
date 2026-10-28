export class DateWindow {
  constructor(
    readonly start: Date,
    readonly end: Date,
  ) {
    if (start.getTime() >= end.getTime()) {
      throw new Error('permit window must end after it starts');
    }
  }
}
