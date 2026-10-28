export class CampaignId {
  private constructor(readonly value: string) {}

  static of(value: string): CampaignId {
    if (!/^C-\d+$/.test(value)) throw new Error(`no campaign ${value}`);
    return new CampaignId(value);
  }
}
