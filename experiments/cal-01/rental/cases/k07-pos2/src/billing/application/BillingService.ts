import { EventBus } from "../../shared-kernel/DomainEvent";
import { Money } from "../../shared-kernel/Money";
import { TransactionManager } from "../../shared-kernel/Transaction";
import { RentalReturned } from "../../rentals/contracts/RentalEvents";
import { Charge } from "../domain/charge/Charge";
import { ChargeRepository } from "./ChargeRepository";
import { PaymentGateway } from "./PaymentGateway";

export class BillingService {
  constructor(
    private readonly charges: ChargeRepository,
    private readonly gateway: PaymentGateway,
    private readonly tx: TransactionManager,
    private readonly bus: EventBus,
  ) {}

  async onRentalReturned(event: RentalReturned): Promise<void> {
    const charge = Charge.create(`charge-${event.rentalId}`, event.rentalId, Money.of(event.amountCents, event.currency));
    await this.tx.run(async () => {
      await this.charges.save(charge);
      await this.gateway.sendReceipt(charge.id);
    });
  }

  async settle(chargeId: string): Promise<void> {
    const charge = await this.requireCharge(chargeId);
    const receipt = await this.gateway.capture(charge.id, charge.amount);
    charge.settle(receipt);
    await this.tx.run(() => this.charges.save(charge));
    await this.bus.publish(charge.pullEvents());
  }

  private async requireCharge(id: string): Promise<Charge> {
    const charge = await this.charges.findById(id);
    if (!charge) throw new Error(`charge ${id} not found`);
    return charge;
  }
}
