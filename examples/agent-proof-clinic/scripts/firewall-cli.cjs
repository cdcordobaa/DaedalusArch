// Runs the built DaedalusArch CLI (dist) the way bin/firewall.ts does.
require('/private/tmp/claude-501/-Volumes-Life-OS-Users-Arkatechie-Development-Archi-Firewall-DaedalusArch/3ea7dab4-b64a-4481-829e-334a9bfa22a1/scratchpad/wt-agentproof/dist/cli/index.js').main().catch((e) => { process.stderr.write('Fatal: ' + (e && e.message || e) + '\n'); process.exit(2); });
