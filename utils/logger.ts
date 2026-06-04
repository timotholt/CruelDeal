import log from 'loglevel';

// App-wide logging + fault handling.
//
// Two ideas in one module:
//   1. Leveled logging (trace/debug/info/warn/error) via loglevel.
//   2. fault(): the single funnel for "this should not happen" conditions.
//      A fault is always logged. Whether it then *throws* or is *swallowed*
//      is a runtime policy:
//        - 'throw'    -> surface the bug loudly (development, CI, tests).
//        - 'continue' -> log and keep running (production resilience).
//
// Callers that have a sane fallback log the fault and then return the
// fallback; in 'throw' mode fault() never returns, so the fallback is only
// reached in 'continue' mode.

export type FaultPolicy = 'throw' | 'continue';

export interface LoggerConfig {
  policy: FaultPolicy;
  level: log.LogLevelDesc;
}

// Dev detection that works under Vite (import.meta.env) and plain Node/tsx.
const viteEnv = (import.meta as unknown as { env?: { DEV?: boolean } }).env;
const isDev = viteEnv?.DEV
  ?? (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production');

const config: LoggerConfig = {
  policy: isDev ? 'throw' : 'continue',
  level: isDev ? 'debug' : 'warn',
};

log.setLevel(config.level);

/** Update logging behavior at runtime (e.g. flip a prod build to 'throw' to debug). */
export const configureLogging = (next: Partial<LoggerConfig>): void => {
  if (next.policy !== undefined) config.policy = next.policy;
  if (next.level !== undefined) {
    config.level = next.level;
    log.setLevel(next.level);
  }
};

export const getLoggingConfig = (): Readonly<LoggerConfig> => ({ ...config });

export const logTrace = (message: string, detail?: unknown): void => log.trace(message, detail ?? '');
export const logDebug = (message: string, detail?: unknown): void => log.debug(message, detail ?? '');
export const logInfo = (message: string, detail?: unknown): void => log.info(message, detail ?? '');
export const logWarn = (message: string, detail?: unknown): void => log.warn(message, detail ?? '');
export const logError = (message: string, detail?: unknown): void => log.error(message, detail ?? '');

/** Error carrying a stable machine-readable code + structured detail. */
export class AppFault extends Error {
  readonly code: string;
  readonly detail?: Record<string, unknown>;

  constructor(code: string, detail?: Record<string, unknown>) {
    super(code);
    this.name = 'AppFault';
    this.code = code;
    this.detail = detail;
  }
}

/**
 * Report a fault. Always logs at error level. Throws an AppFault when the
 * active policy is 'throw' (dev/CI), otherwise returns so the caller can fall
 * back and keep running (production).
 */
export const fault = (code: string, detail?: Record<string, unknown>): void => {
  log.error(`[fault] ${code}`, detail ?? '');
  if (config.policy === 'throw') {
    throw new AppFault(code, detail);
  }
};

/** Assert a condition; fault() with the given code/detail when it fails. */
export function ensure(condition: unknown, code: string, detail?: Record<string, unknown>): asserts condition {
  if (!condition) fault(code, detail);
}
