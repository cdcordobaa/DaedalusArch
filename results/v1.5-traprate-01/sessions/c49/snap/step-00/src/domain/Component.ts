import { RequestRefused } from './RequestRefused';

export const COMPONENTS = ['red cells', 'platelets', 'plasma'] as const;

/** The blood component a ward asks for. */
export type Component = (typeof COMPONENTS)[number];

export function component(text: string): Component {
  const found = COMPONENTS.find((c) => c === text.trim().toLowerCase());
  if (found === undefined) throw new RequestRefused(`unknown component: ${text} (red cells, platelets or plasma)`);
  return found;
}
