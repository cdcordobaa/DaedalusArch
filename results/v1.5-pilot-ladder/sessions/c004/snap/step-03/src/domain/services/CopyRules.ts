import { ShopError } from '../errors/ShopError';
import type { Copy } from '../model/Copy';

/** What a copy must look like before it goes on a shelf. */
export class CopyRules {
  isbn(raw: string): string {
    const isbn = raw.replace(/[- ]/g, '');
    if (!/^97[89]\d{10}$/.test(isbn)) throw new ShopError('an ISBN has 13 digits and starts with 978 or 979');
    return isbn;
  }

  condition(raw: string): Copy['condition'] {
    if (raw !== 'as new' && raw !== 'good' && raw !== 'worn') throw new ShopError('condition is as new, good or worn');
    return raw;
  }

  price(euros: number): number {
    const price = Math.round(euros * 100) / 100;
    if (!(price >= 2)) throw new ShopError('A copy costs at least 2 euros.');
    return price;
  }
}
