import type { CopyView, ListCopy } from '../../../application/ports/in/ListCopy';
import type { SearchTitles } from '../../../application/ports/in/SearchTitles';

export interface HttpResponse {
  readonly status: number;
  readonly body: unknown;
}

/** POST /copies, GET /copies/:id and GET /titles?q=, in the JSON our shop website reads. */
export class ShopController {
  constructor(
    private readonly copies: ListCopy,
    private readonly titles: SearchTitles,
  ) {}

  postCopy(body: Record<string, unknown>): Promise<HttpResponse> {
    return this.run(async () => json(await this.copies.list({
      copyId: String(body.copy_id ?? ''),
      isbn: String(body.isbn ?? ''),
      condition: String(body.condition ?? ''),
      price: Number(body.price),
    })));
  }

  getCopy(copyId: string): Promise<HttpResponse> {
    return this.run(async () => json(await this.copies.find(copyId)));
  }

  getTitles(q: string): Promise<HttpResponse> {
    return this.run(() => this.titles.search(q));
  }

  private async run(fn: () => Promise<unknown>): Promise<HttpResponse> {
    try {
      return { status: 200, body: await fn() };
    } catch (e) {
      return { status: 400, body: { error: e instanceof Error ? e.message : String(e) } };
    }
  }
}

function json(v: CopyView): Record<string, unknown> {
  return { copy_id: v.copyId, isbn: v.isbn, title: v.title, author: v.author, year: v.year, pages: v.pages, binding: v.binding, condition: v.condition, price: v.price };
}
