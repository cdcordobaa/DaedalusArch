import type { ShelfdataClient, ShelfdataBinding, ShelfdataVolume } from 'shelfdata-sdk';
import type { Binding } from '../../../domain/model/Binding';
import type { CatalogueEntry } from '../../../domain/model/CatalogueEntry';
import type { Catalogue } from '../../../application/ports/out/catalogue/Catalogue';

export class ShelfdataCatalogueAdapter implements Catalogue {
  constructor(private readonly client: ShelfdataClient) {}

  async search(text: string): Promise<CatalogueEntry[]> {
    const found = await this.client.search({ title: text, max_results: 10 });
    return found.map((v: ShelfdataVolume) => (toEntry(v)));
  }

  async byIsbn(isbn: string): Promise<CatalogueEntry> {
    return toEntry(await this.client.lookupIsbn(isbn));
  }
}

function toEntry(v: ShelfdataVolume): CatalogueEntry {
  return { isbn: v.isbn_13, title: v.title_long, subtitle: v.subtitle, author: v.authors_display, year: v.pub_year, pages: v.page_count, binding: bindingOf(v.binding_code), coverUrl: v.cover_url_large };
}

function bindingOf(code: ShelfdataBinding): Binding {
  if (code === 'HC') return 'hardback';
  return code === 'PB' ? 'paperback' : 'other';
}
