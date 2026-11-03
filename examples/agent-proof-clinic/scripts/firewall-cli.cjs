// Runs the built DaedalusArch CLI (dist) the way bin/firewall.ts does.
require(require('path').join(process.env.AGENTPROOF_WORK || '.', 'wt-agentproof/dist/cli/index.js')).main().catch((e) => { process.stderr.write('Fatal: ' + (e && e.message || e) + '\n'); process.exit(2); });
