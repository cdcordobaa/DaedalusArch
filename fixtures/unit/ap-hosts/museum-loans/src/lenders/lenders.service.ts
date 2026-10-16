import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LenderRecord } from '../persistence/entities/lender.entity';
import { LenderView, toLenderView } from './dto/lender.dto';

@Injectable()
export class LendersService {
  constructor(
    @InjectRepository(LenderRecord)
    private readonly lenders: Repository<LenderRecord>,
  ) {}

  async register(name: string, country: string, contactEmail: string, anonymous: boolean): Promise<LenderView> {
    if (!/^[A-Z]{2}$/.test(country)) {
      throw new BadRequestException('Country must be an ISO 3166-1 alpha-2 code');
    }
    if (!contactEmail.includes('@')) {
      throw new BadRequestException(`Invalid contact email ${contactEmail}`);
    }
    const existing = await this.lenders.count({ where: { name, country } });
    if (existing > 0) {
      throw new BadRequestException(`${name} (${country}) is already registered`);
    }
    return toLenderView(await this.lenders.save(this.lenders.create({ name, country, contactEmail, anonymous })));
  }

  async findOne(id: string): Promise<LenderView> {
    const record = await this.lenders.findOne({ where: { id } });
    if (record === null) {
      throw new NotFoundException(`Lender ${id} not found`);
    }
    return toLenderView(record);
  }

  async byCountry(country: string): Promise<LenderView[]> {
    return (await this.lenders.find({ where: { country }, order: { name: 'ASC' } })).map(toLenderView);
  }
}
