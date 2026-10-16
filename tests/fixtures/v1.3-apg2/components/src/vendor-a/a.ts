export interface Plugin {
  name: string;
}
export class PluginA implements Plugin {
  name = 'a';
}
