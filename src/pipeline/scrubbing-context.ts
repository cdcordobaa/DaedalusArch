import type { PipelineAuditEntry, PipelineWarning } from '../shared/errors/domain-result.js';
import { FirewallContext } from '../shared/context/firewall-context.js';
import { scrubDeepWithPolicy, scrubWarningWithPolicy } from '../shared/errors/scrub.js';
import type { ScrubPolicy } from '../shared/errors/scrub.js';
import type { RunId } from '../shared/types/value-objects.js';

/**
 * The pipeline's context (NFR-05; U3 BR-U3-58, D-U0-6): every warning and every audit entry is
 * scrubbed under the run's `ScrubPolicy` (known secrets, credential shapes, resolved addresses) as it
 * is recorded, so no stage can leave a secret in `warnings` or the audit log.
 */
export class ScrubbingFirewallContext extends FirewallContext {
  constructor(runId: RunId, private readonly scrubPolicy: ScrubPolicy) {
    super(runId);
  }

  override addWarning(warning: PipelineWarning): void {
    super.addWarning(scrubWarningWithPolicy(warning, this.scrubPolicy));
  }

  override addAuditEntry(entry: PipelineAuditEntry): void {
    super.addAuditEntry(scrubDeepWithPolicy(entry, this.scrubPolicy));
  }
}
