import type { Seat } from '@/services/playgame/engine/types/ids';
import type { CardZone } from '@/services/playgame/engine/types/state';
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
  onOpenPile: (zone: CardZone) => void;
}

export const PlayerPortraitMenu = (props: PlayerPortraitMenuProps) => {
  const { bindZoneRef } = useVfx();
  return (
    <div
      ref={(el) => {
        bindZoneRef(`${props.owner}:discard`)(el);
        bindZoneRef(`${props.owner}:destroyed`)(el);
        bindZoneRef(`${props.owner}:banished`)(el);
      }}
      class={'portrait-menu-anchor portrait-menu-anchor--' + props.side}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        class="portrait-trigger"
        classList={{ 'portrait-trigger--priority': props.hasPriority }}
        type="button"
        aria-haspopup="true"
        aria-expanded={props.open}
        title={`${props.name} zones`}
        onClick={props.onToggle}
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
