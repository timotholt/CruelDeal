import { Show, onMount, onCleanup, createSignal, createMemo } from 'solid-js';
import type { ResolvedCard, ResolvedLocation } from '@/services/playgame/view';
import type { SeatLanePowerReadModel } from '@/services/playgame/runtime/seatReadModels';
import {
  cardSurfaceModel,
  laneVisualModel,
} from '@/services/playgame/presentation/appearance';
import { CardRenderer } from './play/rendering/CardRenderer';
import { LocationRenderer } from './play/rendering/LocationRenderer';
import { hitTestCardSurface } from '@/components/game-surfaces/card/cardSurfaceRuntime';
import { LanePowerPanel } from './LanePowerPanel';
import { StatLogPanel } from './StatLogPanel';

interface CardInspectorTarget {
  readonly kind: 'card';
  readonly card: ResolvedCard;
  readonly zone: 'hand' | 'board';
  readonly side: 'local' | 'remote' | 'top' | 'bottom';
  readonly laneIdx?: number;
  readonly element: HTMLElement;
}

interface LocationInspectorTarget {
  readonly kind: 'location';
  readonly location: ResolvedLocation;
  readonly laneIdx: number;
  readonly bottomPower: number;
  readonly topPower: number;
  readonly bottomBreakdown: SeatLanePowerReadModel;
  readonly topBreakdown: SeatLanePowerReadModel;
  readonly element: HTMLElement;
}

interface ZoomInspectorProps {
  readonly target: CardInspectorTarget | LocationInspectorTarget;
  readonly onClose: () => void;
}

export const ZoomInspector = (props: ZoomInspectorProps) => {
  let containerRef: HTMLDivElement | undefined;
  let surfaceRef: HTMLDivElement | undefined;
  const [isClosing, setIsClosing] = createSignal(false);
  const [showCardText, setShowCardText] = createSignal(false);
  const [logKind, setLogKind] = createSignal<'power' | 'cost' | null>(null);
  const [laneLogSide, setLaneLogSide] = createSignal<'top' | 'bottom' | null>(null);
  const [cardTextStyle, setCardTextStyle] = createSignal<Record<string, string>>({});
  const cardModel = createMemo(() => props.target.kind === 'card'
    ? cardSurfaceModel(props.target.card)
    : null);
  const laneModel = createMemo(() => props.target.kind === 'location'
    ? laneVisualModel(props.target.location, props.target.topPower, props.target.bottomPower)
    : null);

  const handleClose = (): void => {
    if (isClosing()) return;
    setIsClosing(true);
    setShowCardText(false);
    const surface = surfaceRef;
    if (!surface) {
      props.onClose();
      return;
    }
    surface.style.transform = 'translate(0, 0) scale(1)';
    window.setTimeout(props.onClose, 200);
  };

  const handleSurfaceClick = (event: MouseEvent): void => {
    event.stopPropagation();
    const target = event.target as HTMLElement;
    if (props.target.kind === 'location') {
      const score = target.closest<HTMLElement>('[data-lane-score]')?.dataset.laneScore;
      if (score === 'top' || score === 'bottom') {
        setLaneLogSide(current => current === score ? null : score);
        return;
      }
      handleClose();
      return;
    }

    const surface = surfaceRef;
    const model = cardModel();
    if (!surface || !model) return;
    const rect = surface.getBoundingClientRect();
    const hit = hitTestCardSurface(model, {
      x: (event.clientX - rect.left) * 500 / rect.width,
      y: (event.clientY - rect.top) * 700 / rect.height,
    });
    if (hit?.part === 'power' && props.target.card.type !== 'spell') {
      setLogKind(current => current === 'power' ? null : 'power');
      return;
    }
    if (hit?.part === 'cost') {
      setLogKind(current => current === 'cost' ? null : 'cost');
      return;
    }
    handleClose();
  };

  onMount(() => {
    const container = containerRef;
    const surface = surfaceRef;
    if (!container || !surface) return;

    const rect = props.target.element.getBoundingClientRect();
    Object.assign(surface.style, {
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
    });

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const centerX = viewportWidth / 2;
    const centerY = viewportHeight / 2.5;
    const targetHeight = props.target.kind === 'location'
      ? viewportHeight * 0.25
      : viewportHeight * 0.45;
    const scale = Math.min(targetHeight / rect.height, 3);
    const translateX = centerX - (rect.left + rect.width / 2);
    const translateY = centerY - (rect.top + rect.height / 2);
    const finalSurfaceBottom = centerY + (rect.height * scale) / 2;
    const safeHeight = Math.min(viewportHeight, viewportWidth * 16 / 9);
    const safeWidth = Math.min(viewportWidth, viewportHeight * 9 / 16);
    const safeTop = (viewportHeight - safeHeight) / 2;
    const safeBottom = safeTop + safeHeight;
    const textTop = Math.min(finalSurfaceBottom + 24, safeBottom - 112);
    const textMaxHeight = Math.max(56, safeBottom - textTop - 12);

    setCardTextStyle({
      top: `${Math.max(safeTop + 12, textTop)}px`,
      left: '50%',
      transform: 'translateX(-50%)',
      width: `${Math.max(240, safeWidth - 28)}px`,
      'max-width': 'calc(100vw - 28px)',
      'max-height': `${textMaxHeight}px`,
    });

    requestAnimationFrame(() => {
      surface.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
      if (props.target.kind === 'card') window.setTimeout(() => setShowCardText(true), 210);
    });

    const board = document.querySelector<HTMLElement>('.board');
    if (board) board.style.filter = 'brightness(0.15)';
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    onCleanup(() => {
      window.removeEventListener('keydown', handleKeyDown);
      if (board) board.style.filter = '';
    });
  });

  return (
    <div
      ref={containerRef}
      class="zoom-inspector"
      onClick={handleClose}
    >
      <div
        ref={surfaceRef}
        class={`inspector-surface-host ${props.target.kind === 'card' ? 'card' : 'location'}`}
        data-card-type={props.target.kind === 'card' ? props.target.card.type : undefined}
        onClick={handleSurfaceClick}
      >
        <Show when={cardModel()} keyed>
          {(model) => <CardRenderer model={model} />}
        </Show>
        <Show when={laneModel()} keyed>
          {(model) => <LocationRenderer model={model} />}
        </Show>
      </div>

      <Show when={props.target.kind === 'card' && !isClosing()}>
        <div
          class="zoom-inspector__card-text"
          style={{
            ...cardTextStyle(),
            opacity: showCardText() ? '1' : '0',
            'pointer-events': showCardText() ? 'auto' : 'none',
            'text-decoration': props.target.kind === 'card' && props.target.card.textDisabled
              ? 'line-through'
              : 'none',
          }}
          onClick={(event) => event.stopPropagation()}
        >
          {props.target.kind === 'card' ? props.target.card.text || '\u00a0' : ''}
        </div>
      </Show>

      <Show when={props.target.kind === 'location' && laneLogSide()}>
        <LanePowerPanel
          breakdown={props.target.kind === 'location' && laneLogSide() === 'top'
            ? props.target.topBreakdown
            : (props.target as LocationInspectorTarget).bottomBreakdown}
          onClose={() => setLaneLogSide(null)}
        />
      </Show>

      <Show when={props.target.kind === 'card' && props.target.card.stats && logKind()}>
        <StatLogPanel
          kind={logKind() as 'power' | 'cost'}
          stats={(props.target as CardInspectorTarget).card.stats!}
          onClose={() => setLogKind(null)}
        />
      </Show>
    </div>
  );
};
