/** What membership needs to know about pontoons. */
export interface PontoonLookup {
  exists(pontoonId: string): boolean;
}
