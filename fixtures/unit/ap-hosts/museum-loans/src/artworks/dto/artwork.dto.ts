import { ArtworkRecord } from '../../persistence/entities/artwork.entity';

export class RegisterArtworkDto {
  title!: string;
  artist!: string;
  year!: number;
  medium!: string;
  onLoan!: boolean;
}

export class MoveArtworkDto {
  location!: string;
}

export class RecordConditionDto {
  grade!: string;
  inspector!: string;
  notes!: string;
}

export interface ArtworkView {
  readonly id: string;
  readonly accessionNumber: string;
  readonly title: string;
  readonly artist: string;
  readonly conditionGrade: string;
  readonly location: string;
}

export function toArtworkView(record: ArtworkRecord): ArtworkView {
  return {
    id: record.id,
    accessionNumber: record.accessionNumber,
    title: record.title,
    artist: record.artist,
    conditionGrade: record.conditionGrade,
    location: record.location,
  };
}
