// CP3: kernel is stable (four components depend on it) and depends on the unstable plugins component (SDP).
// CP4: kernel is concrete and stable: zone of pain (A = 0, I = 0.2, D = 0.8).
import { Loader } from '../plugins/loader';
export class Registry {
  loader = new Loader();
}
