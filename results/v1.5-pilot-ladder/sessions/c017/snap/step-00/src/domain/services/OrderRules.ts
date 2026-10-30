import { OrderError } from '../errors/OrderError';

/** What an order must look like before we make the bouquet. */
export class OrderRules {
  required(value: string, what: string): string {
    if (value.trim() === '') throw new OrderError(what + ' is required');
    return value.trim();
  }

  postcode(raw: string): string {
    if (!/^[0-9]{4} ?[A-Za-z]{2}$/.test(raw.trim())) throw new OrderError('postcode is not valid');
    return raw.trim().toUpperCase().replace(/^([0-9]{4})([A-Z]{2})$/, '$1 $2');
  }

  message(text: string): string {
    if (text.length > 200) throw new OrderError('a card message has at most 200 characters');
    return text;
  }
}
