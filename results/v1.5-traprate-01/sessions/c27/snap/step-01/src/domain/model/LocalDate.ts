import { InvalidRequest } from '../errors/LoungeErrors';

/** A calendar day as written at one airport, YYYY-MM-DD. */
export type LocalDate = string & { readonly __brand: 'LocalDate' };

export function localDate(raw: string): LocalDate {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw new InvalidRequest('date must be YYYY-MM-DD');
  return raw as LocalDate;
}
