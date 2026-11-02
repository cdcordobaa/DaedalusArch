import { CovernestClient } from 'covernest-sdk';
import { WharfController } from '../adapters/inbound/http/WharfController';
import { InMemoryHires } from '../adapters/outbound/memory/InMemoryHires';
import { CovernestQuotesAdapter } from '../adapters/outbound/covernest/CovernestQuotesAdapter';
import { CovernestHistoryAdapter } from '../adapters/outbound/covernest/CovernestHistoryAdapter';
import { CovernestPoliciesAdapter } from '../adapters/outbound/covernest/CovernestPoliciesAdapter';
import { HireService } from '../application/services/HireService';
import { QuoteLineService } from '../application/services/QuoteLineService';
import { HirerCheckService } from '../application/services/HirerCheckService';

/** Composition root. Covernest credentials come from COVERNEST_PARTNER_ID and COVERNEST_SECRET. The returned object is the app. */
export function createApp() {
  const covernest = new CovernestClient({ partnerId: process.env.COVERNEST_PARTNER_ID ?? '', secret: process.env.COVERNEST_SECRET ?? '' });
  const quotes = new CovernestQuotesAdapter(covernest);
  const hires = new HireService(new InMemoryHires(), quotes, new CovernestPoliciesAdapter(covernest));
  const http = new WharfController(hires, new QuoteLineService(quotes), new HirerCheckService(new CovernestHistoryAdapter(covernest)));
  return {
    reserve: async (hireId: string, boatId: string, from: string, nights: number, hirerRef: string, quoteRef: string) => (await http.postHire({ hireId, boatId, from, nights, hirerRef, quoteRef })).body,
    handOver: async (hireId: string) => (await http.postHandOver(hireId)).body,
    bringBack: async (hireId: string) => (await http.postReturn(hireId)).body,
    quoteLine: async (quoteRef: string) => (await http.getQuoteLine(quoteRef)).body,
    checkHirer: async (hirerRef: string) => (await http.getHirer(hirerRef)).body,
    http,
  };
}
