import { hasDeteriorated } from './condition-grade';

/** A catalogued object, owned by the museum or on loan to it. */
export class Artwork {
  conditionGrade: string;
  location: string;

  constructor(
    readonly id: string,
    readonly accessionNumber: string,
    readonly title: string,
    readonly artist: string,
    conditionGrade: string,
    location: string,
  ) {
    this.conditionGrade = conditionGrade;
    this.location = location;
  }

  isOnDisplay(): boolean {
    return this.location.startsWith('gallery:');
  }

  regrade(grade: string): { readonly deteriorated: boolean } {
    const deteriorated = hasDeteriorated(this.conditionGrade, grade);
    this.conditionGrade = grade;
    return { deteriorated };
  }
}
