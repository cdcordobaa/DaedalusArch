class SchedulingConflict extends Error {
  constructor(code, message) { super(message); this.code = code; }
}
const visit = (visit_uid, visit_state, window_start_iso) => ({
  visit_uid, visit_state, tech_uid: 't-8', eta_minutes: 35, window_start_iso,
});
class CrewClockClient {
  constructor(options) { this.tenant = options.tenant_id; this.secret = options.api_secret; }
  async schedule(request) {
    if (request.zone_code === '') throw new SchedulingConflict('E_ZONE_UNKNOWN', 'no zone');
    return visit('v-301', 'ASSIGNED', request.window_start_iso);
  }
  async fetch(visit_uid) { return visit(visit_uid, 'EN_ROUTE', '2026-11-03T08:00:00Z'); }
}
module.exports = { CrewClockClient, SchedulingConflict };
