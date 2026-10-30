import type { ShelfdataBinding, ShelfdataClient, ShelfdataVolume } from 'shelfdata-sdk';
import type { Binding, CatalogueEntry } from '../../../domain/model/CatalogueEntry';
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
  return { ...v, isbn: v.isbn_13, title: v.title_long, subtitle: v.subtitle, author: v.authors_display, year: v.pub_year, pageCount: v.page_count, binding: toBinding(v.binding_code) };
}

function toBinding(code: ShelfdataBinding): Binding {
  if (code === 'HC') return 'hardback';
  if (code === 'PB') return 'paperback';
  return 'other';
}
