import { buildContext } from '/home/user/DaedalusArch/src/mcp-server/context.ts';
import { checkImportTool } from '/home/user/DaedalusArch/src/mcp-server/tools.ts';
const [spec, project, from, mod] = process.argv.slice(2);
void (async () => {
  const res = await checkImportTool(buildContext({ spec, project }, {}), { from, module: mod });
  process.stdout.write(JSON.stringify(res, null, 1).slice(0, 1500) + '\n');
})();
