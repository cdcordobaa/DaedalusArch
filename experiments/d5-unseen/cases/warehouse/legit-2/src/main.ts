import { LoadingService } from './storage/application/LoadingService';
import { InMemoryPalletRepository } from './storage/infrastructure/InMemoryPalletRepository';

export const loading = new LoadingService(new InMemoryPalletRepository());
