import { OrderRoutes } from './orders/../OrderRoutes';
import { health } from './health/health';

export const routesOf = (r: OrderRoutes): unknown[] => [r, health];
