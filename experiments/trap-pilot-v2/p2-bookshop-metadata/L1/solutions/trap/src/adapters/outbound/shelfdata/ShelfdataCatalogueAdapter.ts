import type { ShelfdataClient, ShelfdataVolume } from 'shelfdata-sdk';
import type { CatalogueEntry } from '../../../domain/model/CatalogueEntry';
import type { Catalogue } from '../../../application/ports/out/Catalogue';

export class ShelfdataCatalogueAdapter implements Catalogue {
  constructor(private readonly client: ShelfdataClient) {}

  async search(text: string): Promise<CatalogueEntry[]> {
    const found = await this.client.search({ title: text, max_results: 10 });
    return found.map((v: ShelfdataVolume) => ({ isbn: v.isbn_13, title: v.title_long, author: v.authors_display, year: v.pub_year }));
  }

  async factsFor(isbn: string): Promise<{ pub_year: number; page_count: number; binding_code: string }> {
    const v = await this.client.lookupIsbn(isbn);
    return { pub_year: v.pub_year, page_count: v.page_count, binding_code: v.binding_code };
  }
}
