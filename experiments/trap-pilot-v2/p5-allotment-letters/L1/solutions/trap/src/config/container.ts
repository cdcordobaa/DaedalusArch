import { PostbirdClient } from 'postbird-sdk';
import { GardenController } from '../adapters/inbound/http/GardenController';
import { InMemoryApplicants } from '../adapters/outbound/memory/InMemoryApplicants';
import { InMemoryOffers } from '../adapters/outbound/memory/InMemoryOffers';
import { InMemoryNoticeboard } from '../adapters/outbound/memory/InMemoryNoticeboard';
import { PostbirdLettersAdapter } from '../adapters/outbound/postbird/PostbirdLettersAdapter';
import { JoinWaitingListService } from '../application/services/JoinWaitingListService';
import { OfferPlotService } from '../application/services/OfferPlotService';

/** Composition root. The Postbird key comes from POSTBIRD_API_KEY. */
export function createApp() {
  const postbird = new PostbirdClient({ apiKey: process.env.POSTBIRD_API_KEY ?? '' });
  const applicants = new InMemoryApplicants();
  const board = new InMemoryNoticeboard();
  const letters = new PostbirdLettersAdapter(postbird);
  const list = new JoinWaitingListService(applicants, letters);
  const offers = new OfferPlotService(applicants, new InMemoryOffers(), board);
  const http = new GardenController(list, offers);
  return {
    join: async (name: string, email: string) => (await http.postJoin({ name, email })).body,
    waitingList: async () => (await http.getList()).body,
    offerPlot: async (plotId: string) => (await http.postOffer(plotId)).body,
    leave: async (email: string) => (await http.postLeave(email)).body,
    noticeboard: () => board.lines(),
    http,
  };
}
