/**
 * StatLogPanel — compact vertical log of power or energy changes.
 * Rendered as a floating panel inside ZoomInspector when the player
 * clicks the power or cost number on a zoomed card.
 */

import { For, Show } from 'solid-js';
import { usePlayGame } from '@/contexts/PlayGameContext';
import type { CostLogEntry, PowerLogEntry } from '@/services/playgame/engine/types/state';
import type { CostModifierEntry, PowerModifierEntry } from '@/services/playgame/engine/projections';

interface StatLogPanelProps {
  kind: 'power' | 'cost';
  /** Card's base power — used to compute final power per row (power mode only). */
  basePower?: number;
  /** Card's base cost — used to compute final cost per row (cost mode only). */
  baseCost?: number;
  /** Permanent power change log (power mode). */
  powerLog?: readonly PowerLogEntry[];
  /** Live power modifiers affecting the card right now (power mode). */
  powerModifiers?: readonly PowerModifierEntry[];
  /** Live cost modifiers affecting the card right now (cost mode). */
  costLog?: readonly CostModifierEntry[];
  /** Permanent cost history affecting the card across its lifetime. */
  costHistory?: readonly CostLogEntry[];
  onClose: () => void;
}

export const StatLogPanel = (props: StatLogPanelProps) => {
  const { engineState, manifest } = usePlayGame();

  /** Resolve a sourceId (CardId | LocationId) to a display name. */
  const resolveName = (sourceId: string): string => {
    const card = engineState.cards[sourceId as never];
    if (card) {
      const def = manifest.cards[card.defId];
      return def?.cosmetic.displayName ?? card.defId;
    }
    // LocationId format is "defId@laneIdx"
    const defId = sourceId.split('@')[0];
    const locDef = manifest.locations[defId];
    if (locDef) return locDef.cosmetic.displayName;
    return sourceId;
  };

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'fixed',
        top: '18vh',
        left: 'clamp(16px, calc(50% + 120px), calc(100vw - 296px))',
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
      {/* Header */}
      <div style={{ display: 'flex', 'justify-content': 'space-between', 'align-items': 'center' }}>
        <span style={{ color: 'white', 'font-size': '0.7rem', 'font-weight': '700', 'letter-spacing': '0.08em', 'text-transform': 'uppercase' }}>
          {props.kind === 'power' ? 'Power Log' : 'Cost Log'}
        </span>
        <button
          onClick={props.onClose}
          style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', 'font-size': '1rem', 'line-height': '1', padding: '0 0 0 8px' }}
        >×</button>
      </div>

      {/* Entries */}
      <div style={{ 'overflow-y': 'auto', display: 'flex', 'flex-direction': 'column', gap: '3px' }}>
        <Show when={props.kind === 'power'}>
          <PowerRow label="Base" delta={props.basePower ?? 0} total={(props.basePower ?? 0)} isBase />
          <Show when={(props.powerLog?.length ?? 0) > 0}>
            <For each={props.powerLog}>
              {(entry) => {
                const total = (props.basePower ?? 0) + entry.runningDelta;
                const name = resolveName(entry.cause.sourceId);
                const label = `T${entry.turn} ${name}`;
                return <PowerRow label={label} delta={entry.delta} total={total} />;
              }}
            </For>
          </Show>
          <Show when={(props.powerModifiers?.length ?? 0) > 0}>
            <div style={{ color: '#64748b', 'font-size': '0.58rem', 'font-weight': '700', 'letter-spacing': '0.06em', 'text-transform': 'uppercase', padding: '4px 2px 0' }}>
              Ongoing
            </div>
            <For each={props.powerModifiers}>
              {(entry) => (
                <PowerRow
                  label={resolveName(entry.sourceId)}
                  delta={entry.delta}
                  total={
                    (props.basePower ?? 0)
                    + (props.powerLog?.at(-1)?.runningDelta ?? 0)
                    + (props.powerModifiers?.slice(0, (props.powerModifiers?.indexOf(entry) ?? -1) + 1)
                      .reduce((sum, item) => sum + item.delta, 0) ?? 0)
                  }
                />
              )}
            </For>
          </Show>
          <Show when={(props.powerLog?.length ?? 0) === 0 && (props.powerModifiers?.length ?? 0) === 0}>
            <span style={{ color: '#475569', 'font-size': '0.65rem', 'text-align': 'center', padding: '8px 0' }}>
              No power changes yet
            </span>
          </Show>
        </Show>

        <Show when={props.kind === 'cost'}>
          <CostRow label="Base" delta={props.baseCost ?? 0} total={props.baseCost ?? 0} isBase />
          <Show when={(props.costHistory?.length ?? 0) > 0}>
            <For each={props.costHistory}>
              {(entry) => (
                <CostRow
                  label={`T${entry.turn} ${resolveName(entry.cause.sourceId)}`}
                  delta={entry.delta}
                  total={Math.max(0, (props.baseCost ?? 0) + entry.runningDelta)}
                />
              )}
            </For>
          </Show>
          <Show when={(props.costLog?.length ?? 0) > 0}>
            <div style={{ color: '#64748b', 'font-size': '0.58rem', 'font-weight': '700', 'letter-spacing': '0.06em', 'text-transform': 'uppercase', padding: '4px 2px 0' }}>
              Ongoing
            </div>
            <For each={props.costLog}>
              {(entry) => (
                <CostRow
                  label={resolveName(entry.sourceId)}
                  delta={entry.delta}
                  total={Math.max(
                    0,
                    (props.baseCost ?? 0)
                    + (props.costHistory?.at(-1)?.runningDelta ?? 0)
                    + (props.costLog?.slice(0, (props.costLog?.indexOf(entry) ?? -1) + 1)
                      .reduce((sum, item) => sum + item.delta, 0) ?? 0),
                  )}
                />
              )}
            </For>
          </Show>
          <Show when={(props.costHistory?.length ?? 0) === 0 && (props.costLog?.length ?? 0) === 0}>
            <span style={{ color: '#475569', 'font-size': '0.65rem', 'text-align': 'center', padding: '8px 0' }}>
              No cost changes yet
            </span>
          </Show>
        </Show>
      </div>
    </div>
  );
};

interface CostRowProps {
  label: string;
  delta: number;
  total: number;
  isBase?: boolean;
}

const CostRow = (props: CostRowProps) => {
  const deltaColor = () => {
    if (props.isBase) return '#e2e8f0';
    return props.delta < 0 ? '#4ade80' : props.delta > 0 ? '#f87171' : '#94a3b8';
  };
  const sign = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

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
      <span style={{ color: '#94a3b8', 'font-size': '0.6rem', overflow: 'hidden', 'text-overflow': 'ellipsis', 'white-space': 'nowrap' }}>
        {props.label}
      </span>
      <span style={{ color: deltaColor(), 'font-size': '0.65rem', 'font-weight': '700', 'font-style': 'italic' }}>
        {props.isBase ? '\u00a0' : sign(props.delta)}
      </span>
      <span style={{ color: '#e2e8f0', 'font-size': '0.65rem', 'font-weight': '700', 'min-width': '1.5rem', 'text-align': 'right' }}>
        {props.isBase ? `${props.total}` : `→ ${props.total}`}
      </span>
    </div>
  );
};

interface PowerRowProps {
  label: string;
  delta: number;
  total: number;
  isBase?: boolean;
}

const PowerRow = (props: PowerRowProps) => {
  const deltaColor = () => {
    if (props.isBase) return '#e2e8f0';
    return props.delta > 0 ? '#4ade80' : props.delta < 0 ? '#f87171' : '#94a3b8';
  };
  const sign = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

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
      <span style={{ color: '#94a3b8', 'font-size': '0.6rem', overflow: 'hidden', 'text-overflow': 'ellipsis', 'white-space': 'nowrap' }}>
        {props.label}
      </span>
      <span style={{ color: deltaColor(), 'font-size': '0.65rem', 'font-weight': '700', 'font-style': 'italic' }}>
        {props.isBase ? '\u00a0' : sign(props.delta)}
      </span>
      <span style={{ color: '#e2e8f0', 'font-size': '0.65rem', 'font-weight': '700', 'min-width': '1.5rem', 'text-align': 'right' }}>
        {props.isBase ? `${props.total}` : `→ ${props.total}`}
      </span>
    </div>
  );
};
