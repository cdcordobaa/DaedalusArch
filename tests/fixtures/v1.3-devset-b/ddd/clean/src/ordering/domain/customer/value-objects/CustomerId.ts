export class CustomerId {
  constructor(readonly value: string) {
    if (value.length === 0) throw new Error('CustomerId is empty');
  }
}
