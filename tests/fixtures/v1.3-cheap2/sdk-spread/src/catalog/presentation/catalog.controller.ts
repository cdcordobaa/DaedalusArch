import axios from 'axios';

/** PLANTED P3: an HTTP client SDK in a controller. */
export class CatalogController {
  async proxy(url: string): Promise<unknown> {
    const r = await axios.get(url);
    return r.data;
  }
}
