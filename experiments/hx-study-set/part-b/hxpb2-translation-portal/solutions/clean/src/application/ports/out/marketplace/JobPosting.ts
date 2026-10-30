import type { TranslationOrder } from '../../../../domain/model/TranslationOrder';

/** Offers an order to freelance translators; answers the job id. */
export interface JobPosting {
  post(order: TranslationOrder, brief: string): Promise<string>;
}
