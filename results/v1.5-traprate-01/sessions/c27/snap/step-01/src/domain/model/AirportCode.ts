import { InvalidRequest } from '../errors/LoungeErrors';

/** A three-letter IATA airport code, upper case. */
export type AirportCode = string & { readonly __brand: 'AirportCode' };

export function airportCode(raw: string): AirportCode {
  const code = raw.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) throw new InvalidRequest('airport must be a three-letter code');
  return code as AirportCode;
}
