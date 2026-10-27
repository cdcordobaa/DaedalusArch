import { PutAwayService } from './storage/application/PutAwayService';
import { PutAwayHandler } from './storage/infrastructure/messaging/PutAwayHandler';
import { InMemoryBinRepository, InMemoryPalletRepository } from './storage/infrastructure/InMemoryWarehouseRepository';

const bins = new InMemoryBinRepository();
const service = new PutAwayService(bins, new InMemoryPalletRepository());
export const handler = new PutAwayHandler(service, bins);
