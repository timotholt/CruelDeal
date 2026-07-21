import { spawnSync } from 'node:child_process';

const commands = [
  ['npm', ['run', 'cards:generate:check']],
  ['npm', ['run', 'cards:validate']],
  ['npm', ['run', 'locations:generate:check']],
  ['npm', ['run', 'locations:validate']],
  ['npm', ['run', 'protocol:schema:check']],
  ['npm', ['run', 'lint:playgame:phase7']],
  ['npm', ['run', 'test:playgame:manifest']],
  ['npm', ['run', 'test:playgame:phase7']],
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
