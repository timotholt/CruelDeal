import { spawnSync } from 'node:child_process';

/**
 * The one release-facing repository gate.
 *
 * Experimental authoring and city-map projects have explicit typecheck
 * commands, but remain outside this gate until their individual error ledgers
 * are retired. Shipped `/play` code and the canonical game architecture may
 * not use those ledgers as an excuse to skip validation.
 */
const commands = [
  ['npm', ['run', 'cards:generate:check']],
  ['npm', ['run', 'cards:validate']],
  ['npm', ['run', 'locations:generate:check']],
  ['npm', ['run', 'locations:validate']],
  ['npm', ['run', 'protocol:schema:check']],
  ['npm', ['run', 'typecheck:playgame']],
  ['npm', ['run', 'typecheck:app']],
  ['npm', ['run', 'typecheck:scripts']],
  ['npm', ['run', 'lint:playgame:phase15']],
  ['npm', ['run', 'lint:playgame:phase7']],
  ['npm', ['run', 'test:architecture']],
  ['npm', ['run', 'test:engine:authorities']],
  ['npm', ['run', 'test:playgame:phase7']],
  ['npm', ['run', 'protocol:test:ts']],
  ['npm', ['run', 'protocol:test:rust']],
  ['npm', ['run', 'build']],
];

for (const [command, args] of commands) {
  console.log(`\n> ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
  });

  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
