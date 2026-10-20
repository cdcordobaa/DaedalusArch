// Study 2b dress rehearsal only (practice task ice-rink): NOT a Study 2 check and not derived from any sealed task.
// The practice task names no routes, so the only contract checked is the D12a start convention: the snapshot starts
// with `npm start`, listens on PORT, and answers HTTP on BASE_URL. It proves the acceptance runner end to end.
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('the service answers HTTP on BASE_URL', async () => {
  const r = await fetch(`${process.env.BASE_URL}/`);
  assert.ok(r.status >= 100 && r.status < 600);
});
