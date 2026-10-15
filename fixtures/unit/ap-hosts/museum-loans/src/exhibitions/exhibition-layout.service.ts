import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExhibitionRecord } from '../persistence/entities/exhibition.entity';
import { PlacementRecord } from '../persistence/entities/placement.entity';
import { toExhibition } from '../persistence/mappers/exhibition.mapper';

export interface PlacementView {
  readonly artworkId: string;
  readonly wall: string;
  readonly position: number;
}

/** Hanging plan of an exhibition: which artwork goes on which wall, in visitor-route order. */
@Injectable()
export class ExhibitionLayoutService {
  constructor(
    @InjectRepository(PlacementRecord)
    private readonly placements: Repository<PlacementRecord>,
    @InjectRepository(ExhibitionRecord)
    private readonly exhibitions: Repository<ExhibitionRecord>,
  ) {}

  async place(exhibitionId: string, artworkId: string, wall: string, position: number): Promise<PlacementView> {
    if (position < 0) {
      throw new BadRequestException('Positions are counted from 0 along the visitor route');
    }
    if (!/^[A-Z]$/.test(wall)) {
      throw new BadRequestException('Walls are labelled with a single capital letter');
    }
    const exhibition = await this.exhibitions.findOne({ where: { id: exhibitionId } });
    if (exhibition === null) {
      throw new NotFoundException(`Exhibition ${exhibitionId} not found`);
    }
    if (!toExhibition(exhibition).isEditable()) {
      throw new ConflictException('The hanging plan of a running exhibition is frozen');
    }
    const taken = await this.placements.count({ where: { exhibitionId, wall, position } });
    if (taken > 0) {
      throw new ConflictException(`Wall ${wall} position ${String(position)} is already used`);
    }
    const saved = await this.placements.save(this.placements.create({ exhibitionId, artworkId, wall, position }));
    return { artworkId: saved.artworkId, wall: saved.wall, position: saved.position };
  }

  async plan(exhibitionId: string): Promise<PlacementView[]> {
    const rows = await this.placements.find({ where: { exhibitionId }, order: { wall: 'ASC', position: 'ASC' } });
    return rows.map((r) => ({ artworkId: r.artworkId, wall: r.wall, position: r.position }));
  }

  async remove(exhibitionId: string, artworkId: string): Promise<void> {
    const row = await this.placements.findOne({ where: { exhibitionId, artworkId } });
    if (row !== null) {
      await this.placements.remove(row);
    }
  }
}
