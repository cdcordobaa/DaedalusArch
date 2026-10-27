import type { DomainEvent } from '../../../../shared-kernel/DomainEvent';
import type { PartLine } from '../../PartLine';

/** The job is done; the stockroom takes the fitted parts off its shelves when the event is delivered. */
export class JobCompleted implements DomainEvent {
  readonly type = 'JobCompleted';

  constructor(
    readonly jobId: string,
    readonly parts: readonly PartLine[],
  ) {}
}
