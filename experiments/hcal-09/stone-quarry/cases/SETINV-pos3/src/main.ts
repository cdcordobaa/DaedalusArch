import { BlastController } from './extraction/api/BlastController';
import { BlastService } from './extraction/application/BlastService';
import { Bench } from './extraction/domain/bench/Bench';
import { InMemoryBenchRepository } from './extraction/infrastructure/InMemoryBenchRepository';
import { InMemoryBlastRepository } from './extraction/infrastructure/InMemoryBlastRepository';
import { HaulController } from './haulage/api/HaulController';
import { HaulService } from './haulage/application/HaulService';
import { Truck } from './haulage/domain/truck/Truck';
import { InMemoryHaulRepository } from './haulage/infrastructure/InMemoryHaulRepository';
import { InMemoryTruckRepository } from './haulage/infrastructure/InMemoryTruckRepository';
import { TarescaleScale } from './haulage/infrastructure/TarescaleScale';
import { OrderController } from './sales/api/OrderController';
import { subscribeOrderHandlers } from './sales/application/OrderEventHandlers';
import { OrderService } from './sales/application/OrderService';
import { InMemoryOrderRepository } from './sales/infrastructure/InMemoryOrderRepository';
import { EventBus } from './shared-kernel/EventBus';

const bus = new EventBus();

const benches = new InMemoryBenchRepository([new Bench('B-NORTH-3', 'north face, level 3', 60000), new Bench('B-EAST-1', 'east face, level 1', 25000)]);
const blastService = new BlastService(benches, new InMemoryBlastRepository(benches));

const trucks = new InMemoryTruckRepository([new Truck('T-07', 'QY-7071', 180), new Truck('T-11', 'QY-1132', 240)]);
const haulService = new HaulService(trucks, new InMemoryHaulRepository(), new TarescaleScale('site-hollow-ridge'), bus);

const orderService = new OrderService(new InMemoryOrderRepository());
subscribeOrderHandlers(bus, orderService);

export const blastController = new BlastController(blastService);
export const haulController = new HaulController(haulService);
export const orderController = new OrderController(orderService);
