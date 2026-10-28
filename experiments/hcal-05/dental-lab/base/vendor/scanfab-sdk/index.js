class ScanFabError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}
class ScanFabClient {
  constructor(options) { this.apiKey = options.api_key; }
  async process(request) {
    if (!request.stl_payload) throw new ScanFabError('E_CORRUPT_STL', 'empty payload');
    return { job_id: 'job-1', job_status: 'DONE', quality_grade: 'SF_OK', mesh_precision: request.mesh_precision, margin_gap_um: 12 };
  }
}
module.exports = { ScanFabClient, ScanFabError };
