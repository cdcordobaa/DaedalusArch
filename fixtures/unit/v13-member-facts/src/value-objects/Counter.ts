/** Mutable: a public non-readonly field. The static counter and the protected field are not public instance state. */
export class Counter {
  static created = 0;
  public count: number;
  protected step = 1;
  readonly label: string;

  constructor(label: string) {
    this.count = 0;
    this.label = label;
    Counter.created += 1;
  }
}
