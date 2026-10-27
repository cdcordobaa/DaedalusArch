import { InMemoryEventBus } from "./shared-kernel/DomainEvent";
import { InMemoryTransactionManager } from "./shared-kernel/Transaction";
import { CatalogService, InMemoryEquipmentRepository } from "./catalog";
import { CatalogAcl, InMemoryRentalRepository, RentalService, RentalOpened, RentalReturned } from "./rentals";
import { BillingService, FakePaymentGateway, InMemoryChargeRepository } from "./billing";

export function createApp() {
  const bus = new InMemoryEventBus();
  const tx = new InMemoryTransactionManager();

  const catalog = new CatalogService(new InMemoryEquipmentRepository(), bus);
  const rentals = new RentalService(new InMemoryRentalRepository(), new CatalogAcl(catalog), bus);
  const billing = new BillingService(new InMemoryChargeRepository(), new FakePaymentGateway(), tx, bus);

  bus.subscribe<RentalOpened>("RentalOpened", (e) => catalog.onRentalOpened(e));
  bus.subscribe<RentalReturned>("RentalReturned", (e) => catalog.onRentalReturned(e));
  bus.subscribe<RentalReturned>("RentalReturned", (e) => billing.onRentalReturned(e));

  async function openRentalAndMarkRented(cmd: Parameters<RentalService["open"]>[0]): Promise<void> {
    await rentals.open(cmd);
    await catalog.markRented(cmd.equipmentId);
  }

  return { bus, catalog, rentals, billing, openRentalAndMarkRented };
}
