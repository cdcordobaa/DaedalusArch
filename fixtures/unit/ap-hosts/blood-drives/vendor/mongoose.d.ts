// Minimal typings of the mongoose 8 surface this project and the anti-pattern operators use.
export type FilterQuery<T> = { [P in keyof T]?: T[P] | { $gte?: T[P]; $lt?: T[P]; $in?: T[P][] } };
export type UpdateQuery<T> = Partial<T> | { $inc?: { [P in keyof T]?: number }; $set?: Partial<T> };
export type HydratedDocument<T> = T & { _id: string; id: string; save(): Promise<HydratedDocument<T>> };
export interface Model<D> {
  create(doc: Partial<D>): Promise<D>;
  findById(id: string): Promise<D | null>;
  findOne(filter: FilterQuery<D>): Promise<D | null>;
  find(filter?: FilterQuery<D>, projection?: null, options?: { sort?: { [P in keyof D]?: 1 | -1 }; limit?: number }): Promise<D[]>;
  countDocuments(filter?: FilterQuery<D>): Promise<number>;
  findByIdAndUpdate(id: string, update: UpdateQuery<D>, options?: { new: boolean }): Promise<D | null>;
}
export declare function model<D>(name: string): Model<D>;
export declare class Schema<T = unknown> {
  private readonly __shape?: T;
}
