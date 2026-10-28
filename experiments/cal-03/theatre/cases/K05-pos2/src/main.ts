import { CastingController } from './casting/api/CastingController';
import { CastingService } from './casting/application/CastingService';
import type { CastBookingConfirmedEvent } from './casting';
import { CalendarAvailabilityAdapter } from './casting/infrastructure/CalendarAvailabilityAdapter';
import { InMemoryActorRepository } from './casting/infrastructure/InMemoryActorRepository';
import { InMemoryCastBookingRepository } from './casting/infrastructure/InMemoryCastBookingRepository';
import { ProductionController } from './productions/api/ProductionController';
import { ProductionService } from './productions/application/ProductionService';
import type { ProductionOpenedEvent } from './productions';
import { HttpTicketingGateway } from './productions/infrastructure/HttpTicketingGateway';
import { InMemoryProductionRepository } from './productions/infrastructure/InMemoryProductionRepository';
import { RehearsalController } from './rehearsals/api/RehearsalController';
import { RehearsalService } from './rehearsals/application/RehearsalService';
import { InMemoryRehearsalRoomRepository } from './rehearsals/infrastructure/InMemoryRehearsalRoomRepository';
import { EventBus } from './shared-kernel/EventBus';
import { InMemoryUnitOfWork } from './shared-kernel/InMemoryUnitOfWork';

const bus = new EventBus();
const uow = new InMemoryUnitOfWork();

const productionRepository = new InMemoryProductionRepository();
const bookingRepository = new InMemoryCastBookingRepository();
const roomRepository = new InMemoryRehearsalRoomRepository();

const rehearsals = new RehearsalService(roomRepository);
const productions = new ProductionService(productionRepository, bus, new HttpTicketingGateway(), uow, rehearsals);
const casting = new CastingService(bookingRepository, new InMemoryActorRepository(), bus, new CalendarAvailabilityAdapter(), uow);

bus.subscribe<CastBookingConfirmedEvent>('CastBookingConfirmed', (event) =>
  productions.addCast(event.productionId, event.actorId),
);
bus.subscribe<ProductionOpenedEvent>('ProductionOpened', (event) => rehearsals.reserveFor(event));

export const app = {
  productions: new ProductionController(productions),
  casting: new CastingController(casting),
  rehearsals: new RehearsalController(rehearsals),
};
