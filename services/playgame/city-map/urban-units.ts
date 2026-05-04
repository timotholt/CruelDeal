export const CITY_UNIT_METERS = 1;

export function meters(value: number) {
  return value / CITY_UNIT_METERS;
}

export function squareMeters(value: number) {
  return value / (CITY_UNIT_METERS * CITY_UNIT_METERS);
}

export const URBAN_SCALE = {
  unitLabel: 'meter',
  metersPerMapUnit: CITY_UNIT_METERS,

  roads: {
    lane: meters(3),
    truckLane: meters(4),
    localCorridor: meters(6),
    minorCorridor: meters(8),
    majorCorridor: meters(16),
    coastRoadCorridor: meters(16),
    highwayCorridor: meters(24),
    alleyCorridor: meters(4),
    serviceCorridor: meters(4),

    // Current v35 roads are rendered as centerlines, not generated as real
    // corridor polygons. These clearances keep placement stable until the road
    // layer is rebuilt around physical-width corridors.
    highwayPlacementClearance: meters(3),
    majorPlacementClearance: meters(2),
    minorPlacementClearance: meters(1),
    localPlacementClearance: meters(1),
    alleyPlacementClearance: meters(1),
    servicePlacementClearance: meters(1),
    coastRoadPlacementClearance: meters(2),
  },

  bridges: {
    localDeck: meters(6),
    minorDeck: meters(8),
    majorDeck: meters(16),
    coastDeck: meters(16),
    highwayDeck: meters(24),
  },

  setbacks: {
    urbanCommercial: meters(1),
    industrial: meters(2),
    modernResidential: meters(3),
    oldResidentialMin: meters(0.5),
    oldResidentialMax: meters(4),
  },

  parcels: {
    commercialSeamGap: meters(0.75),
    minBuildableArea: squareMeters(70),
    minSplitChildArea: squareMeters(115),
    oldCommercialTargetArea: squareMeters(150),
    averageCommercialTargetArea: squareMeters(260),
    newCommercialTargetArea: squareMeters(520),
    residentialOldTargetArea: squareMeters(260),
    residentialAverageTargetArea: squareMeters(340),
    residentialNewTargetArea: squareMeters(420),
    industrialTargetArea: squareMeters(520),
    largeParcelArea: squareMeters(1600),
    mediumParcelArea: squareMeters(850),
  },

  buildings: {
    commercialOldModuleMin: meters(7.4),
    commercialOldModuleJitter: meters(2.1),
    commercialNewModuleMin: meters(8.6),
    commercialNewModuleJitter: meters(3.6),
    industrialModuleMin: meters(10.5),
    industrialModuleJitter: meters(5.5),
    residentialNewModuleMin: meters(5.8),
    residentialNewModuleJitter: meters(1.4),
    residentialOldModuleMin: meters(5.4),
    residentialOldModuleJitter: meters(2.6),
    commercialNewMinCell: meters(2.5),
    commercialNewGridMin: meters(4),
    commercialNewGridMax: meters(7),
    riverBuffer: meters(7),
  },
} as const;
