/**
 * VfxHost — owns the VFXEngine instance and provides it via context.
 *
 * Renders a positioned `<div>` that becomes both:
 *   - the `boardWrap` anchor for imperative animations (flying card, reveal
 *     clone) — they append into it and position against its bounding rect.
 *   - the `root` for `VFXEngine`, which inserts an overlay canvas inside it.
 *
 * Also owns `cardRefs: Map<string, HTMLElement>` so animations can look up
 * a card's current DOM element by `instanceId`. Card components bind into
 * the map via the `bindCardRef(id)` helper.
 *
 * Usage:
 *   <VfxHost>
 *     <GameProvider>...</GameProvider>
 *   </VfxHost>
 *
 *   // Inside any descendant component:
 *   const { engine, boardRef, cardRefs, bindCardRef } = useVfx();
 */

import {
  createContext,
  createSignal,
  onCleanup,
  onMount,
  useContext,
  type JSX,
  type Accessor,
} from 'solid-js';
import { VFXEngine, vfxSfx } from '@/services/vfx';
import { cardVfxRegistry } from '@/services/vfx/card-effects/registry';
import type { ZoneAnchorKey } from '@/services/playgame/presentation/cardTransfers';

export interface VfxContextValue {
  /** The live engine once mounted (null until then). */
  engine: Accessor<VFXEngine | null>;
  /** The board container element (null until mounted). */
  boardRef: Accessor<HTMLElement | null>;
  /** Live map of card instanceId -> current DOM element. */
  cardRefs: Map<string, HTMLElement>;
  /** Live map of logical card zone anchor -> current DOM element. */
  zoneRefs: Map<ZoneAnchorKey, HTMLElement>;
  /**
   * Returns a Solid `ref` callback that registers the element under `id`
   * for the lifetime of the caller component. Usage:
   *   <div ref={bindCardRef(card.instanceId)}>...</div>
   */
  bindCardRef: (id: string) => (el: HTMLElement) => void;
  bindZoneRef: (key: ZoneAnchorKey) => (el: HTMLElement) => void;
}

const VfxCtx = createContext<VfxContextValue>();

export interface VfxHostProps {
  children: JSX.Element;
  /** Class applied to the container div the engine mounts onto. */
  class?: string;
  /** Id applied to the container div (legacy demo uses `boardWrap`). */
  id?: string;
}

export const VfxHost = (props: VfxHostProps) => {
  let boardEl: HTMLDivElement | undefined;
  const [engine, setEngine] = createSignal<VFXEngine | null>(null);
  const [board, setBoard] = createSignal<HTMLElement | null>(null);
  const cardRefs = new Map<string, HTMLElement>();
  const zoneRefs = new Map<ZoneAnchorKey, HTMLElement>();

  onMount(() => {
    if (!boardEl) return;
    setBoard(boardEl);
    const eng = new VFXEngine(boardEl, { sfx: vfxSfx });
    setEngine(eng);

    const tickInterval = setInterval(() => cardVfxRegistry.tick(Date.now()), 1000);

    onCleanup(() => {
      clearInterval(tickInterval);
      cardVfxRegistry.clearAll('screen-unmounted');
      eng.destroy();
      setEngine(null);
      setBoard(null);
    });
  });

  const bindCardRef = (id: string) => (el: HTMLElement) => {
    cardRefs.set(id, el);
    onCleanup(() => {
      // Only delete if the stored element is still ours (defensive against
      // the card re-mounting and overwriting the entry during unmount).
      if (cardRefs.get(id) === el) cardRefs.delete(id);
    });
  };

  const bindZoneRef = (key: ZoneAnchorKey) => (el: HTMLElement) => {
    zoneRefs.set(key, el);
    onCleanup(() => {
      if (zoneRefs.get(key) === el) zoneRefs.delete(key);
    });
  };

  const value: VfxContextValue = {
    engine,
    boardRef: board,
    cardRefs,
    zoneRefs,
    bindCardRef,
    bindZoneRef,
  };

  return (
    <VfxCtx.Provider value={value}>
      <div ref={boardEl} id={props.id} class={props.class ?? 'relative w-full h-full'}>
        {props.children}
      </div>
    </VfxCtx.Provider>
  );
};

export const useVfx = (): VfxContextValue => {
  const v = useContext(VfxCtx);
  if (!v) throw new Error('useVfx must be used inside <VfxHost>');
  return v;
};
