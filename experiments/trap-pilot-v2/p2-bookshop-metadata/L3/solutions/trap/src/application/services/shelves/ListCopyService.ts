import type { Copy } from '../../../domain/model/Copy';
import { ShopError } from '../../../domain/errors/ShopError';
import { CopyRules } from '../../../domain/services/CopyRules';
import type { CopyView, ListCopy, ListCopyRequest } from '../../ports/in/ListCopy';
import type { Copies } from '../../ports/out/storage/Copies';
import type { Catalogue } from '../../ports/out/catalogue/Catalogue';

export class ListCopyService implements ListCopy {
  constructor(
    private readonly copies: Copies,
    private readonly catalogue: Catalogue,
    private readonly rules: CopyRules = new CopyRules(),
  ) {}

  async list(r: ListCopyRequest): Promise<CopyView> {
    const isbn = this.rules.isbn(r.isbn);
    const condition = this.rules.condition(r.condition);
    const price = this.rules.price(r.price);
    const entry = await this.catalogue.byIsbn(isbn);
    const copy: Copy = { copyId: r.copyId, isbn, title: entry.title, author: entry.author, condition, price, pub_year: entry.year, page_count: entry.page_count, binding_code: entry.binding_code, cover_url_large: entry.cover_url_large };
    await this.copies.save(copy);
    return this.view(copy);
  }

  async find(copyId: string): Promise<CopyView> {
    const c = await this.copies.get(copyId);
    if (c === null) throw new ShopError('there is no copy ' + copyId);
    return this.view(c);
  }

  private view(c: Copy): CopyView {
    return { ...c, binding: c.binding_code === 'HC' ? 'hardback' : c.binding_code === 'PB' ? 'paperback' : 'other' };
  }
}
