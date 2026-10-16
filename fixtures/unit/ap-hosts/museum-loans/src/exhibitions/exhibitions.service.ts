import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { Clock, CLOCK } from '../shared/domain/clock';
import { DateRange } from '../shared/domain/date-range';
import { GalleryCapacity, isGalleryCode } from './domain/gallery';
import { ExhibitionRecord } from '../persistence/entities/exhibition.entity';
import { applyExhibition, toExhibition } from '../persistence/mappers/exhibition.mapper';
import { ExhibitionView, toExhibitionView } from './dto/exhibition.dto';

@Injectable()
export class ExhibitionsService {
  constructor(
    @InjectRepository(ExhibitionRecord)
    private readonly exhibitions: Repository<ExhibitionRecord>,
    @Inject(CLOCK)
    private readonly clock: Clock,
  ) {}

  async schedule(title: string, galleryCode: string, opensOn: string, closesOn: string, capacity: number): Promise<ExhibitionView> {
    if (title.trim().length === 0) {
      throw new BadRequestException('An exhibition needs a title');
    }
    if (!isGalleryCode(galleryCode)) {
      throw new BadRequestException(`Unknown gallery code ${galleryCode}`);
    }
    if (capacity < 1 || capacity > GalleryCapacity.FIRE_CODE_LIMIT) {
      throw new BadRequestException(`Capacity must be between 1 and ${String(GalleryCapacity.FIRE_CODE_LIMIT)} visitors`);
    }
    const record = this.exhibitions.create({ title: title.trim(), galleryCode, opensOn, closesOn, capacity, status: 'planned' });
    const planned = toExhibition(record);
    for (const other of await this.exhibitions.find({ where: { galleryCode } })) {
      planned.ensureNoClashWith(toExhibition(other));
    }
    return toExhibitionView(await this.exhibitions.save(record));
  }

  async reschedule(id: string, opensOn: string, closesOn: string): Promise<ExhibitionView> {
    if (Date.parse(closesOn) <= Date.parse(opensOn)) {
      throw new BadRequestException('The closing date must follow the opening date');
    }
    const record = await this.load(id);
    const exhibition = toExhibition(record);
    exhibition.reschedule(DateRange.parse(opensOn, closesOn));
    for (const other of await this.exhibitions.find({ where: { galleryCode: record.galleryCode } })) {
      exhibition.ensureNoClashWith(toExhibition(other));
    }
    return toExhibitionView(await this.exhibitions.save(applyExhibition(record, exhibition)));
  }

  async changeCapacity(id: string, capacity: number): Promise<ExhibitionView> {
    if (!Number.isInteger(capacity) || capacity < 1) {
      throw new BadRequestException('Capacity must be a positive whole number of visitors');
    }
    const record = await this.load(id);
    record.capacity = new GalleryCapacity(capacity).visitors;
    return toExhibitionView(await this.exhibitions.save(record));
  }

  async findOne(id: string): Promise<ExhibitionView> {
    return toExhibitionView(await this.load(id));
  }

  async upcoming(limit: number): Promise<ExhibitionView[]> {
    if (limit < 1 || limit > 100) {
      throw new BadRequestException('limit must be between 1 and 100');
    }
    const today = this.clock.now().toISOString().slice(0, 10);
    const records = await this.exhibitions.find({ where: { opensOn: MoreThanOrEqual(today) }, order: { opensOn: 'ASC' }, take: limit });
    return records.map(toExhibitionView);
  }

  private async load(id: string): Promise<ExhibitionRecord> {
    const record = await this.exhibitions.findOne({ where: { id } });
    if (record === null) {
      throw new NotFoundException(`Exhibition ${id} not found`);
    }
    return record;
  }
}
