/**
 * Engine bridge barrel — Step 8a.
 *
 * Import surface for the /play UI. This module is the ONLY thing outside
 * the engine that should be reached for at call sites in PlayGameContext.
 *
 * @migrate:step-8c Remove this barrel when the UI consumes engine state
 * directly (no more translation layer).
 */

export { mountBridge } from './bridge';
export type { Bridge, BridgeOptions } from './bridge';
export { liftMatchState, nameToDefId, defIdToName } from './translate';
export { checkParity, reportParity } from './parity';
export type { ParityMismatch, ParityReport } from './parity';
