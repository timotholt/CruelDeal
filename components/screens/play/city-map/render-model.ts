import type { Building, CityMap, CitySlot, DistrictLandmark, RoadEdge, TerrainPlan } from '@/services/playgame/city-map';

export type CityMapRendererMode = 'svg' | 'three';

export interface CityMapRenderModel {
  city: CityMap;
  world: {
    width: number;
    height: number;
  };
  terrain: TerrainPlan;
  roads: RoadEdge[];
  buildings: Building[];
  slots: CitySlot[];
  landmarks: DistrictLandmark[];
}

export function createCityMapRenderModel(city: CityMap, width = city.width, height = city.height): CityMapRenderModel {
  return {
    city,
    world: { width, height },
    terrain: city.terrain,
    roads: city.roadGraph?.edges || [],
    buildings: [...(city.buildingPlan?.buildings || []), ...(city.buildingPlan?.landmarks || [])],
    slots: city.districts.flatMap((district) => district.slots || []),
    landmarks: city.landmarks || city.districts.flatMap((district) => district.landmarks || []),
  };
}
