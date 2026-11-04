import { Wordmarket } from 'wordmarket-sdk';
import { PortalController } from '../adapters/inbound/portal/PortalController';
import { InMemoryOrderBook } from '../adapters/outbound/memory/InMemoryOrderBook';
import { WordmarketPostingAdapter } from '../adapters/outbound/wordmarket/WordmarketPostingAdapter';
import { WordmarketLookupAdapter } from '../adapters/outbound/wordmarket/WordmarketLookupAdapter';
import { TranslationOrderService } from '../application/services/jobs/TranslationOrderService';
import { GlossaryService } from '../application/services/office/GlossaryService';
import { InMemoryGlossary } from '../adapters/outbound/memory/office/InMemoryGlossary';
import { CreditService } from '../application/services/office/CreditService';
import { InMemoryCreditLedger } from '../adapters/outbound/memory/office/InMemoryCreditLedger';
import { ClosingDayService } from '../application/services/office/ClosingDayService';
import { InMemoryClosingDays } from '../adapters/outbound/memory/office/InMemoryClosingDays';
import { StyleGuideService } from '../application/services/office/StyleGuideService';
import { InMemoryStyleGuides } from '../adapters/outbound/memory/office/InMemoryStyleGuides';

/** Composition root. The Wordmarket token comes from WORDMARKET_TOKEN. */
export function createApp() {
  const market = new Wordmarket({ apiToken: process.env.WORDMARKET_TOKEN ?? '' });
  const service = new TranslationOrderService(new InMemoryOrderBook(), new WordmarketPostingAdapter(market), new WordmarketLookupAdapter(market));
  const web = new PortalController(service);
  const office = {
    glossary: new GlossaryService(new InMemoryGlossary()),
    credit: new CreditService(new InMemoryCreditLedger()),
    closingDays: new ClosingDayService(new InMemoryClosingDays()),
    styleGuides: new StyleGuideService(new InMemoryStyleGuides()),
  };
  return {
    placeOrder: async (form: Record<string, unknown>) => (await web.order(form)).data,
    postToMarket: async (orderNo: string) => (await web.post(orderNo)).data,
    progress: async (orderNo: string) => (await web.progress(orderNo)).data,
    jobCard: async (orderNo: string) => (await web.card(orderNo)).data,
    office,
    web,
  };
}
