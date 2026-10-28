import { DomainEvent } from '../../../shared-kernel/DomainEvent';
import { ProductionOpened } from '../events/ProductionOpened';

export type ProductionStatus = 'planning' | 'open' | 'closed';

export class Production {
  private _status: ProductionStatus = 'planning';
  private _title: string;
  private _castIds: string[] = [];
  private _shows: number[] = [];
  private _events: DomainEvent[] = [];

  constructor(
    readonly id: string,
    readonly slug: string,
    title: string,
    readonly maxCast: number,
    readonly rehearsalRoomId: string,
  ) {
    this._title = title;
  }

  get status(): ProductionStatus {
    return this._status;
  }

  get title(): string {
    return this._title;
  }

  get castIds(): readonly string[] {
    return this._castIds;
  }

  get showCount(): number {
    return this._shows.length;
  }

  get firstShowAt(): number {
    return Math.min(...this._shows);
  }

  setTitle(title: string): void {
    if (title.trim() === '') {
      throw new Error('title required');
    }
    this._title = title;
  }

  scheduleShow(at: number): void {
    if (this._status === 'closed') {
      throw new Error('production closed');
    }
    this._shows.push(at);
  }

  addCast(actorId: string): void {
    if (this._status === 'closed') {
      throw new Error('production closed');
    }
    if (this._castIds.includes(actorId)) {
      throw new Error('actor already cast');
    }
    if (this._castIds.length >= this.maxCast) {
      throw new Error('cast is full');
    }
    this._castIds.push(actorId);
  }

  open(): void {
    if (this._status !== 'planning') {
      throw new Error('production already opened');
    }
    if (this._shows.length === 0) {
      throw new Error('production needs at least one show');
    }
    this._status = 'open';
    this._events.push(new ProductionOpened(this.id, this.rehearsalRoomId, this.firstShowAt));
  }

  close(): void {
    this._status = 'closed';
  }

  pullEvents(): DomainEvent[] {
    const out = this._events;
    this._events = [];
    return out;
  }
}
