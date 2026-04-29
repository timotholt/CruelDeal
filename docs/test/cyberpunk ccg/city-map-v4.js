(function () {
  "use strict";

  const CACHE_LIMIT = 12;
  const cache = new Map();

  function normalizeSeed(seed) {
    return Number.isFinite(seed) ? (seed >>> 0) || 1 : 1;
  }

  function remember(key, value) {
    if (cache.has(key)) cache.delete(key);
    cache.set(key, value);
    while (cache.size > CACHE_LIMIT) {
      const oldest = cache.keys().next().value;
      cache.delete(oldest);
    }
    return value;
  }

  function buildCityV4(seed = 1) {
    const normalizedSeed = normalizeSeed(seed);
    const key = `city-v4:${normalizedSeed}`;
    if (cache.has(key)) return cache.get(key);
    const data = window.CityMapBuildingsV4.buildStaticBuildings(normalizedSeed);
    return remember(key, {
      version: 4,
      seed: normalizedSeed,
      bounds: data.terrain.bounds,
      terrain: data.terrain,
      field: data.field,
      cells: data.cells,
      neighborhoods: data.neighborhoods,
      adjacency: data.adjacency,
      roadGraph: data.roadGraph,
      districts: data.districts,
      districtAdjacency: data.districtAdjacency,
      cellDistrict: data.cellDistrict,
      bridgePlan: data.bridgePlan,
      buildingPlan: data.buildingPlan
    });
  }

  function summarizeCityV4(city) {
    const data = city || buildCityV4(1);
    const roadKinds = {};
    for (const edge of data.roadGraph.edges) {
      roadKinds[edge.kind] = (roadKinds[edge.kind] || 0) + 1;
    }
    return {
      seed: data.seed,
      landmasses: data.terrain.landmasses.length,
      waterBodies: data.terrain.waterBodies.length,
      fieldElements: data.field ? data.field.fieldElements.length : 0,
      cells: data.cells.length,
      neighborhoods: data.neighborhoods.length,
      districts: data.districts.length,
      roads: data.roadGraph.edges.length,
      roadKinds,
      bridges: data.bridgePlan.bridges.length,
      buildings: data.buildingPlan.buildings.length,
      openSpaces: data.buildingPlan.openSpaces.length
    };
  }

  function clearCache() {
    cache.clear();
  }

  window.CityMapV4 = {
    buildCityV4,
    summarizeCityV4,
    clearCache
  };
  window.buildCityV4 = buildCityV4;
})();
