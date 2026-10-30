import { ShelfdataNotFound } from 'shelfdata-sdk';
import type { ShelfdataBinding, ShelfdataClient, ShelfdataVolume } from 'shelfdata-sdk';
import type { Binding, CatalogueEntry, Edition } from '../../../domain/model/CatalogueEntry';
import type { Catalogue } from '../../../application/ports/out/Catalogue';

function toBinding(code: ShelfdataBinding): Binding {
  if (code === 'HC') return 'hardback';
  if (code === 'PB') return 'paperback';
  return 'other';
}

export class ShelfdataCatalogueAdapter implements Catalogue {
  constructor(private readonly client: ShelfdataClient) {}

  async search(text: string): Promise<CatalogueEntry[]> {
    const found = await this.client.search({ title: text, max_results: 10 });
    return found.map((v: ShelfdataVolume) => ({ isbn: v.isbn_13, title: v.title_long, author: v.authors_display, year: v.pub_year }));
  }

  async edition(isbn: string): Promise<Edition | null> {
    try {
      const v = await this.client.lookupIsbn(isbn);
      return { year: v.pub_year, pages: v.page_count, binding: toBinding(v.binding_code) };
    } catch (e) {
      if (e instanceof ShelfdataNotFound) return null;
      throw e;
    }
  }
}
