import { Inject, Injectable } from '@nestjs/common';
import { DomainError } from '../domain/domain-error';
import { Workshop } from '../domain/workshop';
import { WORKSHOP_REPOSITORY, WorkshopRepository } from '../domain/workshop-repository';
import { CreateWorkshopDto } from './dto/create-workshop.dto';
import { WorkshopResponseDto } from './dto/workshop-response.dto';

@Injectable()
export class WorkshopsService {
  private sequence = 0;

  constructor(@Inject(WORKSHOP_REPOSITORY) private readonly workshops: WorkshopRepository) {}

  async create(dto: CreateWorkshopDto): Promise<WorkshopResponseDto> {
    this.sequence += 1;
    const workshop = new Workshop(`ws-${this.sequence}`, dto.title, dto.capacity, new Date(dto.startsAt));
    await this.workshops.save(workshop);
    return WorkshopResponseDto.from(workshop);
  }

  async findAll(): Promise<WorkshopResponseDto[]> {
    return (await this.workshops.findAll()).map((w) => WorkshopResponseDto.from(w));
  }

  async findOne(id: string): Promise<WorkshopResponseDto> {
    const workshop = await this.workshops.findById(id);
    if (workshop === undefined) throw new DomainError('not-found', `No workshop ${id}`);
    return WorkshopResponseDto.from(workshop);
  }
}
