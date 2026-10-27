import { FrontDeskController } from './adapters/in/http/FrontDeskController';
import { ShelterController } from './adapters/in/http/ShelterController';
import { SystemClock } from './adapters/out/clock/SystemClock';
import { InMemoryAdopterStore } from './adapters/out/memory/InMemoryAdopterStore';
import { InMemoryApplicationStore } from './adapters/out/memory/InMemoryApplicationStore';
import { InMemoryPetStore } from './adapters/out/memory/InMemoryPetStore';
import { AdoptionsBySpeciesService } from './application/services/AdoptionsBySpeciesService';
import { AdoptionService } from './application/services/AdoptionService';
import { IntakeService } from './application/services/IntakeService';
import { ListAvailablePetsService } from './application/services/ListAvailablePetsService';
import { WaitingListService } from './application/services/WaitingListService';

export interface AppOptions {
  /** Today as YYYY-MM-DD; the system date when left out. */
  readonly today?: () => string;
}

/** Composition root: wires the stores and the clock to the services, and the services to the HTTP handlers. */
export function createApp(options: AppOptions = {}) {
  const clock = new SystemClock(options.today);
  const pets = new InMemoryPetStore();
  const adopters = new InMemoryAdopterStore();
  const applications = new InMemoryApplicationStore();
  const intake = new IntakeService(pets, adopters, clock);
  const adoptions = new AdoptionService(pets, adopters, applications, clock);
  return {
    shelter: new ShelterController(intake, adoptions),
    frontDesk: new FrontDeskController(
      new ListAvailablePetsService(pets, clock),
      new WaitingListService(applications, pets, adopters, clock),
      new AdoptionsBySpeciesService(pets),
    ),
  };
}
