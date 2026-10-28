import { Column, Entity, PrimaryColumn } from 'typeorm';

export type ConditionGrade = 'good' | 'fair' | 'poor';

@Entity('condition_reports')
export class ConditionReport {
  @PrimaryColumn() readonly artworkId: string;
  @Column() readonly grade: ConditionGrade;
  @Column() readonly notes: string;

  constructor(artworkId: string, grade: ConditionGrade, notes: string) {
    this.artworkId = artworkId;
    this.grade = grade;
    this.notes = notes;
  }
}
