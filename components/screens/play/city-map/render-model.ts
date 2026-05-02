import type { CityMap, CitySlot, DistrictLandmark } from '@/services/playgame/city-map';

export type CityMapRendererMode = 'svg' | 'three';

export interface CityMapRenderModel {
  city: CityMap;
  world: {
    width: number;
    height: number;
  };
  slots: CitySlot[];
  landmarks: DistrictLandmark[];
}

export function createCityMapRenderModel(city: CityMap, width = city.width, height = city.height): CityMapRenderModel {
  return {
    city,
    world: { width, height },
    slots: city.districts.flatMap((district) => district.slots || []),
    landmarks: city.landmarks || city.districts.flatMap((district) => district.landmarks || []),
  };
}

