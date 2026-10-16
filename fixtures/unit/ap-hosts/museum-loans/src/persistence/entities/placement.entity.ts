import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** An artwork hung in an exhibition: wall and position along the visitor route. */
@Entity('exhibition_placements')
export class PlacementRecord {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'exhibition_id' })
  exhibitionId!: string;

  @Column({ name: 'artwork_id' })
  artworkId!: string;

  @Column()
  wall!: string;

  @Column()
  position!: number;
}
