import { PresslineClient } from 'pressline-sdk';
import { WardrobeController } from '../adapters/inbound/http/WardrobeController';
import { InMemoryWardrobe } from '../adapters/outbound/memory/InMemoryWardrobe';
import { InMemoryCostumeHires } from '../adapters/outbound/memory/InMemoryCostumeHires';
import { PresslineCleanersAdapter } from '../adapters/outbound/pressline/PresslineCleanersAdapter';
import { CostumeHireService } from '../application/services/CostumeHireService';

/** Composition root. The Pressline key comes from PRESSLINE_API_KEY; our shop there is THEATRE-ROYAL. The returned object is the app. */
export function createApp() {
  const pressline = new PresslineClient({ apiKey: process.env.PRESSLINE_API_KEY ?? '', shop: 'THEATRE-ROYAL' });
  const http = new WardrobeController(new CostumeHireService(new InMemoryWardrobe(), new InMemoryCostumeHires(), new PresslineCleanersAdapter(pressline)));
  return {
    hire: async (hireId: string, costumeId: string, from: string, days: number) => (await http.postHire({ hireId, costumeId, from, days })).body,
    returnCostume: async (hireId: string, returnedOn: string) => (await http.postReturn(hireId, { returnedOn })).body,
    http,
  };
}
