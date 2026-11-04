class TidewatchError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}
class TidewatchClient {
  constructor(options) { this.token = options.access_token; }
  async requestWindow(request) {
    if (request.draught_m > 16) throw new TidewatchError('TW_NO_WINDOW', 'no tide window for that draught');
    return { berth_window_ref: 'TW-20931', window_open_utc: '2026-11-12T03:40:00Z', window_close_utc: '2026-11-12T05:10:00Z',
      hull_class: 'HANDYSIZE', ukc_margin_m: 0.8, squat: 0.4, notes: null };
  }
  async movement(imo_number) {
    return { imo_number, berth_window_ref: 'TW-20931', phase: 'BERTHING', squat: 0.4, notes: null, reported_at_utc: '2026-11-12T04:02:00Z' };
  }
}
module.exports = { TidewatchClient, TidewatchError };
