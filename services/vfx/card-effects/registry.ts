import type {
  CardTransientVfx,
  CardPersistentVfxGroup,
  CardVfxRenderModel,
  CardVfxRegistry,
  CreateTransientVfxRequest,
  CardPersistentFxSource,
  VfxClearReason,
} from './types';

const GRACE_MS = 120;

let _counter = 0;
const uid = () => `vfx-${++_counter}-${Date.now()}`;

type CardState = {
  transient: Map<string, CardTransientVfx>;
  persistent: Map<string, CardPersistentVfxGroup>;
  listeners: Set<() => void>;
};

const cards = new Map<string, CardState>();
const dedupeKeys = new Map<string, number>();

function getOrCreate(cardId: string): CardState {
  let s = cards.get(cardId);
  if (!s) {
    s = { transient: new Map(), persistent: new Map(), listeners: new Set() };
    cards.set(cardId, s);
  }
  return s;
}

function notify(cardId: string): void {
  cards.get(cardId)?.listeners.forEach((fn) => fn());
}

function removeTransient(cardId: string, id: string): void {
  const s = cards.get(cardId);
  if (!s) return;
  s.transient.delete(id);
  notify(cardId);
}

export const cardVfxRegistry: CardVfxRegistry = {
  createTransient(request: CreateTransientVfxRequest): string | null {
    const {
      cardId,
      eventType,
      channel,
      className,
      vars = {},
      durationMs,
      exitDurationMs = 0,
      priority = 0,
      dedupeKey,
    } = request;

    const now = Date.now();

    if (dedupeKey) {
      const last = dedupeKeys.get(dedupeKey);
      if (last && now - last < 100) return null;
      dedupeKeys.set(dedupeKey, now);
    }

    const id = uid();
    const cleanupAtMs = now + durationMs + exitDurationMs + GRACE_MS;

    const record: CardTransientVfx = {
      id,
      cardId,
      source: { kind: 'event', eventType },
      channel,
      className,
      vars,
      priority,
      createdAtMs: now,
      durationMs,
      exitDurationMs,
      cleanupAtMs,
      phase: 'entering',
    };

    const s = getOrCreate(cardId);
    s.transient.set(id, record);
    notify(cardId);

    // Safety cleanup timeout — never rely solely on animationend
    setTimeout(() => removeTransient(cardId, id), durationMs + exitDurationMs + GRACE_MS + 50);

    return id;
  },

  reconcilePersistent(cardId: string, sources: CardPersistentFxSource[]): void {
    const s = getOrCreate(cardId);
    const now = Date.now();

    const byKind = new Map<string, CardPersistentFxSource[]>();
    for (const src of sources) {
      const list = byKind.get(src.kind) ?? [];
      list.push(src);
      byKind.set(src.kind, list);
    }

    const nextIds = new Set<string>();

    for (const [kind, kindSources] of byKind) {
      const groupId = `card:${cardId}:persistent:ongoing:${kind}`;
      nextIds.add(groupId);
      const existing = s.persistent.get(groupId);

      const fx = kindSources;
      const renderMode = kindSources.length <= 2 ? 'stacked' : 'aggregated';
      const vars: Record<string, string> = {
        '--card-fx-count': String(kindSources.length),
        '--card-fx-intensity': String(kindSources.reduce((a, b) => a + (b.intensity ?? 1), 0)),
      };
      if (kindSources[0]?.palette) {
        vars['--card-fx-primary'] = kindSources[0].palette.primary;
        if (kindSources[0].palette.secondary) vars['--card-fx-secondary'] = kindSources[0].palette.secondary;
        if (kindSources[0].palette.accent) vars['--card-fx-accent'] = kindSources[0].palette.accent;
      }

      if (existing) {
        s.persistent.set(groupId, {
          ...existing,
          sources: fx.map((src) => ({
            sourceId: src.sourceId,
            visualKind: src.kind,
            intensity: src.intensity ?? 1,
            priority: src.priority ?? 0,
            palette: src.palette,
          })),
          renderMode,
          vars,
          phase: 'active',
          updatedAtMs: now,
          exitStartedAtMs: undefined,
          cleanupAtMs: undefined,
        });
      } else {
        const group: CardPersistentVfxGroup = {
          id: groupId,
          cardId,
          groupKind: 'ongoing',
          visualKind: kind,
          sources: fx.map((src) => ({
            sourceId: src.sourceId,
            visualKind: src.kind,
            intensity: src.intensity ?? 1,
            priority: src.priority ?? 0,
            palette: src.palette,
          })),
          renderMode,
          vars,
          phase: 'active',
          createdAtMs: now,
          updatedAtMs: now,
        };
        s.persistent.set(groupId, group);
      }
    }

    const EXIT_MS = 400;
    for (const [id, group] of s.persistent) {
      if (!nextIds.has(id) && group.phase === 'active') {
        s.persistent.set(id, {
          ...group,
          phase: 'exiting',
          exitStartedAtMs: now,
          cleanupAtMs: now + EXIT_MS + GRACE_MS,
        });
        setTimeout(() => {
          const st = cards.get(cardId);
          if (st) {
            st.persistent.delete(id);
            notify(cardId);
          }
        }, EXIT_MS + GRACE_MS + 50);
      }
    }

    notify(cardId);
  },

  complete(recordId: string): void {
    for (const [cardId, s] of cards) {
      if (s.transient.has(recordId)) {
        removeTransient(cardId, recordId);
        return;
      }
    }
  },

  clearCard(cardId: string, _reason: VfxClearReason): void {
    const s = cards.get(cardId);
    if (!s) return;
    s.transient.clear();
    s.persistent.clear();
    notify(cardId);
  },

  clearAll(_reason: VfxClearReason): void {
    for (const [cardId, s] of cards) {
      s.transient.clear();
      s.persistent.clear();
      notify(cardId);
    }
  },

  getLayers(cardId: string): CardVfxRenderModel {
    const s = cards.get(cardId);
    if (!s) return { transient: [], persistent: [] };
    return {
      transient: Array.from(s.transient.values()),
      persistent: Array.from(s.persistent.values()),
    };
  },

  subscribe(cardId: string, listener: () => void): () => void {
    const s = getOrCreate(cardId);
    s.listeners.add(listener);
    return () => s.listeners.delete(listener);
  },

  tick(nowMs: number): void {
    for (const [cardId, s] of cards) {
      let changed = false;
      for (const [id, rec] of s.transient) {
        if (rec.cleanupAtMs <= nowMs) {
          s.transient.delete(id);
          changed = true;
        }
      }
      for (const [id, grp] of s.persistent) {
        if (grp.cleanupAtMs && grp.cleanupAtMs <= nowMs) {
          s.persistent.delete(id);
          changed = true;
        }
      }
      if (changed) notify(cardId);
    }
  },
};
