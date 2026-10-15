// CP6: modules declared by file-name globs in one flat folder (core = core-*.ts, plugins = plugin-*.ts).
// core-registry -> plugin-loader and plugin-hooks -> core-config close a module-level cycle; no file cycle,
// and no folder-level cycle (one folder).
import { PluginLoader } from './plugin-loader';
export class CoreRegistry {
  loader = new PluginLoader();
}
