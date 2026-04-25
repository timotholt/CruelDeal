import { Show, onMount, onCleanup, createSignal } from 'solid-js';
import type { ResolvedCard, ResolvedLocation } from '@/services/playgame/view';
import type { LanePowerBreakdown } from '@/services/playgame/engine/projections';
import { LanePowerPanel } from './LanePowerPanel';
import { StatLogPanel } from './StatLogPanel';

interface ZoomInspectorProps {
  target: {
    kind: 'card';
    card: ResolvedCard;
    zone: 'hand' | 'board';
    side: 'local' | 'remote' | 'top' | 'bottom';
    laneIdx?: number;
    element: HTMLElement;
  } | {
    kind: 'location';
    location: ResolvedLocation;
    laneIdx: number;
    bottomPower: number;
    topPower: number;
    bottomBreakdown: LanePowerBreakdown;
    topBreakdown: LanePowerBreakdown;
    element: HTMLElement;
  };
  onClose: () => void;
}

export const ZoomInspector = (props: ZoomInspectorProps) => {
  let containerRef: HTMLDivElement | undefined;
  let cloneRef: HTMLDivElement | undefined;
  const [isClosing, setIsClosing] = createSignal(false);
  const [logKind, setLogKind] = createSignal<'power' | 'cost' | null>(null);
  const [laneLogSide, setLaneLogSide] = createSignal<'top' | 'bottom' | null>(null);

  const handleClose = () => {
    if (isClosing()) return;
    setIsClosing(true);

    const clone = cloneRef?.querySelector('.card-clone') as HTMLElement;
    if (clone) {
      // Reverse animation: restore to original position
      Object.assign(clone.style, {
        transform: `translate(0, 0) scale(1)`,
      });

      // Wait for animation to complete, then close
      setTimeout(() => {
        props.onClose();
      }, 200);
    } else {
      props.onClose();
    }
  };

  onMount(() => {
    if (!containerRef || !cloneRef) return;

    // Get original element's position and size
    const rect = props.target.element.getBoundingClientRect();
    const clone = props.target.element.cloneNode(true) as HTMLElement;

    // Position clone absolutely at original location — always full brightness in inspector
    clone.style.opacity = '1';
    clone.style.transition = 'none';
    clone.classList.add('card-clone');
    cloneRef.appendChild(clone);
    Object.assign(clone.style, {
      position: 'absolute',
      left: rect.left + 'px',
      top: rect.top + 'px',
      width: rect.width + 'px',
      height: rect.height + 'px',
      margin: '0',
      zIndex: '1000',
      transition: 'all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
      cursor: 'pointer',
      'pointer-events': 'auto',
    });

    // Click on cloned card/location: score opens logs; anything else closes
    clone.addEventListener('click', (e) => {
      e.stopPropagation();
      if (props.target.kind === 'location') {
        const scoreEl = (e.target as HTMLElement).closest('.lane-score') as HTMLElement | null;
        if (scoreEl?.classList.contains('enemy-score')) {
          setLaneLogSide((side) => side === 'top' ? null : 'top');
          return;
        }
        if (scoreEl?.classList.contains('player-score')) {
          setLaneLogSide((side) => side === 'bottom' ? null : 'bottom');
          return;
        }
        handleClose();
        return;
      }
      const el = e.target as HTMLElement;
      if (el.classList.contains('power')) { setLogKind(k => k === 'power' ? null : 'power'); return; }
      if (el.classList.contains('cost'))  { setLogKind(k => k === 'cost' ? null : 'cost'); return; }
      handleClose();
    });

    // Style power/cost as tappable when card inspector is open
    if (props.target.kind === 'card') {
      const powerEl = clone.querySelector('.power') as HTMLElement | null;
      const costEl  = clone.querySelector('.cost')  as HTMLElement | null;
      if (powerEl) { powerEl.style.cursor = 'pointer'; powerEl.title = 'Power log'; }
      if (costEl)  { costEl.style.cursor  = 'pointer'; costEl.title  = 'Cost log'; }
    } else {
      const scores = clone.querySelectorAll('.lane-score');
      scores.forEach((el) => {
        const scoreEl = el as HTMLElement;
        scoreEl.style.cursor = 'pointer';
        scoreEl.title = 'Score breakdown';
      });
    }

    // Force layout
    clone.offsetHeight;

    // Calculate transform to center and scale up
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const centerX = viewportWidth / 2;
    const centerY = viewportHeight / 2.5; // Shift up to account for text below

    // Different scale for locations vs cards
    const isLocation = props.target.kind === 'location';
    const targetHeight = isLocation ? viewportHeight * 0.25 : viewportHeight * 0.45;
    const scale = Math.min(targetHeight / rect.height, 3); // Cap scale at 3x to prevent huge elements

    // Translate to center
    const translateX = centerX - (rect.left + rect.width / 2);
    const translateY = centerY - (rect.top + rect.height / 2);

    requestAnimationFrame(() => {
      Object.assign(clone.style, {
        transform: `translate(${translateX}px, ${translateY}px) scale(${scale})`,
        transformOrigin: 'center center',
      });
    });

    // Dim board
    const board = document.querySelector('.board') as HTMLElement;
    if (board) {
      board.style.filter = 'brightness(0.15)';
    }

    // Handle escape key
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };

    // Container receives clicks that pass through cloneRef (pointer-events:none)
    const handleClick = () => handleClose();

    window.addEventListener('keydown', handleKeyDown);
    containerRef.addEventListener('click', handleClick);

    onCleanup(() => {
      window.removeEventListener('keydown', handleKeyDown);
      if (containerRef) {
        containerRef.removeEventListener('click', handleClick);
      }
      if (board) {
        board.style.filter = '';
      }
    });
  });

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
        'background-color': 'transparent',
        'z-index': '999',
      }}
    >
      <div
        ref={cloneRef}
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          'pointer-events': 'none',
        }}
      />

      {/* Text below card */}
      <Show when={props.target.kind === 'card' && !isClosing()}>
        <div
          style={{
            position: 'fixed',
            bottom: '20%',
            left: '50%',
            transform: 'translateX(-50%)',
            'max-width': '80vw',
            'text-align': 'center',
            color: 'white',
            'font-size': '0.9rem',
            'z-index': '1001',
            animation: 'fadeIn 0.4s ease-in 0.1s both',
            'text-decoration': (props.target as { kind: 'card'; card: ResolvedCard }).card?.textDisabled ? 'line-through' : 'none',
            'text-decoration-thickness': '2px',
            'text-decoration-color': 'rgba(255, 96, 128, 0.9)',
          }}
        >
          {(props.target as { kind: 'card'; card: ResolvedCard }).card?.text || '\u00a0'}
        </div>
      </Show>

      <Show when={props.target.kind === 'location' && laneLogSide()}>
        <LanePowerPanel
          breakdown={
            laneLogSide() === 'top'
              ? (props.target as {
                  kind: 'location';
                  topBreakdown: LanePowerBreakdown;
                  bottomBreakdown: LanePowerBreakdown;
                }).topBreakdown
              : (props.target as {
                  kind: 'location';
                  topBreakdown: LanePowerBreakdown;
                  bottomBreakdown: LanePowerBreakdown;
                }).bottomBreakdown
          }
          onClose={() => setLaneLogSide(null)}
        />
      </Show>

      <Show when={props.target.kind === 'card' && logKind()}>
        <StatLogPanel
          kind={logKind() as 'power' | 'cost'}
          basePower={(props.target as { kind: 'card'; card: ResolvedCard }).card.basePower}
          baseCost={(props.target as { kind: 'card'; card: ResolvedCard }).card.baseCost}
          powerLog={(props.target as { kind: 'card'; card: ResolvedCard }).card.powerLog}
          powerModifiers={(props.target as { kind: 'card'; card: ResolvedCard }).card.powerModifiers}
          costLog={(props.target as { kind: 'card'; card: ResolvedCard }).card.costLog}
          costHistory={(props.target as { kind: 'card'; card: ResolvedCard }).card.costHistory}
          onClose={() => setLogKind(null)}
        />
      </Show>
    </div>
  );
};
