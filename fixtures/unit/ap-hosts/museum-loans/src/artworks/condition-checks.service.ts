import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Artwork } from './domain/artwork';
import { isConditionGrade, InvalidConditionGradeError } from './domain/condition-grade';
import { ArtworkRecord } from '../persistence/entities/artwork.entity';
import { ConditionCheckRecord } from '../persistence/entities/condition-check.entity';

export interface ConditionCheckView {
  readonly grade: string;
  readonly inspector: string;
  readonly notes: string;
  readonly checkedAt: string;
  readonly deteriorated: boolean;
}

/** Condition reports written by the registrar at intake, before hanging and at the end of a loan. */
@Injectable()
export class ConditionChecksService {
  constructor(
    @InjectRepository(ConditionCheckRecord)
    private readonly checks: Repository<ConditionCheckRecord>,
    @InjectRepository(ArtworkRecord)
    private readonly artworks: Repository<ArtworkRecord>,
  ) {}

  async record(artworkId: string, grade: string, inspector: string, notes: string): Promise<ConditionCheckView> {
    if (!isConditionGrade(grade)) {
      throw new InvalidConditionGradeError(grade);
    }
    if (inspector.trim().length === 0) {
      throw new BadRequestException('A condition report must name its inspector');
    }
    if (grade === 'poor' && notes.trim().length < 20) {
      throw new BadRequestException('A "poor" grade needs a description of the damage (20 characters or more)');
    }
    const row = await this.artworks.findOne({ where: { id: artworkId } });
    if (row === null) {
      throw new NotFoundException(`Artwork ${artworkId} not found`);
    }
    const artwork = new Artwork(row.id, row.accessionNumber, row.title, row.artist, row.conditionGrade, row.location);
    const { deteriorated } = artwork.regrade(grade);
    row.conditionGrade = artwork.conditionGrade;
    await this.artworks.save(row);
    const saved = await this.checks.save(this.checks.create({ artworkId, grade, inspector, notes }));
    return { grade: saved.grade, inspector: saved.inspector, notes: saved.notes, checkedAt: saved.checkedAt.toISOString(), deteriorated };
  }

  async history(artworkId: string): Promise<ConditionCheckView[]> {
    const rows = await this.checks.find({ where: { artworkId }, order: { checkedAt: 'ASC' } });
    return rows.map((r, i) => ({
      grade: r.grade,
      inspector: r.inspector,
      notes: r.notes,
      checkedAt: r.checkedAt.toISOString(),
      deteriorated: i > 0 && rows[i - 1]?.grade !== r.grade,
    }));
  }
}
