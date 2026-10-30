import { BookingController } from './adapters/in/http/booking.controller';
import { CargoLinkCarrierGateway } from './adapters/out/carrier/cargolink-carrier.gateway';
import { ConsoleShipperNotifier } from './adapters/out/notification/console-shipper-notifier';
import { InMemoryBookingRepository } from './adapters/out/persistence/in-memory-booking.repository';
import { BookShipmentUseCase } from './application/book-shipment.use-case';

const bookShipment = new BookShipmentUseCase(new InMemoryBookingRepository(), new CargoLinkCarrierGateway('demo-key'), new ConsoleShipperNotifier());
export const bookingController = new BookingController(bookShipment);
