/** The signature service cannot take this request right now; trying again later may succeed. */
export class SignatureServiceBusy extends Error {
  constructor() {
    super('the signature service is busy');
    this.name = 'SignatureServiceBusy';
  }
}
