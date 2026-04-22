/**
 * engine:cli — headless match replay entrypoint.
 *
 * Usage:
 *   npm run engine:cli                       # uses default seed
 *   npm run engine:cli -- --seed=my-seed     # custom seed
 *   npm run engine:cli -- --seed=x --json    # stream events as JSONL
 *   npm run engine:cli -- --seed=x --quiet   # only the final result
 *
 * Runs one full deterministic match with BOOTSTRAP_MANIFEST and prints
 * a turn-by-turn summary. The same seed always produces the same match.
 */

import { BOOTSTRAP_MANIFEST } from '../manifest/bootstrap';
import type { MatchEvent } from '../types/events';
import type { MatchState } from '../types/state';
import { runMatch } from './runMatch';

interface CliArgs {
  seed: string;
  json: boolean;
  quiet: boolean;
}

function parseArgs(argv: readonly string[]): CliArgs {
  const out: CliArgs = { seed: 'cli-default', json: false, quiet: false };
  for (const raw of argv) {
    if (raw.startsWith('--seed=')) out.seed = raw.slice('--seed='.length);
    else if (raw === '--json') out.json = true;
    else if (raw === '--quiet') out.quiet = true;
    else if (raw === '--help' || raw === '-h') {
      process.stdout.write(
        'Usage: engine:cli [--seed=<seed>] [--json] [--quiet]\n',
      );
      process.exit(0);
    }
  }
  return out;
}

function fmtEvent(e: MatchEvent): string {
  switch (e.type) {
    case 'TURN_STARTED':
      return `  >> TURN ${e.turn} starts (priority=${e.priority} reason=${e.priorityReason})`;
    case 'TURN_ENDED':
      return `  << TURN ${e.turn} ends`;
    case 'CARD_STAGED':
      return `     ${e.owner} stages ${e.cardId} -> lane ${e.lane} (cost ${e.cost})`;
    case 'CARD_FLIPPED':
      return `     reveal ${e.cardId}`;
    case 'CARD_DRAWN':
      return `     ${e.owner} draws ${e.cardId}`;
    case 'ENERGY_CHANGED':
      return `     ${e.owner} energy ${e.delta >= 0 ? '+' : ''}${e.delta} (${e.reason})`;
    case 'MAX_ENERGY_CHANGED':
      return `     ${e.owner} maxEnergy ${e.delta >= 0 ? '+' : ''}${e.delta} (${e.reason})`;
    case 'NEXT_TURN_ENERGY_BONUS_CHANGED':
      return `     ${e.owner} next-turn bonus ${e.delta >= 0 ? '+' : ''}${e.delta}`;
    case 'LOCATION_REVEALED':
      return `  ** location revealed in lane ${e.lane} (${e.locationId})`;
    case 'MATCH_ENDED': {
      const r = e.result;
      return `  == MATCH ENDED: winner=${r.winner} lanes=${r.lanesWon.PLAYER}-${r.lanesWon.OPP} power=${r.totalPower.PLAYER}-${r.totalPower.OPP}`;
    }
    case 'INTENT_REJECTED':
      return `     !! rejected intent ${e.intentId}: ${e.reason}`;
    default:
      return `     · ${e.type}`;
  }
}

function printSummary(finalState: MatchState): void {
  const r = finalState.result;
  if (!r) {
    process.stdout.write(`Match did not terminate cleanly. turn=${finalState.turn}\n`);
    return;
  }
  process.stdout.write(
    [
      '',
      '──────────────────────────────────────────────',
      ` Winner     : ${r.winner}`,
      ` Lanes won  : PLAYER=${r.lanesWon.PLAYER}  OPP=${r.lanesWon.OPP}`,
      ` Total power: PLAYER=${r.totalPower.PLAYER}  OPP=${r.totalPower.OPP}`,
      ` Turns      : ${finalState.turn}`,
      '──────────────────────────────────────────────',
      '',
    ].join('\n'),
  );
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const manifest = BOOTSTRAP_MANIFEST;

  if (!args.quiet && !args.json) {
    process.stdout.write(
      `engine:cli  seed="${args.seed}"  manifest v${manifest.version}\n`,
    );
  }

  const onEvent = args.json
    ? (e: MatchEvent): void => {
        process.stdout.write(JSON.stringify(e) + '\n');
      }
    : args.quiet
      ? (): void => undefined
      : (e: MatchEvent): void => {
          const line = fmtEvent(e);
          if (line) process.stdout.write(line + '\n');
        };

  const result = runMatch({
    seed: args.seed,
    manifest,
    onEvent: (e) => onEvent(e),
  });

  if (!args.json) printSummary(result.finalState);
}

main();
