/** An entity (outside the value-object globs): mutable by design, never reported by FF-DT03. */
export class Order {
  public status = 'new';

  set state(s: string) {
    this.status = s;
  }

  cancel(): void {
    this.status = 'cancelled';
  }
}
