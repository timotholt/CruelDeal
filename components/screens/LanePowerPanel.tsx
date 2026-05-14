import { createSignal } from 'solid-js';
import type { LanePowerBreakdown } from '@/services/playgame/engine/projections';
import { usePlayGame } from '@/contexts/PlayGameContext';

interface LanePowerPanelProps {
  breakdown: LanePowerBreakdown;
  onClose: () => void;
}

export const LanePowerPanel = (props: LanePowerPanelProps) => {
  const { engineState, manifest, localSeat, seatMeta } = usePlayGame();
  const [position, setPosition] = createSignal<{ x: number; y: number } | null>(null);
  let panelRef: HTMLDivElement | undefined;

  const resolveName = (sourceId: string): string => {
    const card = engineState.cards[sourceId as never];
    if (card) {
      const def = manifest.cards[card.defId];
      return def?.cosmetic.displayName ?? card.defId;
    }
    const defId = sourceId.split('@')[0];
    const locDef = manifest.locations[defId];
    if (locDef) return locDef.cosmetic.displayName;
    return sourceId;
  };

  const sign = (n: number) => (n >= 0 ? `+${n}` : `${n}`);
  const scoreLabel = props.breakdown.owner === localSeat
    ? seatMeta[localSeat].name
    : seatMeta[localSeat === 'P0' ? 'P1' : 'P0'].name;

  const handlePointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('button')) return;
    if (!panelRef) return;

    const rect = panelRef.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;

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
      ref={panelRef}
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'fixed',
        ...(position() ? {
          left: `${position()!.x}px`,
          top: `${position()!.y}px`,
        } : {
          top: '18vh',
          left: 'clamp(16px, calc(50% + 120px), calc(100vw - 320px))',
        }),
        'z-index': '1010',
        background: 'rgba(10,12,20,0.97)',
        border: '1px solid rgba(255,255,255,0.12)',
        'border-radius': '10px',
        padding: '10px 12px',
        'min-width': '240px',
        'max-width': '300px',
        'max-height': '58vh',
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
          'margin-bottom': '2px'
        }}
      >
        <div style={{ display: 'flex', 'flex-direction': 'column', gap: '2px' }}>
          <span style={{ color: 'white', 'font-size': '0.7rem', 'font-weight': '700', 'letter-spacing': '0.08em', 'text-transform': 'uppercase' }}>
            Lane Score
          </span>
          <span style={{ color: '#94a3b8', 'font-size': '0.6rem' }}>
            {scoreLabel}
          </span>
        </div>
        <button
          onClick={props.onClose}
          style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', 'font-size': '1rem', 'line-height': '1', padding: '0 0 0 8px' }}
        >×</button>
      </div>

      <div style={{ 'overflow-y': 'auto', display: 'flex', 'flex-direction': 'column', gap: '3px' }}>
        <SectionLabel label="Cards" />
        {props.breakdown.cards.length > 0 ? props.breakdown.cards.map((entry) => {
          const totalDelta = entry.permanentDelta + entry.ongoingDelta;
          return (
            <BreakdownRow
              label={resolveName(entry.cardId)}
              delta={totalDelta}
              total={entry.finalCardPower}
            />
          );
        }) : (
          <EmptyRow label="No cards in lane" />
        )}

        <SummaryRow label="Card Subtotal" total={props.breakdown.cardSubtotal} />

        {props.breakdown.laneAdditions.length > 0 && (
          <>
            <SectionLabel label="Lane" />
            {props.breakdown.laneAdditions.map((entry) => (
              <BreakdownRow
                label={resolveName(entry.sourceId)}
                delta={entry.delta}
                total={undefined}
              />
            ))}
            <SummaryRow label="After Lane" total={props.breakdown.subtotalAfterAdditions} />
          </>
        )}

        {props.breakdown.multipliers.length > 0 && (
          <>
            <SectionLabel label="Ongoing" />
            {props.breakdown.multipliers.map((entry) => (
              <MultiplierRow
                label={resolveName(entry.sourceId)}
                factor={entry.factor}
              />
            ))}
            <SummaryRow label="Multiplier" total={props.breakdown.effectiveMultiplier} prefix="x" />
          </>
        )}

        <SectionLabel label="Final" />
        <SummaryRow label="Total" total={props.breakdown.total} />
      </div>
    </div>
  );
};

const SectionLabel = (props: { label: string }) => (
  <div style={{ color: '#64748b', 'font-size': '0.58rem', 'font-weight': '700', 'letter-spacing': '0.06em', 'text-transform': 'uppercase', padding: '4px 2px 0' }}>
    {props.label}
  </div>
);

const BreakdownRow = (props: { label: string; delta: number; total?: number }) => {
  const deltaColor = props.delta > 0 ? '#4ade80' : props.delta < 0 ? '#f87171' : '#94a3b8';
  const deltaText = props.delta >= 0 ? `+${props.delta}` : `${props.delta}`;
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
      <span style={{ color: deltaColor, 'font-size': '0.65rem', 'font-weight': '700', 'font-style': 'italic' }}>
        {deltaText}
      </span>
      <span style={{ color: '#e2e8f0', 'font-size': '0.65rem', 'font-weight': '700', 'min-width': '1.5rem', 'text-align': 'right' }}>
        {props.total !== undefined ? `→ ${props.total}` : '\u00a0'}
      </span>
    </div>
  );
};

const MultiplierRow = (props: { label: string; factor: number }) => (
  <div style={{
    display: 'grid',
    'grid-template-columns': '1fr auto',
    gap: '6px',
    'align-items': 'center',
    background: 'rgba(255,255,255,0.04)',
    'border-radius': '4px',
    padding: '4px 6px',
  }}>
    <span style={{ color: '#94a3b8', 'font-size': '0.6rem', overflow: 'hidden', 'text-overflow': 'ellipsis', 'white-space': 'nowrap' }}>
      {props.label}
    </span>
    <span style={{ color: '#e2e8f0', 'font-size': '0.65rem', 'font-weight': '700', 'text-align': 'right' }}>
      x{props.factor}
    </span>
  </div>
);

const SummaryRow = (props: { label: string; total: number; prefix?: string }) => (
  <div style={{
    display: 'grid',
    'grid-template-columns': '1fr auto',
    gap: '6px',
    'align-items': 'center',
    padding: '4px 2px 2px',
  }}>
    <span style={{ color: '#cbd5e1', 'font-size': '0.62rem', 'font-weight': '700' }}>
      {props.label}
    </span>
    <span style={{ color: '#ffffff', 'font-size': '0.68rem', 'font-weight': '800', 'text-align': 'right' }}>
      {(props.prefix ?? '') + props.total}
    </span>
  </div>
);

const EmptyRow = (props: { label: string }) => (
  <div style={{
    color: '#475569',
    'font-size': '0.65rem',
    'text-align': 'center',
    padding: '8px 0',
  }}>
    {props.label}
  </div>
);
