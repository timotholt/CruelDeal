import Ajv2020, {
  type ErrorObject,
  type ValidateFunction,
} from 'ajv/dist/2020.js';

import authoritySchema from '../../../protocol/schema/cruel-deal-authority-record-v2.schema.json';
import playerWireSchema from '../../../protocol/schema/cruel-deal-player-wire-v2.schema.json';
import type { CanonicalFrame } from '../engine/types/timeline';
import type {
  CommittedTransactionRecord,
  IntentEnvelope,
  MatchBootstrap,
} from '../runtime/contracts';
import type {
  SeatMatchSnapshot,
  SeatPresentationBlock,
} from '../runtime/projection';
import type {
  SeatBlockAck,
  SeatCommandEnvelope,
  SeatResyncRequest,
  SeatResyncResponse,
} from './playerWire';

export const AUTHORITY_PROTOCOL_VERSION = 2 as const;
export const PLAYER_WIRE_PROTOCOL_VERSION = 2 as const;

export type AuthorityContractKind =
  | 'MATCH_BOOTSTRAP'
  | 'INTENT_ENVELOPE'
  | 'CANONICAL_FRAME'
  | 'COMMITTED_TRANSACTION';

export type PlayerWireContractKind =
  | 'SEAT_MATCH_SNAPSHOT'
  | 'SEAT_PRESENTATION_BLOCK'
  | 'SEAT_COMMAND_ENVELOPE'
  | 'SEAT_BLOCK_ACK'
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

export interface AuthorityRecordMessage {
  readonly protocolVersion: typeof AUTHORITY_PROTOCOL_VERSION;
  readonly kind: Exclude<AuthorityContractKind, 'INTENT_ENVELOPE'>;
  readonly payload: unknown;
}

export interface PlayerWireMessage {
  readonly protocolVersion: typeof PLAYER_WIRE_PROTOCOL_VERSION;
  readonly kind: PlayerWireContractKind;
  readonly payload: unknown;
}

export class ProtocolValidationError extends Error {
  readonly family: 'AUTHORITY' | 'PLAYER_WIRE';
  readonly kind: AuthorityContractKind | PlayerWireContractKind;
  readonly issues: readonly ProtocolValidationIssue[];

  constructor(
    family: 'AUTHORITY' | 'PLAYER_WIRE',
    kind: AuthorityContractKind | PlayerWireContractKind,
    issues: readonly ProtocolValidationIssue[],
  ) {
    super(
      `${kind} violates Cruel Deal ${family.toLowerCase()} protocol v2:\n`
      + issues.map(issue => `- ${issue.path || '/'}: ${issue.message}`).join('\n'),
    );
    this.name = 'ProtocolValidationError';
    this.family = family;
    this.kind = kind;
    this.issues = issues;
  }
}

function ajv(): Ajv2020 {
  return new Ajv2020({
    allErrors: true,
    strict: true,
    validateFormats: false,
  });
}

const authorityAjv = ajv();
const playerWireAjv = ajv();
const validateAuthorityMessage = authorityAjv.compile(authoritySchema);
const validatePlayerMessage = playerWireAjv.compile(playerWireSchema);

const authoritySchemaNames: Record<AuthorityContractKind, string> = {
  MATCH_BOOTSTRAP: 'MatchBootstrap',
  INTENT_ENVELOPE: 'IntentEnvelope',
  CANONICAL_FRAME: 'CanonicalFrame',
  COMMITTED_TRANSACTION: 'CommittedTransaction',
};
const playerSchemaNames: Record<PlayerWireContractKind, string> = {
  SEAT_MATCH_SNAPSHOT: 'SeatMatchSnapshot',
  SEAT_PRESENTATION_BLOCK: 'SeatPresentationBlock',
  SEAT_COMMAND_ENVELOPE: 'SeatCommandEnvelope',
  SEAT_BLOCK_ACK: 'SeatBlockAck',
  SEAT_RESYNC_REQUEST: 'SeatResyncRequest',
  SEAT_RESYNC_RESPONSE: 'SeatResyncResponse',
};

function compilePayloads<K extends string>(
  compiler: Ajv2020,
  schema: { readonly $id: string },
  names: Record<K, string>,
): Record<K, ValidateFunction> {
  return Object.fromEntries(
    Object.entries(names).map(([kind, schemaName]) => [
      kind,
      compiler.compile({ $ref: `${schema.$id}#/$defs/${schemaName}` }),
    ]),
  ) as Record<K, ValidateFunction>;
}

const authorityPayloadValidators = compilePayloads(
  authorityAjv,
  authoritySchema,
  authoritySchemaNames,
);
const playerPayloadValidators = compilePayloads(
  playerWireAjv,
  playerWireSchema,
  playerSchemaNames,
);

function payloadPath(error: ErrorObject): string {
  let path = error.instancePath.startsWith('/payload')
    ? error.instancePath.slice('/payload'.length)
    : error.instancePath;
  if (error.keyword === 'required') {
    const missing = (error.params as { readonly missingProperty?: string })
      .missingProperty;
    if (missing) path = `${path}/${missing}`;
  }
  return path || '/';
}

function normalizeIssues(
  errors: readonly ErrorObject[] | null | undefined,
): readonly ProtocolValidationIssue[] {
  return Object.freeze((errors ?? []).map(error => Object.freeze({
    path: payloadPath(error),
    keyword: error.keyword,
    message: error.message ?? 'schema validation failed',
    schemaPath: error.schemaPath,
  })));
}

function validateWith<T>(
  validator: ValidateFunction,
  input: unknown,
): ProtocolValidationResult<T> {
  if (validator(input)) return { ok: true, value: input as T };
  return { ok: false, issues: normalizeIssues(validator.errors) };
}

export function validateAuthorityPayload<T>(
  kind: AuthorityContractKind,
  input: unknown,
): ProtocolValidationResult<T> {
  return validateWith(authorityPayloadValidators[kind], input);
}

export function validatePlayerWirePayload<T>(
  kind: PlayerWireContractKind,
  input: unknown,
): ProtocolValidationResult<T> {
  return validateWith(playerPayloadValidators[kind], input);
}

export function validateAuthorityRecordMessage(
  input: unknown,
): ProtocolValidationResult<AuthorityRecordMessage> {
  return validateWith(validateAuthorityMessage, input);
}

export function validatePlayerWireMessage(
  input: unknown,
): ProtocolValidationResult<PlayerWireMessage> {
  return validateWith(validatePlayerMessage, input);
}

export function assertAuthorityPayload(
  kind: AuthorityContractKind,
  input: unknown,
): void {
  const result = validateAuthorityPayload(kind, input);
  if (!result.ok) {
    throw new ProtocolValidationError('AUTHORITY', kind, result.issues);
  }
}

export function assertPlayerWirePayload(
  kind: PlayerWireContractKind,
  input: unknown,
): void {
  const result = validatePlayerWirePayload(kind, input);
  if (!result.ok) {
    throw new ProtocolValidationError('PLAYER_WIRE', kind, result.issues);
  }
}

export const validateMatchBootstrapWire = (
  input: unknown,
): ProtocolValidationResult<MatchBootstrap> => (
  validateAuthorityPayload('MATCH_BOOTSTRAP', input)
);

/** Local authority input until Slice 4 replaces it with SeatCommandEnvelope. */
export const validateInternalIntentEnvelope = (
  input: unknown,
): ProtocolValidationResult<IntentEnvelope> => (
  validateAuthorityPayload('INTENT_ENVELOPE', input)
);

export const validateCanonicalFrameWire = (
  input: unknown,
): ProtocolValidationResult<CanonicalFrame> => (
  validateAuthorityPayload('CANONICAL_FRAME', input)
);

export const validateCommittedTransactionWire = (
  input: unknown,
): ProtocolValidationResult<CommittedTransactionRecord> => (
  validateAuthorityPayload('COMMITTED_TRANSACTION', input)
);

export const validateSeatMatchSnapshotWire = (
  input: unknown,
): ProtocolValidationResult<SeatMatchSnapshot> => (
  validatePlayerWirePayload('SEAT_MATCH_SNAPSHOT', input)
);

export const validateSeatPresentationBlockWire = (
  input: unknown,
): ProtocolValidationResult<SeatPresentationBlock> => (
  validatePlayerWirePayload('SEAT_PRESENTATION_BLOCK', input)
);

export const validateSeatCommandEnvelopeWire = (
  input: unknown,
): ProtocolValidationResult<SeatCommandEnvelope> => (
  validatePlayerWirePayload('SEAT_COMMAND_ENVELOPE', input)
);

export const validateSeatBlockAckWire = (
  input: unknown,
): ProtocolValidationResult<SeatBlockAck> => (
  validatePlayerWirePayload('SEAT_BLOCK_ACK', input)
);

export const validateSeatResyncRequestWire = (
  input: unknown,
): ProtocolValidationResult<SeatResyncRequest> => (
  validatePlayerWirePayload('SEAT_RESYNC_REQUEST', input)
);

export const validateSeatResyncResponseWire = (
  input: unknown,
): ProtocolValidationResult<SeatResyncResponse> => (
  validatePlayerWirePayload('SEAT_RESYNC_RESPONSE', input)
);
