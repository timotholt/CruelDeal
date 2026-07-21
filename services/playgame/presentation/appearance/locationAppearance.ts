import type {
  LaneVisualModel,
  LocationContentSpec,
  LocationSurfaceModel,
  VisualColor,
} from '@/components/game-surfaces/contracts';
import type { ResolvedLocation } from '@/services/playgame/view';
import { visualKey } from './visualKey';

const LOCATION_CONTENT_REVISION = 'location-content-v1';
const LOCATION_CHROME_REVISION = 'location-chrome-v1';

const contentSpec = (location: ResolvedLocation): LocationContentSpec => {
  const artwork = location.mapArt
    ? { src: location.mapArt, revision: location.mapArt }
    : null;
  const fields = [location.name, location.desc, artwork, location.art];
  return Object.freeze({
    cacheKey: visualKey('location', LOCATION_CONTENT_REVISION, fields),
    name: location.name,
    rulesText: location.desc,
    artwork,
    accent: location.art as VisualColor,
    contentRevision: LOCATION_CONTENT_REVISION,
  });
};

export const locationSurfaceModel = (location: ResolvedLocation): LocationSurfaceModel => {
  const front = location.revealed && location.defId !== '';
  return Object.freeze({
    kind: 'location' as const,
    face: front
      ? Object.freeze({ kind: 'front' as const, content: contentSpec(location) })
      : Object.freeze({ kind: 'back' as const, backStyle: 'default' as const }),
    chrome: Object.freeze({
      borderStyle: 'standard' as const,
      chromeRevision: LOCATION_CHROME_REVISION,
    }),
    statuses: Object.freeze([]),
  });
};

export const laneVisualModel = (
  location: ResolvedLocation,
  topPower: number,
  bottomPower: number,
): LaneVisualModel => Object.freeze({
  location: locationSurfaceModel(location),
  topScore: Object.freeze({ value: topPower, tone: 'remote' as const }),
  bottomScore: Object.freeze({ value: bottomPower, tone: 'local' as const }),
  laneArtwork: location.mapArt
    ? Object.freeze({ src: location.mapArt, revision: location.mapArt })
    : null,
});
