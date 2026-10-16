import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Clock, CLOCK } from '../shared/domain/clock';
import { AccessionNumber } from './domain/accession-number';
import { ArtworkRecord } from '../persistence/entities/artwork.entity';
import { ArtworkView, toArtworkView } from './dto/artwork.dto';

const LOCATION = /^(gallery|store|conservation|transit):[A-Za-z0-9-]+$/;

@Injectable()
export class ArtworksService {
  constructor(
    @InjectRepository(ArtworkRecord)
    private readonly artworks: Repository<ArtworkRecord>,
    @Inject(CLOCK)
    private readonly clock: Clock,
  ) {}

  async register(title: string, artist: string, year: number, medium: string, onLoan: boolean): Promise<ArtworkView> {
    if (title.trim().length === 0 || artist.trim().length === 0) {
      throw new BadRequestException('Title and artist are required (use "Unknown" for anonymous works)');
    }
    if (!Number.isInteger(year) || year < -3000) {
      throw new BadRequestException(`Implausible creation year ${String(year)}`);
    }
    const now = this.clock.now();
    if (year > now.getFullYear()) {
      throw new BadRequestException('A work cannot be dated in the future');
    }
    const sequence = await this.artworks.count();
    const accession = AccessionNumber.next(now.getFullYear(), sequence, onLoan);
    const record = this.artworks.create({ accessionNumber: accession.toString(), title, artist, year, medium, conditionGrade: 'good', location: 'store:intake' });
    return toArtworkView(await this.artworks.save(record));
  }

  async move(id: string, location: string): Promise<ArtworkView> {
    if (!LOCATION.test(location)) {
      throw new BadRequestException(`Locations look like gallery:E2-14 or store:B3; got ${location}`);
    }
    const record = await this.load(id);
    record.location = location;
    return toArtworkView(await this.artworks.save(record));
  }

  async findOne(id: string): Promise<ArtworkView> {
    return toArtworkView(await this.load(id));
  }

  async byArtist(artist: string): Promise<ArtworkView[]> {
    const records = await this.artworks.find({ where: { artist }, order: { year: 'ASC' } });
    return records.map(toArtworkView);
  }

  private async load(id: string): Promise<ArtworkRecord> {
    const record = await this.artworks.findOne({ where: { id } });
    if (record === null) {
      throw new NotFoundException(`Artwork ${id} not found`);
    }
    return record;
  }
}
