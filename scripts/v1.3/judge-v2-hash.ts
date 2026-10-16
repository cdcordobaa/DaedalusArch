/** Prints the judge v2 revision and `computeJudgeV2Sha256()` (the anchor `JUDGE_V2_SHA256` must equal it). */
import { JUDGE_V2_REVISION, JUDGE_V2_SHA256, computeJudgeV2Sha256 } from '../../src/llm-critic/judge-v2.js';

const now = computeJudgeV2Sha256();
process.stdout.write(`${JUDGE_V2_REVISION} ${now}${now === JUDGE_V2_SHA256 ? '' : ` (anchor ${JUDGE_V2_SHA256} is stale)`}\n`);
