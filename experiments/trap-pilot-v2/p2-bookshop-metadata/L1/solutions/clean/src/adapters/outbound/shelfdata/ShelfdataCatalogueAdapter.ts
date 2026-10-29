import type { ShelfdataClient, ShelfdataBinding, ShelfdataVolume } from 'shelfdata-sdk';
import type { Binding } from '../../../domain/model/Binding';
import type { BookFacts } from '../../../domain/model/BookFacts';
import type { CatalogueEntry } from '../../../domain/model/CatalogueEntry';
import type { Catalogue } from '../../../application/ports/out/Catalogue';

export class ShelfdataCatalogueAdapter implements Catalogue {
  constructor(private readonly client: ShelfdataClient) {}

  async search(text: string): Promise<CatalogueEntry[]> {
    const found = await this.client.search({ title: text, max_results: 10 });
    return found.map((v: ShelfdataVolume) => ({ isbn: v.isbn_13, title: v.title_long, author: v.authors_display, year: v.pub_year }));
  }

  async factsFor(isbn: string): Promise<BookFacts> {
    const v = await this.client.lookupIsbn(isbn);
    return { year: v.pub_year, pages: v.page_count, binding: bindingOf(v.binding_code) };
  }
}

function bindingOf(code: ShelfdataBinding): Binding {
  if (code === 'HC') return 'hardback';
  return code === 'PB' ? 'paperback' : 'other';
}
