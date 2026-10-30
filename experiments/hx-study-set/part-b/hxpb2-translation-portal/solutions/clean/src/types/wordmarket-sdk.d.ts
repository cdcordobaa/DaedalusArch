// Typings of the Wordmarket translator-marketplace SDK (wordmarket-sdk 2.4), as shipped by the vendor.
declare module 'wordmarket-sdk' {
  export type JobState = 'posted' | 'claimed' | 'drafting' | 'proofreading' | 'delivered' | 'disputed';
  export type Turnaround = 'normal' | 'express';
  export interface PostJobInput {
    sourceLang: string;
    targetLang: string;
    wordCount: number;
    turnaround: Turnaround;
    brief: string;
  }
  export interface JobRecord {
    id: string;
    state: JobState;
    wordCount: number;
    translatorHandle: string | null;
    updatedAt: string;
  }
  export class WordmarketApiError extends Error {
    readonly reason: string;
  }
  export interface JobsResource {
    post(input: PostJobInput): Promise<JobRecord>;
    get(id: string): Promise<JobRecord>;
  }
  export class Wordmarket {
    constructor(config: { apiToken: string; sandbox?: boolean });
    readonly jobs: JobsResource;
  }
}
