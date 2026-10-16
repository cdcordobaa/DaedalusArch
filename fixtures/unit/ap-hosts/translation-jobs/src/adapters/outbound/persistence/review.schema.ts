import { EntitySchema } from 'typeorm';
import { Review } from '../../../domain/review';

export const ReviewSchema = new EntitySchema<Review>({
  name: 'Review',
  target: Review,
  tableName: 'reviews',
  columns: {
    id: { type: 'uuid', primary: true },
    jobId: { type: 'uuid', name: 'job_id' },
    reviewerId: { type: 'uuid', name: 'reviewer_id' },
    score: { type: 'int' },
    comments: { type: 'varchar' },
  },
});
