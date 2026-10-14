import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InvoiceEntity } from './invoice.entity';

@Injectable()
export class InvoiceService {
  constructor(
    @InjectRepository(InvoiceEntity)
    private readonly invoiceRepository: Repository<InvoiceEntity>,
  ) {}

  async issue(orderId: string, amount: number): Promise<InvoiceEntity> {
    const invoice = this.invoiceRepository.create({ orderId, amount });
    return this.invoiceRepository.save(invoice);
  }

  countFor(orderId: string): Promise<number> {
    return this.invoiceRepository.count({ where: { orderId } });
  }
}
