class PressmarkError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}
const run = (run_id, run_state) => ({ run_id, run_state, grade: 'JUICING', litres: 0, pomace: 0, sediment: 0, weight: 410 });
class PressmarkClient {
  constructor(options) { this.apiKey = options.api_key; }
  async book(request) {
    if (request.bins > 40) throw new PressmarkError('PM_NO_SLOT', 'no press slot');
    return run('pm-208', 'QUEUED');
  }
  async report(run_id) { return run(run_id, 'PRESSING'); }
}
module.exports = { PressmarkClient, PressmarkError };
