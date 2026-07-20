/**
 * Player-safe card stat history. Provenance has already been converted to
 * labels by LocalMatchSessionAdapter; this component never resolves engine
 * identities or reads canonical ledgers.
 */

import { createSignal, For, Show } from 'solid-js';
import type {
  SeatCardStatReadModel,
} from '@/services/playgame/runtime/seatReadModels';

interface StatLogPanelProps {
  kind: 'power' | 'cost';
  stats: SeatCardStatReadModel;
  onClose: () => void;
}

export const StatLogPanel = (props: StatLogPanelProps) => {
  const [position, setPosition] =
    createSignal<{ x: number; y: number } | null>(null);
  let panelRef: HTMLDivElement | undefined;

  const handlePointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return;
    if ((event.target as HTMLElement).closest('button') || !panelRef) return;
    const rect = panelRef.getBoundingClientRect();
    const offsetX = event.clientX - rect.left;
    const offsetY = event.clientY - rect.top;
    const handlePointerMove = (moveEvent: PointerEvent) => {
      setPosition({
        x: moveEvent.clientX - offsetX,
        y: moveEvent.clientY - offsetY,
      });
    };
    const handlePointerUp = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
  };

  return (
    <div
      ref={(element) => { panelRef = element; }}
      onClick={event => event.stopPropagation()}
      style={{
        position: 'fixed',
        ...(position()
          ? { left: `${position()!.x}px`, top: `${position()!.y}px` }
          : {
              top: '18vh',
              left: 'clamp(16px, calc(50% + 120px), calc(100vw - 296px))',
            }),
        'z-index': '1010',
        background: 'rgba(10,12,20,0.97)',
        border: '1px solid rgba(255,255,255,0.12)',
        'border-radius': '10px',
        padding: '10px 12px',
        'min-width': '220px',
        'max-width': '280px',
        'max-height': '55vh',
        display: 'flex',
        'flex-direction': 'column',
        gap: '6px',
        'box-shadow': '0 8px 32px rgba(0,0,0,0.7)',
        'pointer-events': 'auto',
      }}
    >
      <div
        onPointerDown={handlePointerDown}
        style={{
          display: 'flex',
          'justify-content': 'space-between',
          'align-items': 'center',
          cursor: 'move',
          'touch-action': 'none',
          'padding-bottom': '4px',
          'border-bottom': '1px solid rgba(255,255,255,0.05)',
          'margin-bottom': '2px',
        }}
      >
        <span style={{
          color: 'white',
          'font-size': '0.7rem',
          'font-weight': '700',
          'letter-spacing': '0.08em',
          'text-transform': 'uppercase',
        }}>
          {props.kind === 'power' ? 'Power Log' : 'Cost Log'}
        </span>
        <button
          onClick={() => props.onClose()}
          style={{
            background: 'none',
            border: 'none',
            color: '#94a3b8',
            cursor: 'pointer',
            'font-size': '1rem',
            'line-height': '1',
            padding: '0 0 0 8px',
          }}
        >
          ×
        </button>
      </div>

      <div style={{
        'overflow-y': 'auto',
        display: 'flex',
        'flex-direction': 'column',
        gap: '3px',
      }}>
        <Show when={props.kind === 'power'}>
          <StatRow
            label="Base"
            delta={props.stats.basePower ?? 0}
            total={props.stats.basePower ?? 0}
            isBase
          />
          <For each={props.stats.powerHistory}>
            {entry => (
              <StatRow
                label={`T${entry.turn} · F${entry.frame} ${entry.sourceLabel}`}
                delta={entry.delta}
                total={entry.total}
              />
            )}
          </For>
          <Show when={props.stats.livePowerModifiers.length > 0}>
            <SectionLabel label="Ongoing" />
            <For each={props.stats.livePowerModifiers}>
              {entry => (
                <StatRow
                  label={entry.sourceLabel}
                  delta={entry.delta}
                  total={props.stats.effectivePower ?? 0}
                />
              )}
            </For>
          </Show>
          <Show when={
            props.stats.powerHistory.length === 0
            && props.stats.livePowerModifiers.length === 0
          }>
            <EmptyLog label="No power changes yet" />
          </Show>
        </Show>

        <Show when={props.kind === 'cost'}>
          <StatRow
            label="Base"
            delta={props.stats.baseCost}
            total={props.stats.baseCost}
            isBase
            cost
          />
          <For each={props.stats.costHistory}>
            {entry => (
              <StatRow
                label={`T${entry.turn} · F${entry.frame} ${entry.sourceLabel}`}
                delta={entry.delta}
                total={entry.total}
                cost
              />
            )}
          </For>
          <Show when={props.stats.liveCostModifiers.length > 0}>
            <SectionLabel label="Ongoing" />
            <For each={props.stats.liveCostModifiers}>
              {entry => (
                <StatRow
                  label={entry.sourceLabel}
                  delta={entry.delta}
                  total={props.stats.effectiveCost}
                  cost
                />
              )}
            </For>
          </Show>
          <Show when={
            props.stats.costHistory.length === 0
            && props.stats.liveCostModifiers.length === 0
          }>
            <EmptyLog label="No cost changes yet" />
          </Show>
        </Show>
      </div>
    </div>
  );
};

const SectionLabel = (props: { label: string }) => (
  <div style={{
    color: '#64748b',
    'font-size': '0.58rem',
    'font-weight': '700',
    'letter-spacing': '0.06em',
    'text-transform': 'uppercase',
    padding: '4px 2px 0',
  }}>
    {props.label}
  </div>
);

const EmptyLog = (props: { label: string }) => (
  <span style={{
    color: '#475569',
    'font-size': '0.65rem',
    'text-align': 'center',
    padding: '8px 0',
  }}>
    {props.label}
  </span>
);

const StatRow = (props: {
  label: string;
  delta: number;
  total: number;
  isBase?: boolean;
  cost?: boolean;
}) => {
  const deltaColor = () => {
    if (props.isBase) return '#e2e8f0';
    if (props.delta === 0) return '#94a3b8';
    if (props.cost) return props.delta < 0 ? '#4ade80' : '#f87171';
    return props.delta > 0 ? '#4ade80' : '#f87171';
  };
  return (
    <div style={{
      display: 'grid',
      'grid-template-columns': '1fr auto auto',
      gap: '6px',
      'align-items': 'center',
      background: 'rgba(255,255,255,0.04)',
      'border-radius': '4px',
      padding: '4px 6px',
    }}>
      <span style={{
        color: '#94a3b8',
        'font-size': '0.6rem',
        overflow: 'hidden',
        'text-overflow': 'ellipsis',
        'white-space': 'nowrap',
      }}>
        {props.label}
      </span>
      <span style={{
        color: deltaColor(),
        'font-size': '0.65rem',
        'font-weight': '700',
        'font-style': 'italic',
      }}>
        {props.isBase ? '\u00a0' : props.delta >= 0
          ? `+${props.delta}`
          : props.delta}
      </span>
      <span style={{
        color: '#e2e8f0',
        'font-size': '0.65rem',
        'font-weight': '700',
        'min-width': '1.5rem',
        'text-align': 'right',
      }}>
        → {props.total}
      </span>
    </div>
  );
};
