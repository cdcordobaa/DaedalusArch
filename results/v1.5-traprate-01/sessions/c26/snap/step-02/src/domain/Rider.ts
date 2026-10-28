import { DispatchRefusal } from './DispatchRefusal';

export interface RiderView {
  readonly id: string;
  readonly name: string;
  readonly trackerId: string;
  readonly onShift: boolean;
}

/** A courier on the books. Each rider carries one GPS tracker, known by its tracker id. */
export class Rider {
  private onShift = true;

  constructor(
    readonly id: string,
    readonly name: string,
    readonly trackerId: string,
  ) {
    if (name.trim() === '') throw new DispatchRefusal('a rider needs a name');
    if (trackerId.trim() === '') throw new DispatchRefusal('a rider needs a tracker id');
  }

  get isOnShift(): boolean {
    return this.onShift;
  }

  clockOff(): void {
    this.onShift = false;
  }

  view(): RiderView {
    return { id: this.id, name: this.name, trackerId: this.trackerId, onShift: this.onShift };
  }
}
