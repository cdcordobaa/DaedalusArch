import { PaperStock, PreflightError, PrintHubClient, PrintHubError } from 'printhub-sdk';
import { PrintProductionPort, PrintSpec } from '../../../application/ports/out/print-production.port';
import { ProductionUnavailableError } from '../../../domain/errors';
import { Finish } from '../../../domain/order-status';
import { ArtworkIssue, ProductionTicket } from '../../../domain/production';

/** A job id as issued by the printing partner. */
export type PrintHubJobRef = string;

export class PrintHubProductionGateway implements PrintProductionPort {
  private readonly client: PrintHubClient;

  constructor(apiKey: string) {
    this.client = new PrintHubClient({ api_key: apiKey });
  }

  async submit(spec: PrintSpec): Promise<ProductionTicket> {
    try {
      const res = await this.client.submit({
        sku_code: spec.sku,
        page_count: spec.pageCount,
        paper_stock: this.toStock(spec.finish),
        copies: spec.copies,
        ship_to_postcode: spec.postcode,
      });
      const issues = [...new Set(res.preflight_errors.map((e) => this.toIssue(e)))];
      return {
        productionRef: res.job_id,
        outcome: issues.length === 0 ? 'accepted' : 'artwork-rejected',
        artworkIssues: issues,
        unitCostCents: res.unit_cost_cents,
      };
    } catch (e) {
      if (e instanceof PrintHubError) throw new ProductionUnavailableError(`printing partner unavailable: ${e.message}`);
      throw e;
    }
  }

  private toStock(finish: Finish): PaperStock {
    return finish === 'premium' ? 'PH_GLOSS_130' : 'PH_MATTE_100';
  }

  private toIssue(error: PreflightError): ArtworkIssue {
    return error === 'ERR_LOW_DPI' || error === 'ERR_COLOR_PROFILE' ? 'image-quality' : 'layout';
  }
}
