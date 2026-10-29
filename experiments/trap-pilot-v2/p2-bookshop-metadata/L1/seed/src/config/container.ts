import { ShelfdataClient } from 'shelfdata-sdk';
import { ShopController } from '../adapters/inbound/http/ShopController';
import { InMemoryCopies } from '../adapters/outbound/memory/InMemoryCopies';
import { ShelfdataCatalogueAdapter } from '../adapters/outbound/shelfdata/ShelfdataCatalogueAdapter';
import { ListCopyService } from '../application/services/ListCopyService';
import { SearchTitlesService } from '../application/services/SearchTitlesService';

/** Composition root. The Shelfdata key comes from SHELFDATA_API_KEY. */
export function createApp() {
  const shelfdata = new ShelfdataClient({ apiKey: process.env.SHELFDATA_API_KEY ?? '' });
  const catalogue = new ShelfdataCatalogueAdapter(shelfdata);
  const copies = new ListCopyService(new InMemoryCopies());
  const http = new ShopController(copies, new SearchTitlesService(catalogue));
  return {
    listCopy: async (body: Record<string, unknown>) => (await http.postCopy(body)).body,
    getCopy: async (copyId: string) => (await http.getCopy(copyId)).body,
    searchTitles: async (q: string) => (await http.getTitles(q)).body,
    http,
  };
}
