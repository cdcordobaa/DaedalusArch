/**
 * v1.3 npx mode: the MCP server over real stdio with no NEO4J variable in its environment
 * (src/mcp-server/stdio-smoke.ts; the same probe runs against the installed tarball, Docs/v1.3/npx-mode.md §5).
 */
import * as path from 'node:path';
import { runStdioSmoke } from '../../../src/mcp-server/stdio-smoke.js';
import { CLEAN_ARCH_SPEC, FIXTURES } from './helpers.js';

const REPO = path.resolve(__dirname, '../../..');

describe('MCP stdio smoke without a database', () => {
  it('lists the tools and answers check_file, check_diff, suggest_placement and evaluate_project on cypher-interp', async () => {
    const env = { ...process.env, NEO4J_URI: 'bolt://must-be-removed:7687', NEO4J_PASSWORD: 'must-be-removed' };
    const report = await runStdioSmoke({
      command: process.execPath,
      args: ['--import', 'tsx', path.join(REPO, 'src/mcp-server/main.ts')],
      specPath: CLEAN_ARCH_SPEC,
      projectPath: path.join(FIXTURES, 'correct-reference'),
      env,
    });
    const failed = report.steps.filter((s) => !s.ok);
    expect(failed).toEqual([]);
    expect(report.tools).toHaveLength(11); // TOOL_NAMES, incl. propose_spec
    expect(report.engineLine).toContain('cypher-interp');
  }, 120_000);
});
