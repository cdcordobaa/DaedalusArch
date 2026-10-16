export const UNSORTED = 'unsorted';

export interface DonatedProduct {
  productCode: string;
  name: string;
  quantity: number;
  bestBefore: string;
}

export function donationKey(feedDate: string, p: DonatedProduct): string {
  return `${feedDate}|${p.productCode}|${p.bestBefore}`;
}
