import { PostbirdClient } from 'postbird-sdk';
import { GardenController } from '../adapters/inbound/http/GardenController';
import { InMemoryApplicants } from '../adapters/outbound/memory/InMemoryApplicants';
import { InMemoryOffers } from '../adapters/outbound/memory/InMemoryOffers';
import { InMemoryNoticeboard } from '../adapters/outbound/memory/InMemoryNoticeboard';
import { PostbirdNewsletterAdapter } from '../adapters/outbound/postbird/PostbirdNewsletterAdapter';
import { PostbirdOfferLettersAdapter } from '../adapters/outbound/postbird/PostbirdOfferLettersAdapter';
import { JoinWaitingListService } from '../application/services/JoinWaitingListService';
import { OfferPlotService } from '../application/services/OfferPlotService';
import { NewsletterService } from '../application/services/NewsletterService';

/** Composition root. The Postbird key comes from POSTBIRD_API_KEY. */
export function createApp() {
  const postbird = new PostbirdClient({ apiKey: process.env.POSTBIRD_API_KEY ?? '' });
  const applicants = new InMemoryApplicants();
  const board = new InMemoryNoticeboard();
  const list = new JoinWaitingListService(applicants);
  const offers = new OfferPlotService(applicants, new InMemoryOffers(), board, new PostbirdOfferLettersAdapter(postbird));
  const http = new GardenController(list, offers, new NewsletterService(new PostbirdNewsletterAdapter(postbird)));
  return {
    join: async (name: string, email: string) => (await http.postJoin({ name, email })).body,
    waitingList: async () => (await http.getList()).body,
    offerPlot: async (plotId: string) => (await http.postOffer(plotId)).body,
    leave: async (email: string) => (await http.postLeave(email)).body,
    publishNewsletter: async (subject: string, text: string) => (await http.postNewsletter(subject, text)).body,
    noticeboard: () => board.lines(),
    http,
  };
}
