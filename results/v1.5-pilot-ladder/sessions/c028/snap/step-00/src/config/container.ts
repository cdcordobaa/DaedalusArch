import { ShelfdataClient } from 'shelfdata-sdk';
import { ShopController } from '../adapters/inbound/http/ShopController';
import { InMemoryCopies } from '../adapters/outbound/memory/InMemoryCopies';
import { ShelfdataCatalogueAdapter } from '../adapters/outbound/shelfdata/ShelfdataCatalogueAdapter';
import { ListCopyService } from '../application/services/shelves/ListCopyService';
import { SearchTitlesService } from '../application/services/shelves/SearchTitlesService';
import { StaffNoteService } from '../application/services/admin/StaffNoteService';
import { InMemoryStaffNoteStore } from '../adapters/outbound/memory/admin/InMemoryStaffNoteStore';
import { BuyingVisitService } from '../application/services/admin/BuyingVisitService';
import { InMemoryBuyingVisitStore } from '../adapters/outbound/memory/admin/InMemoryBuyingVisitStore';
import { ShelfCountService } from '../application/services/admin/ShelfCountService';
import { InMemoryShelfCountStore } from '../adapters/outbound/memory/admin/InMemoryShelfCountStore';
import { CustomerWishService } from '../application/services/admin/CustomerWishService';
import { InMemoryCustomerWishStore } from '../adapters/outbound/memory/admin/InMemoryCustomerWishStore';

/** Composition root. The Shelfdata key comes from SHELFDATA_API_KEY. */
export function createApp() {
  const shelfdata = new ShelfdataClient({ apiKey: process.env.SHELFDATA_API_KEY ?? '' });
  const catalogue = new ShelfdataCatalogueAdapter(shelfdata);
  const copies = new ListCopyService(new InMemoryCopies(), catalogue);
  const http = new ShopController(copies, new SearchTitlesService(catalogue));
  const staffNote = new StaffNoteService(new InMemoryStaffNoteStore());
  const buyingVisit = new BuyingVisitService(new InMemoryBuyingVisitStore());
  const shelfCount = new ShelfCountService(new InMemoryShelfCountStore());
  const customerWish = new CustomerWishService(new InMemoryCustomerWishStore());
  return {
    listCopy: async (body: Record<string, unknown>) => (await http.postCopy(body)).body,
    getCopy: async (copyId: string) => (await http.getCopy(copyId)).body,
    searchTitles: async (q: string) => (await http.getTitles(q)).body,
    admin: { staffNote, buyingVisit, shelfCount, customerWish },
    http,
  };
}
