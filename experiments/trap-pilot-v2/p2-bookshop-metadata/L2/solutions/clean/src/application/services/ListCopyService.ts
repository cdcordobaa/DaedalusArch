import type { Copy } from '../../domain/model/Copy';
import { ShopError } from '../../domain/errors/ShopError';
import { CopyRules } from '../../domain/services/CopyRules';
import type { CopyView, ListCopy, ListCopyRequest } from '../ports/in/ListCopy';
import type { Copies } from '../ports/out/Copies';
import type { Catalogue } from '../ports/out/Catalogue';

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
    const copy: Copy = { copyId: r.copyId, isbn, title: entry.title, author: entry.author, condition, price, year: entry.year, pages: entry.pages, binding: entry.binding };
    await this.copies.save(copy);
    return this.view(copy);
  }

  async find(copyId: string): Promise<CopyView> {
    const c = await this.copies.get(copyId);
    if (c === null) throw new ShopError('there is no copy ' + copyId);
    return this.view(c);
  }

  private view(c: Copy): CopyView {
    return { ...c };
  }
}
