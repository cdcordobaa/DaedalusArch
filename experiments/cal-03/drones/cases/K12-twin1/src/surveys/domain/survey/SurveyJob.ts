import { Money } from '../../../shared-kernel/Money';
import { Area } from './value-objects/Area';
import { Deliverable, DeliverableKind } from './value-objects/Deliverable';
import { FlightWindow } from './value-objects/FlightWindow';

export type SurveyStatus = 'draft' | 'booked' | 'completed' | 'cancelled';

export class SurveyJob {
  private _deliverables: Deliverable[];
  private _status: SurveyStatus = 'draft';
  private _permitted = false;
  private _pilotId: string | null = null;
  private _price: Money;

  private constructor(
    readonly id: string,
    readonly clientEmail: string,
    readonly siteName: string,
    readonly area: Area,
    readonly window: FlightWindow,
    deliverables: Deliverable[],
    readonly ratePerHectare: Money,
  ) {
    this._deliverables = deliverables;
    this._price = this.computePrice();
  }

  static draft(
    id: string,
    clientEmail: string,
    siteName: string,
    area: Area,
    window: FlightWindow,
    deliverables: Deliverable[],
    ratePerHectare: Money,
  ): SurveyJob {
    if (deliverables.length === 0) {
      throw new Error('a survey needs at least one deliverable');
    }
    return new SurveyJob(id, clientEmail, siteName, area, window, deliverables, ratePerHectare);
  }

  get deliverables(): readonly Deliverable[] {
    return this._deliverables;
  }

  get status(): SurveyStatus {
    return this._status;
  }

  get permitted(): boolean {
    return this._permitted;
  }

  get pilotId(): string | null {
    return this._pilotId;
  }

  get price(): Money {
    return this._price;
  }

  addDeliverable(deliverable: Deliverable): void {
    this.assertOpen();
    if (this._deliverables.some((d) => d.kind === deliverable.kind && d.format === deliverable.format)) {
      throw new Error('duplicate deliverable');
    }
    this._deliverables = [...this._deliverables, deliverable];
    this._price = this.computePrice();
  }

  removeDeliverable(kind: DeliverableKind): void {
    this.assertOpen();
    const remaining = this._deliverables.filter((d) => d.kind !== kind);
    if (remaining.length === 0) {
      throw new Error('a survey needs at least one deliverable');
    }
    this._deliverables = remaining;
    this._price = this.computePrice();
  }

  applyVolumeDiscount(): void {
    this.assertOpen();
    const factor = this.area.hectares > 100 ? 0.9 : 1;
    this._price = this._price.times(factor);
  }

  book(): void {
    if (this._status !== 'draft') {
      throw new Error('only a draft survey can be booked');
    }
    this._status = 'booked';
  }

  markPermitted(): void {
    if (this._status !== 'booked') {
      throw new Error('only a booked survey can be permitted');
    }
    this._permitted = true;
  }

  assignPilot(pilotId: string): void {
    if (this._status !== 'booked') {
      throw new Error('only a booked survey can get a pilot');
    }
    this._pilotId = pilotId;
  }

  complete(): void {
    if (this._status !== 'booked' || !this._permitted || this._pilotId === null) {
      throw new Error('survey is not ready to be completed');
    }
    this._status = 'completed';
  }

  cancel(): void {
    if (this._status === 'completed') {
      throw new Error('a completed survey cannot be cancelled');
    }
    this._status = 'cancelled';
  }

  private assertOpen(): void {
    if (this._status === 'completed' || this._status === 'cancelled') {
      throw new Error('survey is closed');
    }
  }

  private computePrice(): Money {
    return this.ratePerHectare.times(this.area.hectares * (1 + 0.25 * (this._deliverables.length - 1)));
  }
}
