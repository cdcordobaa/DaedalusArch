import { DateRange } from '../../shared/domain/date-range';
import { Exhibition } from '../../exhibitions/domain/exhibition';
import { isExhibitionStatus } from '../../exhibitions/domain/exhibition-status';
import { GalleryCapacity } from '../../exhibitions/domain/gallery';
import { ExhibitionRecord } from '../entities/exhibition.entity';

export function toExhibition(record: ExhibitionRecord): Exhibition {
  const status = isExhibitionStatus(record.status) ? record.status : 'planned';
  return new Exhibition(record.id, record.title, record.galleryCode, DateRange.parse(record.opensOn, record.closesOn), new GalleryCapacity(record.capacity), status);
}

export function applyExhibition(record: ExhibitionRecord, exhibition: Exhibition): ExhibitionRecord {
  record.opensOn = exhibition.run.start.toISOString().slice(0, 10);
  record.closesOn = exhibition.run.end.toISOString().slice(0, 10);
  record.capacity = exhibition.capacity.visitors;
  record.status = exhibition.status;
  return record;
}
