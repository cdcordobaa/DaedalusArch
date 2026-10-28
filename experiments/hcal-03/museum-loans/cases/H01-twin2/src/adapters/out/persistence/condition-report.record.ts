import { Column, Entity, PrimaryColumn } from 'typeorm';
import { ConditionGrade, ConditionReport } from '../../../domain/condition-report';

@Entity('condition_reports')
export class ConditionReportRecord {
  @PrimaryColumn() artworkId = '';
  @Column() grade: ConditionGrade = 'good';
  @Column() notes = '';

  static fromDomain(report: ConditionReport): ConditionReportRecord {
    const record = new ConditionReportRecord();
    record.artworkId = report.artworkId;
    record.grade = report.grade;
    record.notes = report.notes;
    return record;
  }

  toDomain(): ConditionReport {
    return new ConditionReport(this.artworkId, this.grade, this.notes);
  }
}
