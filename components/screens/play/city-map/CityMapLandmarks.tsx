import { For } from 'solid-js';
import type { DistrictLandmark } from '@/services/playgame/city-map';

export interface CityMapLandmarksProps {
  landmarks: readonly DistrictLandmark[];
  hoveredLandmarkId?: string | null;
}

function timingLabel(timing: DistrictLandmark['timing']) {
  if (timing === 'on-reveal') return 'OR';
  if (timing === 'ongoing') return 'OG';
  return 'EOT';
}

export const CityMapLandmarks = (props: CityMapLandmarksProps) => {
  return (
    <g class="city-map-landmarks" aria-label="District landmarks">
      <For each={props.landmarks}>
        {(landmark) => (
          <g
            classList={{
              'city-map-landmark': true,
              [`city-map-landmark--${landmark.timing}`]: true,
              'city-map-landmark--hover': props.hoveredLandmarkId === landmark.id,
            }}
            data-landmark-id={landmark.id}
            data-district-id={landmark.districtId}
            data-effect-timing={landmark.timing}
            role="img"
            aria-label={`${landmark.name}: ${landmark.effectPlaceholder}`}
          >
            <path
              class="city-map-landmark__marker"
              d={`M ${landmark.centroid.x.toFixed(2)} ${(landmark.centroid.y - 5.8).toFixed(2)} L ${(landmark.centroid.x + 5.8).toFixed(2)} ${landmark.centroid.y.toFixed(2)} L ${landmark.centroid.x.toFixed(2)} ${(landmark.centroid.y + 5.8).toFixed(2)} L ${(landmark.centroid.x - 5.8).toFixed(2)} ${landmark.centroid.y.toFixed(2)} Z`}
            />
            <text class="city-map-landmark__timing" x={landmark.centroid.x} y={landmark.centroid.y + 1.8}>
              {timingLabel(landmark.timing)}
            </text>
          </g>
        )}
      </For>
    </g>
  );
};
