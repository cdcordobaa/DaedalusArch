/** Mutable: a `set` accessor over a private field (the shape of DDD probe g01). */
export class Quantity {
  private current: number;

  constructor(value: number) {
    this.current = value;
  }

  get value(): number {
    return this.current;
  }

  set value(v: number) {
    this.current = v;
  }
}
