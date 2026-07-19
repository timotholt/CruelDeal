import type { Deck, Manifest, MatchRuleset } from '../engine/manifest/types';
import type { Seat } from '../engine/types/ids';
import { getCardTemplate } from '../engine/projections/cardTemplate';
import { getLocationTemplate } from '../engine/projections/locationTemplate';
import { validateMatchBootstrapWire } from '../protocol';
import type {
  LocationCardDeckEntry,
  LocationDeckBootstrap,
  MatchBootstrap,
  MatchBootstrapValidationIssue,
  MatchBootstrapValidationResult,
  MatchDeckBootstrap,
  MatchParticipantBootstrap,
  ValidatedMatchBootstrap,
} from './contracts';

const SEATS = ['P0', 'P1'] as const satisfies readonly Seat[];

function rightRotate(value: number, amount: number): number {
  return (value >>> amount) | (value << (32 - amount));
}

/** Browser-safe synchronous SHA-256 for the small canonical deck payload. */
function sha256(value: string): string {
  const input = new TextEncoder().encode(value);
  const paddedLength = Math.ceil((input.length + 9) / 64) * 64;
  const bytes = new Uint8Array(paddedLength);
  bytes.set(input);
  bytes[input.length] = 0x80;

  const bitLength = input.length * 8;
  const view = new DataView(bytes.buffer);
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x100000000));
  view.setUint32(paddedLength - 4, bitLength >>> 0);

  const constants = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
    0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
    0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
    0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
    0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
    0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];
  const hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];
  const words = new Uint32Array(64);

  for (let offset = 0; offset < bytes.length; offset += 64) {
    for (let i = 0; i < 16; i++) words[i] = view.getUint32(offset + i * 4);
    for (let i = 16; i < 64; i++) {
      const w15 = words[i - 15];
      const w2 = words[i - 2];
      const s0 = rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3);
      const s1 = rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10);
      words[i] = (words[i - 16] + s0 + words[i - 7] + s1) >>> 0;
    }

    let [a, b, c, d, e, f, g, h] = hash;
    for (let i = 0; i < 64; i++) {
      const sum1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      const choose = (e & f) ^ (~e & g);
      const temp1 = (h + sum1 + choose + constants[i] + words[i]) >>> 0;
      const sum0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (sum0 + majority) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }
    hash[0] = (hash[0] + a) >>> 0;
    hash[1] = (hash[1] + b) >>> 0;
    hash[2] = (hash[2] + c) >>> 0;
    hash[3] = (hash[3] + d) >>> 0;
    hash[4] = (hash[4] + e) >>> 0;
    hash[5] = (hash[5] + f) >>> 0;
    hash[6] = (hash[6] + g) >>> 0;
    hash[7] = (hash[7] + h) >>> 0;
  }

  return hash.map((word) => word.toString(16).padStart(8, '0')).join('');
}

/** Hashes entry order and the selected variant, using a versioned encoding. */
export function computeDeckContentHash(entries: Deck): string {
  const canonical = JSON.stringify([
    'playgame-deck-entries-v1',
    entries.map((entry) => [entry.defId, entry.variantId ?? null]),
  ]);
  return `sha256:${sha256(canonical)}`;
}

/** Hashes the exact system-owned location draw order and policy version. */
export function computeLocationDeckContentHash(
  entries: readonly LocationCardDeckEntry[],
): string {
  const canonical = JSON.stringify([
    'playgame-location-deck-entries-v1',
    entries.map((entry) => [entry.defId]),
  ]);
  return `sha256:${sha256(canonical)}`;
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
}

function validateDeckContents(
  deck: MatchDeckBootstrap,
  seat: Seat,
  manifest: Manifest,
  ruleset: MatchRuleset | undefined,
  issues: MatchBootstrapValidationIssue[],
): void {
  const path = `decks.${seat}.entries`;
  if (deck.entries.length !== manifest.constants.deckSize) {
    issues.push({
      code: 'INVALID_DECK_SIZE',
      path,
      message: `deck must contain exactly ${manifest.constants.deckSize} entries; received ${deck.entries.length}`,
      seat,
    });
  }

  const globallyDisabled = new Set(manifest.disabled.cards);
  const rulesetEnabled = ruleset?.enabledCardDefIds
    ? new Set(ruleset.enabledCardDefIds)
    : null;
  const counts = new Map<string, number>();

  deck.entries.forEach((entry, entryIndex) => {
    const def = getCardTemplate(manifest, entry.defId);
    if (!def) {
      issues.push({
        code: getLocationTemplate(manifest, entry.defId)
          ? 'LOCATION_CARD_IN_PLAYER_DECK'
          : 'UNKNOWN_CARD_DEFINITION',
        path: `${path}.${entryIndex}.defId`,
        message: getLocationTemplate(manifest, entry.defId)
          ? `location card definition "${entry.defId}" cannot enter player deck ${seat}`
          : `unknown card definition "${entry.defId}"`,
        seat,
        entryIndex,
      });
      return;
    }
    if (globallyDisabled.has(entry.defId) || (rulesetEnabled && !rulesetEnabled.has(entry.defId))) {
      issues.push({
        code: 'DISABLED_CARD_DEFINITION',
        path: `${path}.${entryIndex}.defId`,
        message: `card definition "${entry.defId}" is disabled for ruleset "${ruleset?.rulesetId ?? ''}"`,
        seat,
        entryIndex,
      });
    }
    if (entry.variantId !== undefined) {
      const variantExists = def.variantIds.includes(entry.variantId);
      if (!variantExists) {
        issues.push({
          code: 'UNKNOWN_CARD_VARIANT',
          path: `${path}.${entryIndex}.variantId`,
          message: `unknown variant "${entry.variantId}" for card definition "${entry.defId}"`,
          seat,
          entryIndex,
        });
      }
    }
    counts.set(entry.defId, (counts.get(entry.defId) ?? 0) + 1);
  });

  if (ruleset) {
    const unique = new Set(ruleset.deckConstruction.uniqueCardDefIds ?? []);
    for (const [defId, count] of counts) {
      if (unique.has(defId) && count > 1) {
        issues.push({
          code: 'UNIQUENESS_RULE_VIOLATION',
          path,
          message: `card definition "${defId}" is unique but appears ${count} times`,
          seat,
        });
        continue;
      }
      const copyLimit = ruleset.deckConstruction.copyLimits?.[defId]
        ?? ruleset.deckConstruction.defaultCopyLimit;
      if (copyLimit !== undefined && count > copyLimit) {
        issues.push({
          code: 'COPY_LIMIT_EXCEEDED',
          path,
          message: `card definition "${defId}" appears ${count} times; limit is ${copyLimit}`,
          seat,
        });
      }
    }
  }

  const computedHash = computeDeckContentHash(deck.entries);
  if (computedHash !== deck.contentHash) {
    issues.push({
      code: 'CONTENT_HASH_MISMATCH',
      path: `decks.${seat}.contentHash`,
      message: `content hash mismatch; expected ${computedHash}`,
      seat,
    });
  }
}

function validateLocationDeckContents(
  deck: LocationDeckBootstrap,
  manifest: Manifest,
  ruleset: MatchRuleset | undefined,
  issues: MatchBootstrapValidationIssue[],
): void {
  const path = 'decks.LOCATIONS.entries';
  if (ruleset) {
    const minimumSize = ruleset.laneRules.initialLaneCount
      + ruleset.locationDeck.minimumReserveCount;
    if (deck.entries.length < minimumSize) {
      issues.push({
        code: 'INVALID_LOCATION_DECK_SIZE',
        path,
        message: `location deck must contain at least ${minimumSize} entries; received ${deck.entries.length}`,
      });
    }
  }

  const globallyDisabled = new Set(manifest.disabled.locations);
  const rulesetEnabled = ruleset?.enabledLocationDefIds
    ? new Set(ruleset.enabledLocationDefIds)
    : null;
  const counts = new Map<string, number>();

  deck.entries.forEach((entry, entryIndex) => {
    const definition = getLocationTemplate(manifest, entry.defId);
    if (!definition) {
      issues.push({
        code: getCardTemplate(manifest, entry.defId)
          ? 'PLAYER_CARD_IN_LOCATION_DECK'
          : 'UNKNOWN_LOCATION_DEFINITION',
        path: `${path}.${entryIndex}.defId`,
        message: getCardTemplate(manifest, entry.defId)
          ? `player card definition "${entry.defId}" cannot enter the location deck`
          : `unknown location card definition "${entry.defId}"`,
        entryIndex,
      });
      return;
    }
    if (
      globallyDisabled.has(entry.defId)
      || (rulesetEnabled && !rulesetEnabled.has(entry.defId))
    ) {
      issues.push({
        code: 'DISABLED_LOCATION_DEFINITION',
        path: `${path}.${entryIndex}.defId`,
        message: `location card definition "${entry.defId}" is disabled for ruleset "${ruleset?.rulesetId ?? ''}"`,
        entryIndex,
      });
    }
    counts.set(entry.defId, (counts.get(entry.defId) ?? 0) + 1);
  });

  if (ruleset) {
    for (const [defId, count] of counts) {
      if (count > ruleset.locationDeck.copyLimit) {
        issues.push({
          code: ruleset.locationDeck.copyLimit === 1
            ? 'UNIQUENESS_RULE_VIOLATION'
            : 'COPY_LIMIT_EXCEEDED',
          path,
          message: `location card definition "${defId}" appears ${count} times; limit is ${ruleset.locationDeck.copyLimit}`,
        });
      }
    }
  }

  const computedHash = computeLocationDeckContentHash(deck.entries);
  if (computedHash !== deck.contentHash) {
    issues.push({
      code: 'CONTENT_HASH_MISMATCH',
      path: 'decks.LOCATIONS.contentHash',
      message: `location deck content hash mismatch; expected ${computedHash}`,
    });
  }
}

function cloneBootstrap(bootstrap: MatchBootstrap): MatchBootstrap {
  const cloneParticipant = (participant: MatchParticipantBootstrap): MatchParticipantBootstrap => ({
    participantId: participant.participantId,
    controller: participant.controller,
    displayName: participant.displayName,
    ...(participant.avatarId === undefined ? {} : { avatarId: participant.avatarId }),
  });
  const cloneDeck = (deck: MatchDeckBootstrap): MatchDeckBootstrap => ({
    kind: 'PLAYER',
    deckId: deck.deckId,
    revision: deck.revision,
    name: deck.name,
    entries: deck.entries.map((entry) => ({
      defId: entry.defId,
      ...(entry.variantId === undefined ? {} : { variantId: entry.variantId }),
    })),
    contentHash: deck.contentHash,
  });
  const cloneLocationDeck = (
    deck: LocationDeckBootstrap,
  ): LocationDeckBootstrap => ({
    kind: 'LOCATION',
    order: 'PRESERVE',
    deckId: deck.deckId,
    revision: deck.revision,
    name: deck.name,
    entries: deck.entries.map((entry) => ({ defId: entry.defId })),
    contentHash: deck.contentHash,
  });

  return {
    matchId: bootstrap.matchId,
    mode: bootstrap.mode,
    seed: bootstrap.seed,
    rulesetId: bootstrap.rulesetId,
    manifestVersion: bootstrap.manifestVersion,
    viewerSeat: bootstrap.viewerSeat,
    participants: {
      P0: cloneParticipant(bootstrap.participants.P0),
      P1: cloneParticipant(bootstrap.participants.P1),
    },
    decks: {
      P0: cloneDeck(bootstrap.decks.P0),
      P1: cloneDeck(bootstrap.decks.P1),
      LOCATIONS: cloneLocationDeck(bootstrap.decks.LOCATIONS),
    },
  };
}

/**
 * Validates local structural bootstrap data only. Collection possession and
 * ownership checks deliberately remain outside this boundary.
 */
export function validateMatchBootstrap(
  input: unknown,
  manifest: Manifest,
): MatchBootstrapValidationResult {
  const wire = validateMatchBootstrapWire(input);
  if (!wire.ok) {
    return {
      ok: false,
      issues: deepFreeze(wire.issues.map((issue) => ({
        code: 'INVALID_BOOTSTRAP_SHAPE' as const,
        path: issue.path,
        message: `${issue.keyword}: ${issue.message}`,
      }))),
    };
  }

  const bootstrap = wire.value;
  const issues: MatchBootstrapValidationIssue[] = [];

  if (bootstrap.manifestVersion !== manifest.version) {
    issues.push({
      code: 'MANIFEST_VERSION_MISMATCH',
      path: 'manifestVersion',
      message: `manifest version ${bootstrap.manifestVersion} does not match ${manifest.version}`,
    });
  }
  const ruleset = manifest.rulesets[bootstrap.rulesetId];
  if (!ruleset) {
    issues.push({
      code: 'UNKNOWN_RULESET',
      path: 'rulesetId',
      message: `unknown ruleset "${bootstrap.rulesetId}"`,
    });
  }
  for (const seat of SEATS) {
    validateDeckContents(bootstrap.decks[seat], seat, manifest, ruleset, issues);
  }
  validateLocationDeckContents(
    bootstrap.decks.LOCATIONS,
    manifest,
    ruleset,
    issues,
  );

  if (issues.length > 0) {
    return { ok: false, issues: deepFreeze(issues) };
  }

  const copied = cloneBootstrap(bootstrap);
  return {
    ok: true,
    value: deepFreeze(copied) as ValidatedMatchBootstrap,
  };
}
