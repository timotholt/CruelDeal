import Ajv2020, {
  type ErrorObject,
  type ValidateFunction,
} from 'ajv/dist/2020.js';

import protocolSchema from '../../../protocol/schema/cruel-deal-protocol-v1.schema.json';
import type { FramedEvent } from '../engine/types/timeline';
import type {
  CommittedTransactionRecord,
  IntentEnvelope,
  MatchBootstrap,
} from '../runtime/contracts';
import type {
  SeatCommittedTransaction,
  SeatMatchSnapshot,
  SeatResyncRequest,
  SeatResyncResponse,
} from '../runtime/projection';

export const CRUEL_DEAL_PROTOCOL_VERSION = 1 as const;

export type ProtocolContractKind =
  | 'MATCH_BOOTSTRAP'
  | 'INTENT_ENVELOPE'
  | 'FRAMED_EVENT'
  | 'COMMITTED_TRANSACTION'
  | 'SEAT_MATCH_SNAPSHOT'
  | 'SEAT_COMMITTED_TRANSACTION'
  | 'SEAT_RESYNC_REQUEST'
  | 'SEAT_RESYNC_RESPONSE';

export interface ProtocolValidationIssue {
  readonly path: string;
  readonly keyword: string;
  readonly message: string;
  readonly schemaPath: string;
}

export type ProtocolValidationResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly issues: readonly ProtocolValidationIssue[] };

export interface ProtocolMessage {
  readonly protocolVersion: typeof CRUEL_DEAL_PROTOCOL_VERSION;
  readonly kind: ProtocolContractKind;
  readonly payload: unknown;
}

export class ProtocolValidationError extends Error {
  readonly kind: ProtocolContractKind;
  readonly issues: readonly ProtocolValidationIssue[];

  constructor(kind: ProtocolContractKind, issues: readonly ProtocolValidationIssue[]) {
    super(
      `${kind} violates Cruel Deal protocol v${CRUEL_DEAL_PROTOCOL_VERSION}:\n`
      + issues.map((issue) => `- ${issue.path || '/'}: ${issue.message}`).join('\n'),
    );
    this.name = 'ProtocolValidationError';
    this.kind = kind;
    this.issues = issues;
  }
}

const ajv = new Ajv2020({
  allErrors: true,
  strict: true,
  validateFormats: false,
});
const validateMessage = ajv.compile(protocolSchema);
const payloadSchemaNames: Record<ProtocolContractKind, string> = {
  MATCH_BOOTSTRAP: 'MatchBootstrap',
  INTENT_ENVELOPE: 'IntentEnvelope',
  FRAMED_EVENT: 'FramedEvent',
  COMMITTED_TRANSACTION: 'CommittedTransaction',
  SEAT_MATCH_SNAPSHOT: 'SeatMatchSnapshot',
  SEAT_COMMITTED_TRANSACTION: 'SeatCommittedTransaction',
  SEAT_RESYNC_REQUEST: 'SeatResyncRequest',
  SEAT_RESYNC_RESPONSE: 'SeatResyncResponse',
};
const payloadValidators = Object.fromEntries(
  Object.entries(payloadSchemaNames).map(([kind, schemaName]) => [
    kind,
    ajv.compile({ $ref: `${protocolSchema.$id}#/$defs/${schemaName}` }),
  ]),
) as Record<ProtocolContractKind, ValidateFunction>;

function payloadPath(error: ErrorObject): string {
  let path = error.instancePath.startsWith('/payload')
    ? error.instancePath.slice('/payload'.length)
    : error.instancePath;
  if (error.keyword === 'required') {
    const missing = (error.params as { readonly missingProperty?: string }).missingProperty;
    if (missing) path = `${path}/${missing}`;
  }
  return path || '/';
}

function normalizeIssues(
  errors: readonly ErrorObject[] | null | undefined,
): readonly ProtocolValidationIssue[] {
  return Object.freeze((errors ?? []).map((error) => Object.freeze({
    path: payloadPath(error),
    keyword: error.keyword,
    message: error.message ?? 'schema validation failed',
    schemaPath: error.schemaPath,
  })));
}

export function validateProtocolPayload<T>(
  kind: ProtocolContractKind,
  input: unknown,
): ProtocolValidationResult<T> {
  const validatePayload = payloadValidators[kind];
  if (validatePayload(input)) {
    return { ok: true, value: input as T };
  }
  return { ok: false, issues: normalizeIssues(validatePayload.errors) };
}

export function validateProtocolMessage(
  input: unknown,
): ProtocolValidationResult<ProtocolMessage> {
  if (validateMessage(input)) {
    return { ok: true, value: input as ProtocolMessage };
  }
  return { ok: false, issues: normalizeIssues(validateMessage.errors) };
}

export function assertProtocolPayload(
  kind: ProtocolContractKind,
  input: unknown,
): void {
  const result = validateProtocolPayload(kind, input);
  if (!result.ok) throw new ProtocolValidationError(kind, result.issues);
}

export const validateMatchBootstrapWire = (
  input: unknown,
): ProtocolValidationResult<MatchBootstrap> => (
  validateProtocolPayload('MATCH_BOOTSTRAP', input)
);

export const validateIntentEnvelopeWire = (
  input: unknown,
): ProtocolValidationResult<IntentEnvelope> => (
  validateProtocolPayload('INTENT_ENVELOPE', input)
);

export const validateFramedEventWire = (
  input: unknown,
): ProtocolValidationResult<FramedEvent> => (
  validateProtocolPayload('FRAMED_EVENT', input)
);

export const validateCommittedTransactionWire = (
  input: unknown,
): ProtocolValidationResult<CommittedTransactionRecord> => (
  validateProtocolPayload('COMMITTED_TRANSACTION', input)
);

export const validateSeatMatchSnapshotWire = (
  input: unknown,
): ProtocolValidationResult<SeatMatchSnapshot> => (
  validateProtocolPayload('SEAT_MATCH_SNAPSHOT', input)
);

export const validateSeatCommittedTransactionWire = (
  input: unknown,
): ProtocolValidationResult<SeatCommittedTransaction> => (
  validateProtocolPayload('SEAT_COMMITTED_TRANSACTION', input)
);

export const validateSeatResyncRequestWire = (
  input: unknown,
): ProtocolValidationResult<SeatResyncRequest> => (
  validateProtocolPayload('SEAT_RESYNC_REQUEST', input)
);

export const validateSeatResyncResponseWire = (
  input: unknown,
): ProtocolValidationResult<SeatResyncResponse> => (
  validateProtocolPayload('SEAT_RESYNC_RESPONSE', input)
);
