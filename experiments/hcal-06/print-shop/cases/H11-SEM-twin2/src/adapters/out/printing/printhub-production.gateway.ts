import { PaperStock, PreflightError, PrintHubClient, PrintHubError } from 'printhub-sdk';
import { PrintProductionPort, PrintSpec } from '../../../application/ports/out/print-production.port';
import { ProductionUnavailableError } from '../../../domain/errors';
import { PaperChoice } from '../../../domain/order-status';
import { ArtworkIssue, ProductionTicket } from '../../../domain/production';

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
        paper_stock: this.toStock(spec.paper),
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

  private toStock(paper: PaperChoice): PaperStock {
    switch (paper) {
      case 'matte': return 'PH_MATTE_100';
      case 'gloss': return 'PH_GLOSS_130';
      case 'uncoated': return 'PH_UNCOATED_90';
    }
  }

  private toIssue(error: PreflightError): ArtworkIssue {
    return error === 'ERR_LOW_DPI' || error === 'ERR_COLOR_PROFILE' ? 'image-quality' : 'layout';
  }
}
