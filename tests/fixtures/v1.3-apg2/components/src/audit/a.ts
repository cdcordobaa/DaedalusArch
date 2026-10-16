// NM-CP1: a file-level cycle inside one component. v1.3 no-cyclic-deps reports it; no component-level cycle exists.
import { AuditB } from './b';
export class AuditA {
  b?: AuditB;
}
