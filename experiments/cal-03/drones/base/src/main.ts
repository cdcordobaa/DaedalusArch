import { EventBus } from './shared-kernel/EventBus';
import { InMemoryUnitOfWork } from './shared-kernel/UnitOfWork';
import {
  EmailClientNotifier,
  InMemorySurveyRepository,
  SurveyController,
  SurveyService,
  registerSurveyHandlers,
} from './surveys/index';
import {
  DroneController,
  DroneService,
  InMemoryDroneRepository,
  InMemoryPilotRepository,
  PilotController,
  PilotService,
} from './pilots/index';
import {
  CaaAirspaceAuthority,
  InMemoryPermitRepository,
  PermitController,
  PermitService,
  registerPermitHandlers,
} from './permits/index';

const bus = new EventBus();
const uow = new InMemoryUnitOfWork();

const surveyService = new SurveyService(new InMemorySurveyRepository(), bus, new EmailClientNotifier(), uow);
const pilotService = new PilotService(new InMemoryPilotRepository(), bus);
const droneService = new DroneService(new InMemoryDroneRepository());
const permitService = new PermitService(new InMemoryPermitRepository(), new CaaAirspaceAuthority(), bus, uow);

registerSurveyHandlers(bus, surveyService);
registerPermitHandlers(bus, permitService);

export const surveyController = new SurveyController(surveyService);
export const pilotController = new PilotController(pilotService);
export const droneController = new DroneController(droneService);
export const permitController = new PermitController(permitService);
