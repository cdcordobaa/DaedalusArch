export type ConditionGrade = 'good' | 'fair' | 'poor';

export class ConditionReport {
  constructor(
    readonly artworkId: string,
    readonly grade: ConditionGrade,
    readonly notes: string,
  ) {}
}
