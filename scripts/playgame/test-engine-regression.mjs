import { spawn } from 'node:child_process';
import { copyFileSync, createWriteStream, existsSync, mkdirSync, rmSync, symlinkSync } from 'node:fs';
import path from 'node:path';

/**
 * The named, repeatable engine regression contract.
 *
 * Keep this intentionally separate from the UI/release gate. It is the command
 * to run after changing game rules, content, replay, runtime authority, or the
 * shared protocol. Its catalog and intentional migration gaps live in
 * docs/playgame-engine-regression.md.
 */
const commands = [
  ['Engine kernel and architecture', ['npm', ['run', 'test:engine:kernel']]],
  ['Engine runtime and deterministic properties', ['npm', ['run', 'test:engine:runtime']]],
  ['Registered authority conformance matrix', ['npm', ['run', 'test:engine:authorities']]],
  ['TypeScript protocol contract', ['npm', ['run', 'protocol:test:ts']]],
  ['Rust protocol contract', ['npm', ['run', 'protocol:test:rust']]],
  ['Card generated-module drift', ['npm', ['run', 'cards:generate:check']]],
  ['Card manifest validity', ['npm', ['run', 'cards:validate']]],
  ['Location generated-module drift', ['npm', ['run', 'locations:generate:check']]],
  ['Location manifest validity', ['npm', ['run', 'locations:validate']]],
  ['Engine TypeScript boundary', ['npm', ['run', 'typecheck:playgame']]],
];

const logDirectory = path.join(process.cwd(), '.test-logs', 'engine');
mkdirSync(logDirectory, { recursive: true });
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const logPath = path.join(logDirectory, `engine-regression-${timestamp}.log`);
const latestPath = path.join(logDirectory, 'latest.log');
const log = createWriteStream(logPath, { flags: 'a' });

function write(value) {
  process.stdout.write(value);
  log.write(value);
}

function formatDuration(milliseconds) {
  const totalSeconds = Math.round(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes === 0 ? `${seconds}s` : `${minutes}m ${seconds}s`;
}

function run(label, command, args) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    write(`\n=== ${label} ===\n$ ${command} ${args.join(' ')}\n`);
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    child.stdout.on('data', (chunk) => write(chunk));
    child.stderr.on('data', (chunk) => write(chunk));
    child.on('error', reject);
    child.on('close', (code) => {
      const status = code ?? 1;
      write(`=== ${label}: ${status === 0 ? 'passed' : 'failed'} in ${formatDuration(Date.now() - startedAt)} ===\n`);
      resolve(status);
    });
  });
}

function updateLatestLog() {
  if (existsSync(latestPath)) rmSync(latestPath);
  try {
    symlinkSync(path.basename(logPath), latestPath);
  } catch {
    // A normal file still gives users a stable path on filesystems without symlink support.
    copyFileSync(logPath, latestPath);
  }
}

// Make the stable path useful while a long property corpus is still running.
updateLatestLog();

let exitCode = 0;
const regressionStartedAt = Date.now();
try {
  write(`Engine regression started ${new Date().toISOString()}\n`);
  for (const [label, [command, args]] of commands) {
    const status = await run(label, command, args);
    if (status !== 0) {
      exitCode = status;
      write(`\nFAILED: ${label} (exit ${status})\n`);
      break;
    }
  }
  if (exitCode === 0) write(`\nPASSED: engine regression\n`);
} finally {
  write(`Total engine regression time: ${formatDuration(Date.now() - regressionStartedAt)}\n`);
  await new Promise((resolve) => log.end(resolve));
  updateLatestLog();
  console.log(`Engine regression log: ${logPath}`);
  console.log(`Latest engine regression log: ${latestPath}`);
}

process.exitCode = exitCode;
