/** A ward request our own checks refuse, before any unit is taken or ordered. */
export class RequestRefused extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'RequestRefused';
  }
}
