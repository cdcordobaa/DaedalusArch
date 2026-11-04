class TarescaleError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}
class TarescaleClient {
  constructor(options) { this.site = options.site_id; }
  async weigh(plate) {
    if (!plate) throw new TarescaleError('TS_UNKNOWN_PLATE', 'no plate');
    return { ticket_no: 'WT-' + Date.now(), plate, gross_kg: 41200, tare_kg: 14800, status: 'STABLE', issued_at: new Date().toISOString() };
  }
}
module.exports = { TarescaleClient, TarescaleError };
