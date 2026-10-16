// usage: npx tsx checkdiff.ts <spec> <projectRoot> <diffFile>  -> JSON of the MCP check_diff tool result
import * as fs from 'node:fs';
import { buildContext } from '/home/user/DaedalusArch/src/mcp-server/context.ts';
import { checkDiffTool } from '/home/user/DaedalusArch/src/mcp-server/tools.ts';
const [spec, project, diffFile] = process.argv.slice(2);
const ctx = buildContext({ spec, project }, {});
void (async () => {
  const res = await checkDiffTool(ctx, { diff: fs.readFileSync(diffFile, "utf8") });
  process.stdout.write(JSON.stringify(res, null, 2) + "\n");
})();
