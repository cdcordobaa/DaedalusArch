const SURCHARGE_BY_GRADE: { [grade: string]: number } = {
  MASTER: 180,
  CONCERT: 90,
  WORKSHOP: 30,
  STUDENT: 0,
};

export function surchargeFor(grade: string): number {
  return SURCHARGE_BY_GRADE[grade] ?? 0;
}
