// CP5: abstract and unstable (only interfaces, depends on kernel, nothing depends on it): zone of uselessness, D = 1.
import type { Registry } from '../kernel/registry';
export interface RegistryPort {
  registry(): Registry;
}
export interface ClockPort {
  now(): number;
}
