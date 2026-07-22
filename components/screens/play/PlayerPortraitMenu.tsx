import type { Seat } from '@/services/playgame/engine/types/ids';
import type { VisiblePileZone } from '@/services/playgame/view';
import { useVfx } from '../../game/VfxHost';

interface PlayerPortraitMenuProps {
  owner: Seat;
  name: string;
  side: 'left' | 'right';
  hasPriority: boolean;
  open: boolean;
  counts: {
    discard: number;
    destroyed: number;
    banished: number;
  };
  onToggle: () => void;
  onOpenPile: (zone: VisiblePileZone) => void;
}

export const PlayerPortraitMenu = (props: PlayerPortraitMenuProps) => {
  const { bindZoneRef } = useVfx();
  return (
    <div
      class={'portrait-menu-anchor portrait-menu-anchor--' + props.side}
      onClick={(e) => e.stopPropagation()}
    >
      <span
        ref={bindZoneRef(`${props.owner}:discard`)}
        class="portrait-zone-anchor"
        aria-hidden="true"
      />
      <span
        ref={bindZoneRef(`${props.owner}:destroyed`)}
        class="portrait-zone-anchor"
        aria-hidden="true"
      />
      <span
        ref={bindZoneRef(`${props.owner}:banished`)}
        class="portrait-zone-anchor"
        aria-hidden="true"
      />
      <button
        class="portrait-trigger"
        classList={{ 'portrait-trigger--priority': props.hasPriority }}
        type="button"
        aria-haspopup="true"
        aria-expanded={props.open}
        title={`${props.name} zones`}
        onClick={() => props.onToggle()}
      >
        <span class="portrait-trigger__face">{props.name.slice(0, 1)}</span>
      </button>

      {props.open ? (
        <div class={'portrait-menu portrait-menu--' + props.side}>
          <div class="portrait-menu__title">{props.name}</div>
          <button class="portrait-menu__button" type="button" onClick={() => props.onOpenPile('DISCARD')}>
            <span>Discard</span>
            <span>{props.counts.discard}</span>
          </button>
          <button class="portrait-menu__button" type="button" onClick={() => props.onOpenPile('DESTROYED')}>
            <span>Destroyed</span>
            <span>{props.counts.destroyed}</span>
          </button>
          <button class="portrait-menu__button" type="button" onClick={() => props.onOpenPile('BANISHED')}>
            <span>Banished</span>
            <span>{props.counts.banished}</span>
          </button>
        </div>
      ) : null}
    </div>
  );
};
