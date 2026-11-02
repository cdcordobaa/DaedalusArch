/** A costume in the wardrobe; the day rate is in euros. */
export interface Costume {
  readonly costumeId: string;
  readonly name: string;
  /** The main fabric, as the wardrobe labels it (wool, cotton, silk, velvet, ...). */
  readonly fabric: string;
  readonly dayRate: number;
}
