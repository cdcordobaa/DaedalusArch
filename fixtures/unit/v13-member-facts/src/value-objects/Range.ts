/** Mutable through public methods; only the public instance methods and arrow properties that assign count. */
export class Range {
  private low = 0;
  private high = 0;
  private readonly items: number[] = [];

  constructor(low: number, high: number) {
    this.low = low;
    this.high = high;
  }

  widen(by: number): void {
    this.low -= by;
    this.high += by;
  }

  public swap(): void {
    [this.low, this.high] = [this.high, this.low];
  }

  readonly bump = (): void => {
    this.high++;
  };

  track(n: number): void {
    // Mutates what a field holds, not the field: not a reassignment.
    this.items.push(n);
  }

  withLow(low: number): Range {
    const r = new Range(low, this.high);
    return r;
  }

  later(): () => void {
    // A function expression has its own `this`.
    return function (this: { low: number }) {
      this.low = 1;
    };
  }

  private reset(): void {
    this.low = 0;
  }

  protected shrink(): void {
    this.high = this.low;
  }

  static unit(): Range {
    return new Range(0, 1);
  }
}
