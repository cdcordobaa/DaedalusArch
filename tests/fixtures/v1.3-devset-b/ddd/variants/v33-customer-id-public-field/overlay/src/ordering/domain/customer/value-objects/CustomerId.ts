export class CustomerId {
  constructor(public value: string) {
    if (value.length === 0) throw new Error('CustomerId is empty');
  }
}
