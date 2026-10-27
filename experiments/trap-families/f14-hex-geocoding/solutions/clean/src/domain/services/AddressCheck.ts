import type { AddressMatch } from '../model/AddressMatch';
import type { DeliveryAddress } from '../model/DeliveryAddress';

const MIN_CONFIDENCE = 0.8;

export type AddressVerdict = { readonly accepted: true; readonly match: AddressMatch } | { readonly accepted: false; readonly reason: string };

/** Whether the best match is precise and sure enough to drive to, and if not, what the customer should fix. */
export class AddressCheck {
  verdict(address: DeliveryAddress, matches: readonly AddressMatch[]): AddressVerdict {
    const best = matches[0];
    if (best === undefined) return { accepted: false, reason: 'We could not find this address.' };
    if (best.country !== address.country) return { accepted: false, reason: 'This address is in another country.' };
    if (best.level === 'area') return { accepted: false, reason: 'Please add your street and house number.' };
    if (best.confidence < MIN_CONFIDENCE) return { accepted: false, reason: 'We could not find this address.' };
    return { accepted: true, match: best };
  }
}
