/**
 * Vitest setup for engine tests.
 *
 * The pre-existing *.test.ts files use a hand-rolled assertion runner that
 * calls process.exit(1) when tests fail. Vitest intercepts that as an
 * unhandled error. We patch process.exit to throw instead so vitest can
 * report it cleanly as a test failure.
 */
const _origExit = process.exit.bind(process);
(process as NodeJS.Process).exit = ((code?: number) => {
  if (code !== 0 && code !== undefined) {
    throw new Error(`process.exit(${code}) — test failures detected`);
  }
  _origExit(code as never);
}) as typeof process.exit;
