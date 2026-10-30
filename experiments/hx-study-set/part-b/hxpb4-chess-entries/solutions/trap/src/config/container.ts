import { RatingsDesk } from 'ratingsdesk-sdk';
import { makeRouter } from '../adapters/inbound/http/router';
import { InMemoryEntryRoster } from '../adapters/outbound/memory/InMemoryEntryRoster';
import { RatingsdeskLookup } from '../adapters/outbound/ratingsdesk/RatingsdeskLookup';
import { EntryService } from '../application/services/EntryService';

/** Composition root. The Ratingsdesk credentials come from RATINGSDESK_CLIENT_ID and RATINGSDESK_SECRET. */
export function createApp() {
  const desk = new RatingsDesk({ clientId: process.env.RATINGSDESK_CLIENT_ID ?? '', secret: process.env.RATINGSDESK_SECRET ?? '' });
  const route = makeRouter(new EntryService(new RatingsdeskLookup(desk), new InMemoryEntryRoster()));
  return {
    enterPlayer: (federationId: string, section: string) => route({ method: 'POST', path: '/entries', body: { federationId, section } }),
    roster: (section: string) => route({ method: 'GET', path: '/sections/' + section + '/entries' }),
    route,
  };
}
