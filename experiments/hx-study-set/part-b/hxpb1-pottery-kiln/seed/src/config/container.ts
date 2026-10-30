import { KilnwiseClient } from 'kilnwise-sdk';
import { PieceController } from '../adapters/inbound/http/PieceController';
import { InMemoryPieceShelf } from '../adapters/outbound/memory/InMemoryPieceShelf';
import { KilnwiseBookingsAdapter } from '../adapters/outbound/kilnwise/KilnwiseBookingsAdapter';
import { KilnwiseReadingsAdapter } from '../adapters/outbound/kilnwise/KilnwiseReadingsAdapter';
import { PieceService } from '../application/services/pieces/PieceService';
import { ClayStockService } from '../application/services/studio/ClayStockService';
import { InMemoryClayStock } from '../adapters/outbound/memory/studio/InMemoryClayStock';
import { PunchCardService } from '../application/services/studio/PunchCardService';
import { InMemoryPunchCards } from '../adapters/outbound/memory/studio/InMemoryPunchCards';
import { WetShelfService } from '../application/services/studio/WetShelfService';
import { InMemoryWetShelves } from '../adapters/outbound/memory/studio/InMemoryWetShelves';
import { GlazeRecipeService } from '../application/services/studio/GlazeRecipeService';
import { InMemoryGlazeRecipes } from '../adapters/outbound/memory/studio/InMemoryGlazeRecipes';

/** Composition root. The Kilnwise token comes from KILNWISE_TOKEN. */
export function createApp() {
  const kilnwise = new KilnwiseClient({ token: process.env.KILNWISE_TOKEN ?? '', studio: 'clay-corner' });
  const pieces = new PieceService(new InMemoryPieceShelf(), new KilnwiseBookingsAdapter(kilnwise), new KilnwiseReadingsAdapter(kilnwise));
  const http = new PieceController(pieces);
  return {
    dropOff: async (body: Record<string, unknown>) => (await http.postPiece(body)).json,
    loadKiln: async (firing: string, pieceIds: string[]) => (await http.postFiring({ firing, pieceIds })).json,
    pieceStatus: async (pieceId: string) => (await http.getPiece(pieceId)).json,
    kilnLog: async (pieceId: string) => (await http.getKilnLog(pieceId)).json,
    studio: {
      clay: new ClayStockService(new InMemoryClayStock()),
      punchCards: new PunchCardService(new InMemoryPunchCards()),
      wetShelves: new WetShelfService(new InMemoryWetShelves()),
      glazes: new GlazeRecipeService(new InMemoryGlazeRecipes()),
    },
    http,
  };
}
