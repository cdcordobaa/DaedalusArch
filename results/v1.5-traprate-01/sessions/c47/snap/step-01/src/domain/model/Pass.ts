import type { AirportCode } from './AirportCode';
import type { LocalDate } from './LocalDate';

/** An airline status pass (any day, any partner lounge) or a day pass (one airport, one local day). */
export type Pass =
  | { readonly kind: 'airline'; readonly id: string; readonly holder: string; readonly airline: string }
  | { readonly kind: 'day'; readonly id: string; readonly holder: string; readonly airport: AirportCode; readonly validOn: LocalDate };
