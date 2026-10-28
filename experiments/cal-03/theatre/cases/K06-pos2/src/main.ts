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

const productions = new ProductionService(productionRepository, bus, new HttpTicketingGateway(), uow);
const casting = new CastingService(bookingRepository, new InMemoryActorRepository(), bus, new CalendarAvailabilityAdapter(), uow);
const rehearsals = new RehearsalService(roomRepository);

bus.subscribe<CastBookingConfirmedEvent>('CastBookingConfirmed', (event) =>
  productions.addCast(event.productionId, event.actorId),
);
bus.subscribe<ProductionOpenedEvent>('ProductionOpened', (event) => rehearsals.reserveFor(event));

const openAndReserve = async (productionId: string): Promise<void> => {
  const production = await productionRepository.findById(productionId);
  if (!production) {
    throw new Error('production not found');
  }
  production.open();
  const room = await roomRepository.findById(production.rehearsalRoomId);
  if (!room) {
    throw new Error('room not found');
  }
  room.book(production.id, production.firstShowAt - 3600000, production.firstShowAt);
  await productionRepository.save(production);
  await roomRepository.save(room);
};

export const app = {
  productions: new ProductionController(productions),
  casting: new CastingController(casting),
  rehearsals: new RehearsalController(rehearsals),
  openAndReserve,
};
