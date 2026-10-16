import { ExhibitionRecord } from '../../persistence/entities/exhibition.entity';

export class ScheduleExhibitionDto {
  title!: string;
  galleryCode!: string;
  opensOn!: string;
  closesOn!: string;
  capacity!: number;
}

export class RescheduleExhibitionDto {
  opensOn!: string;
  closesOn!: string;
}

export class PlaceArtworkDto {
  artworkId!: string;
  wall!: string;
  position!: number;
}

export interface ExhibitionView {
  readonly id: string;
  readonly title: string;
  readonly galleryCode: string;
  readonly opensOn: string;
  readonly closesOn: string;
  readonly capacity: number;
  readonly status: string;
}

export function toExhibitionView(record: ExhibitionRecord): ExhibitionView {
  return {
    id: record.id,
    title: record.title,
    galleryCode: record.galleryCode,
    opensOn: record.opensOn,
    closesOn: record.closesOn,
    capacity: record.capacity,
    status: record.status,
  };
}
