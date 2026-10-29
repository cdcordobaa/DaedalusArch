// Typings of the Shelfdata book metadata SDK (shelfdata-sdk 3.2), as shipped by the vendor.
declare module 'shelfdata-sdk' {
  export type ShelfdataBinding = 'HC' | 'PB' | 'SP' | 'BB';
  export interface ShelfdataVolume {
    isbn_13: string;
    title_long: string;
    subtitle?: string;
    authors_display: string;
    publisher_name: string;
    pub_year: number;
    page_count: number;
    binding_code: ShelfdataBinding;
    cover_url_large?: string;
    language_iso: string;
  }
  export interface ShelfdataSearch {
    title?: string;
    author?: string;
    max_results?: number;
  }
  export class ShelfdataNotFound extends Error {}
  export class ShelfdataClient {
    constructor(options: { apiKey: string });
    lookupIsbn(isbn: string): Promise<ShelfdataVolume>;
    search(query: ShelfdataSearch): Promise<ShelfdataVolume[]>;
  }
}
