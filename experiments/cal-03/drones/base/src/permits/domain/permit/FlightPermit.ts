import { DateWindow } from './value-objects/DateWindow';

export type PermitStatus = 'requested' | 'granted' | 'denied';

export class FlightPermit {
  private _status: PermitStatus = 'requested';
  private _reference: string | null = null;
  private _denialReason: string | null = null;

  private constructor(
    readonly id: string,
    readonly surveyId: string,
    readonly window: DateWindow,
  ) {}

  static request(id: string, surveyId: string, window: DateWindow): FlightPermit {
    return new FlightPermit(id, surveyId, window);
  }

  get status(): PermitStatus {
    return this._status;
  }

  get reference(): string | null {
    return this._reference;
  }

  get denialReason(): string | null {
    return this._denialReason;
  }

  grant(reference: string): void {
    if (this._status !== 'requested') {
      throw new Error('only a requested permit can be granted');
    }
    if (reference.trim() === '') {
      throw new Error('a granted permit needs a reference');
    }
    this._reference = reference;
    this._status = 'granted';
  }

  deny(reason: string): void {
    if (this._status !== 'requested') {
      throw new Error('only a requested permit can be denied');
    }
    this._denialReason = reason;
    this._status = 'denied';
  }
}
