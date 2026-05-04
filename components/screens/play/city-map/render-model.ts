import type { Bridge, Building, CityBlock, CityMap, CitySlot, DistrictLandmark, RoadEdge, TerrainPlan } from '@/services/playgame/city-map';

export type CityMapRendererMode = 'svg' | 'three';

export interface CityMapRenderModel {
  city: CityMap;
  world: {
    width: number;
    height: number;
  };
  terrain: TerrainPlan;
  blocks: CityBlock[];
  roads: RoadEdge[];
  bridges: Bridge[];
  buildings: Building[];
  slots: CitySlot[];
  landmarks: DistrictLandmark[];
}

export function createCityMapRenderModel(city: CityMap, width = city.width, height = city.height): CityMapRenderModel {
  return {
    city,
    world: { width, height },
    terrain: city.terrain,
    blocks: city.cells?.filter((cell) => cell.buildable && cell.polygon?.length) || [],
    roads: city.roadGraph?.edges || [],
    bridges: city.bridgePlan?.bridges || [],
    buildings: [...(city.buildingPlan?.buildings || []), ...(city.buildingPlan?.landmarks || [])],
    slots: city.districts.flatMap((district) => district.slots || []),
    landmarks: city.landmarks || city.districts.flatMap((district) => district.landmarks || []),
  };
}
