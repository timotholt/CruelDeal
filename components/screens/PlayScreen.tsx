/**
 * PlayScreen — city-map shell for the /play route.
 *
 * The old engine-backed lane board lives at /play/legacy while the new
 * district/venue surface becomes the NEW GAME destination.
 */

import { CityMapBoard } from './play/city-map/CityMapBoard';

interface PlayScreenProps {
  onExit?: () => void;
}

export const PlayScreen = (props: PlayScreenProps) => {
  return (
    <div class="playgame-root city-play-root" style={{ width: '100%', height: '100%', background: '#000' }}>
      <button class="city-play-root__exit" type="button" onClick={props.onExit} aria-label="Exit city map">
        EXIT
      </button>
      <CityMapBoard seed="new-game-city" interactive showVenueTooltips />
    </div>
  );
};
