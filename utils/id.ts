/**
 * ID generation — the ONLY module in the app that calls `crypto.*` for id
 * purposes. All id creation goes through this wall so we can swap the
 * backing implementation (deterministic seeded RNG for the engine
 * refactor, fixed sequences for tests, pre-allocated pools if we ever
 * need them) without touching call sites.
 *
 * Public API:
 *   - `generateInstanceId()`  → UUID v7 (time-ordered, 36 chars)
 *   - `newIntentId()`         → UUID v4 (ephemeral, random, 36 chars)
 *   - `newShortId()`          → 7-char base36 (in-match card handles)
 *
 * Pick the right one:
 *   - Persisted / DB-indexable / sortable-by-time  → `generateInstanceId`
 *   - Client→server request correlation (intents)  → `newIntentId`
 *   - Ephemeral within a single match              → `newShortId`
 */

// ---- Crypto source -----------------------------------------------------

/**
 * Resolve the Web Crypto object. `self.crypto` in browsers & workers;
 * `globalThis.crypto` in Node 20+ (webcrypto). Thrown-once error if
 * neither is available so the failure is loud, not silent.
 */
function getCrypto(): Crypto {
  const c =
    (typeof self !== 'undefined' && (self as { crypto?: Crypto }).crypto) ||
    (typeof globalThis !== 'undefined' && (globalThis as { crypto?: Crypto }).crypto);
  if (!c) {
    throw new Error('[utils/id] Web Crypto API unavailable in this environment');
  }
  return c;
}

function randomBytes(n: number): Uint8Array {
  const buf = new Uint8Array(n);
  getCrypto().getRandomValues(buf);
  return buf;
}

function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, '0');
  return out;
}

// ---- Public API --------------------------------------------------------

/**
 * UUID v7 — RFC 9562, time-ordered. Sorts by generation time, great for
 * DB primary keys. Use for anything that persists (card instances,
 * profile records, log entries, match ids).
 */
export const generateInstanceId = (): string => {
  // 48-bit timestamp (ms since epoch) + 74 bits random + 6 bits version/variant.
  const tsHex = Date.now().toString(16).padStart(12, '0');
  const rnd = randomBytes(16);
  rnd[6] = (rnd[6] & 0x0f) | 0x70; // version = 7
  rnd[8] = (rnd[8] & 0x3f) | 0x80; // variant = RFC
  const hex = bytesToHex(rnd);
  return [
    tsHex.slice(0, 8),
    tsHex.slice(8, 12),
    hex.slice(12, 16), // includes version nibble
    hex.slice(16, 20), // includes variant nibble
    hex.slice(20, 32),
  ].join('-');
};

/**
 * UUID v4 — fully random, 36 chars. Use for ephemeral correlation ids:
 * intent ids (client→server request dedupe), span ids, request ids.
 * Not time-ordered; not a good DB PK. Cheap (~1-5µs).
 *
 * Prefers `crypto.randomUUID()` where available, falls back to manual
 * v4 assembly via `getRandomValues`. Single source for intent ids so a
 * later slice can swap in a deterministic / session-scoped scheme
 * without touching caller code.
 */
export const newIntentId = (): string => {
  const c = getCrypto();
  if (typeof c.randomUUID === 'function') return c.randomUUID();
  // Fallback: assemble a v4 from raw bytes.
  const b = randomBytes(16);
  b[6] = (b[6] & 0x0f) | 0x40; // version = 4
  b[8] = (b[8] & 0x3f) | 0x80; // variant = RFC
  const h = bytesToHex(b);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
};

/**
 * Short (7-char base36) id for in-match ephemera — card instance handles,
 * lane-slot refs, that kind of thing. Not a UUID; collision probability
 * is ~1 in 78 billion, which is fine for objects scoped to a single
 * match (hand size ≤ 7, lane capacity ≤ 12, total ≤ ~20 active).
 *
 * TODO(engine-refactor): when the engine becomes deterministic, this
 * will be replaced by `rng.uid()` derived from the match seed so
 * client-side prediction produces identical card ids to the server.
 * Same call-site, different backing — which is exactly why it lives
 * behind this wall.
 */
export const newShortId = (): string => {
  // 5 random bytes → 40 bits of entropy → ~7 base36 chars.
  const b = randomBytes(5);
  let n = 0;
  for (let i = 0; i < 5; i++) n = n * 256 + b[i];
  return n.toString(36).padStart(7, '0').slice(0, 7);
};