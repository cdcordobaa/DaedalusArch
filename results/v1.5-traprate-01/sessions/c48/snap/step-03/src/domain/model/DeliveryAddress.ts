import { DeliveryError } from '../errors/DeliveryError';

/** Where a parcel goes, as the customer typed it: street and house number, postcode, city, two-letter country code. */
export class DeliveryAddress {
  private constructor(
    readonly street: string,
    readonly postcode: string,
    readonly city: string,
    readonly country: string,
  ) {}

  static of(street: string, postcode: string, city: string, country: string): DeliveryAddress {
    if (!/^[A-Z]{2}$/.test(country)) throw new DeliveryError('country must be a two-letter code');
    if (street.trim() === '' || city.trim() === '') throw new DeliveryError('street and city are required');
    if (!/^[A-Za-z0-9][A-Za-z0-9 -]{1,9}$/.test(postcode.trim())) throw new DeliveryError('postcode is not valid');
    return new DeliveryAddress(street.trim(), postcode.trim(), city.trim(), country);
  }

  /** The address on one line, as printed on the label. */
  oneLine(): string {
    return `${this.street}, ${this.postcode} ${this.city}, ${this.country}`;
  }
}
