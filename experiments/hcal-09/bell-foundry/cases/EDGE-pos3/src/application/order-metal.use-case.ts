import sdk = require('ingotline-sdk');
import { CommissionNotFoundError } from '../domain/errors';
import { OrderMetalCommand, OrderMetalPort, OrderMetalResult } from './ports/in/order-metal.port';
import { AlloySupplierPort } from './ports/out/alloy-supplier.port';
import { CommissionRepositoryPort } from './ports/out/commission-repository.port';
import { ParishNotifierPort } from './ports/out/parish-notifier.port';

export class OrderMetalUseCase implements OrderMetalPort {
  constructor(
    private readonly commissions: CommissionRepositoryPort,
    private readonly supplier: AlloySupplierPort,
    private readonly notifier: ParishNotifierPort,
  ) {}

  async order(command: OrderMetalCommand): Promise<OrderMetalResult> {
    const commission = await this.commissions.findById(command.commissionId);
    if (commission === null) throw new CommissionNotFoundError(command.commissionId);
    let lot;
    try {
      lot = await this.supplier.order({ alloy: 'bell-bronze', massKg: commission.metalNeededKg });
    } catch (e) {
      if (e instanceof sdk.IngotlineError && e.code === 'IL_SHORTAGE') return { commissionId: commission.id, status: commission.currentStatus };
      throw e;
    }
    commission.orderMetal(lot);
    await this.commissions.save(commission);
    await this.notifier.notify(commission.parishId, commission.id, commission.currentStatus);
    return { commissionId: commission.id, status: commission.currentStatus };
  }
}
