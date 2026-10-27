export class BackerId {
  private constructor(readonly value: string) {}

  static of(value: string): BackerId {
    if (!/^B-\d+$/.test(value)) throw new Error(`no backer ${value}`);
    return new BackerId(value);
  }
}
