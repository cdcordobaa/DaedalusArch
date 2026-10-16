/** An institution or private collector that lends works to the museum. */
export class Lender {
  readonly name: string;
  readonly country: string;
  readonly anonymous: boolean;

  constructor(name: string, country: string, anonymous: boolean) {
    this.name = name;
    this.country = country;
    this.anonymous = anonymous;
  }

  /** Label credit as printed on the wall text. */
  creditLine(): string {
    return this.anonymous ? 'Private collection' : `Lent by ${this.name}`;
  }
}
