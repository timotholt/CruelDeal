import { Show, onMount, onCleanup, createSignal } from 'solid-js';
import type { ResolvedCard, ResolvedLocation } from '@/services/playgame/view';

interface ZoomInspectorProps {
  target: {
    kind: 'card';
    card: ResolvedCard;
    zone: 'hand' | 'board';
    side: 'player' | 'enemy';
    laneIdx?: number;
    element: HTMLElement;
  } | {
    kind: 'location';
    location: ResolvedLocation;
    laneIdx: number;
    playerPower: number;
    enemyPower: number;
    element: HTMLElement;
  };
  onClose: () => void;
}

export const ZoomInspector = (props: ZoomInspectorProps) => {
  let containerRef: HTMLDivElement | undefined;
  let cloneRef: HTMLDivElement | undefined;
  const [isClosing, setIsClosing] = createSignal(false);

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

    // Click on cloned card closes inspector
    clone.addEventListener('click', (e) => {
      e.stopPropagation();
      handleClose();
    });

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
            bottom: '10%',
            left: '50%',
            transform: 'translateX(-50%)',
            'max-width': '80vw',
            'text-align': 'center',
            color: 'white',
            'font-size': '0.9rem',
            'z-index': '1001',
            animation: 'fadeIn 0.4s ease-in 0.1s both',
          }}
        >
          {(props.target as { kind: 'card'; card: ResolvedCard }).card?.text || '\u00a0'}
        </div>
      </Show>
    </div>
  );
};
