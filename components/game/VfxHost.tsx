/**
 * VfxHost — owns the VFXEngine instance and provides it via context.
 *
 * Renders the fixed-frame root plus a dedicated `.play-vfx-layer`:
 *   - PlayMotionSurface converts viewport geometry into frame coordinates and
 *     owns every temporary flying/reveal node in that layer.
 *   - VFXEngine mounts against the frame root for its canvas effects.
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
  createMemo,
  createSignal,
  onCleanup,
  onMount,
  useContext,
  type JSX,
  type Accessor,
} from 'solid-js';
import { VFXEngine, vfxSfx } from '@/services/vfx';
import { createCardVfxRegistry } from '@/services/vfx/card-effects/registry';
import type { CardVfxRegistry } from '@/services/vfx/card-effects/types';
import {
  createPlayMotionSurface,
  type PlayMotionSurface,
} from '@/services/playgame/presentation/playMotionSurface';
import { createNativeTimelineDriverFactory } from '@/services/playgame/presentation/storyboard/waapiDriver';

export interface VfxContextValue {
  /** The live engine once mounted (null until then). */
  engine: Accessor<VFXEngine | null>;
  /** The board container element (null until mounted). */
  boardRef: Accessor<HTMLElement | null>;
  /** Canonical frame-relative mount and geometry adapter for /play motion. */
  motionSurface: Accessor<PlayMotionSurface | null>;
  /** Live map of card instanceId -> current DOM element. */
  cardRefs: Map<string, HTMLElement>;
  /** Card effects owned only by this mounted host. */
  cardVfxRegistry: CardVfxRegistry;
  /**
   * Returns a Solid `ref` callback that registers the element under `id`
   * for the lifetime of the caller component. Usage:
   *   <div ref={bindCardRef(card.instanceId)}>...</div>
   */
  bindCardRef: (id: string) => (el: HTMLElement) => void;
  bindZoneRef: (key: string) => (el: HTMLElement) => void;
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
  let overlayEl: HTMLDivElement | undefined;
  const [engine, setEngine] = createSignal<VFXEngine | null>(null);
  const [board, setBoard] = createSignal<HTMLElement | null>(null);
  const [overlay, setOverlay] = createSignal<HTMLElement | null>(null);
  const cardRefs = new Map<string, HTMLElement>();
  const cardVfxRegistry = createCardVfxRegistry();
  const motionSurface = createMemo<PlayMotionSurface | null>(() => {
    const frame = board();
    const motionOverlay = overlay();
    if (!frame || !motionOverlay) return null;
    return createPlayMotionSurface({
      frame,
      overlay: motionOverlay,
      cardRefs,
      // The fixed game frame can be adopted from a detached document during
      // Solid's render lifecycle. WAAPI must always use the live browser
      // document timeline or its animations remain pending forever.
      timelineDriverFactory: createNativeTimelineDriverFactory(document, window),
    });
  });

  onMount(() => {
    if (!boardEl) return;
    setBoard(boardEl);
    setOverlay(overlayEl ?? null);
    const eng = new VFXEngine(boardEl, { sfx: vfxSfx });
    setEngine(eng);

    const tickInterval = setInterval(() => cardVfxRegistry.tick(Date.now()), 1000);

    onCleanup(() => {
      clearInterval(tickInterval);
      cardVfxRegistry.dispose();
      motionSurface()?.dispose();
      eng.destroy();
      setEngine(null);
      setBoard(null);
      setOverlay(null);
    });
  });

  const bindCardRef = (id: string) => (el: HTMLElement) => {
    el.dataset.playMotionCard = id;
    cardRefs.set(id, el);
    onCleanup(() => {
      // Only delete if the stored element is still ours (defensive against
      // the card re-mounting and overwriting the entry during unmount).
      if (cardRefs.get(id) === el) cardRefs.delete(id);
    });
  };

  const bindZoneRef = (key: string) => (el: HTMLElement) => {
    // Logical zones are permanent authored DOM surfaces. Keep their identity
    // on the element itself so geometry lookup cannot be invalidated by a
    // stale imperative ref registry while the element remains mounted.
    el.dataset.playMotionZone = key;
  };

  const value: VfxContextValue = {
    engine,
    boardRef: board,
    motionSurface,
    cardRefs,
    cardVfxRegistry,
    bindCardRef,
    bindZoneRef,
  };

  return (
    <VfxCtx.Provider value={value}>
      <div
        ref={element => {
          boardEl = element;
          setBoard(element);
        }}
        id={props.id}
        class={props.class ?? 'relative w-full h-full'}
      >
        {props.children}
        <div
          data-play-motion-zone="generated"
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: '48px',
            height: '68px',
            visibility: 'hidden',
            'pointer-events': 'none',
          }}
        />
        <div
          ref={element => {
            overlayEl = element;
            setOverlay(element);
          }}
          class="play-vfx-layer"
          data-play-vfx-layer
          aria-hidden="true"
        />
      </div>
    </VfxCtx.Provider>
  );
};

export const useVfx = (): VfxContextValue => {
  const v = useContext(VfxCtx);
  if (!v) throw new Error('useVfx must be used inside <VfxHost>');
  return v;
};
