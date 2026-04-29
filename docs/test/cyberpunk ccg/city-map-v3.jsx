/* global React, makeRng, STAGE_W, BOARD_H */
/* exposes:
   window.CityMapV3, buildCityV3, cityV3DotPos, cityV3DotDistance,
   whoCanThisCardSeeV3, whoCanSeeMeV3
*/

const { useMemo: _useMemoCM } = React;

// ============================================================
// CONSTANTS
// ============================================================

const {
  VIEW_W,
  VIEW_H,
  CELL_UNIT,
  DISTRICT_NAMES,
  DISTRICT_COLORS,
  PAL
} = window.CityMapConfigV3;

// ============================================================
// GEOMETRY UTILITIES
// ============================================================

const {
  polygonCentroid: _polygonCentroid,
  insetPolygon: _insetPolygon
} = window.CityMapGeometryV3;

const {
  polygonToPath: _polygonToPath,
  polygonOutlinePathClippedToViewport: _polygonOutlinePathClippedToViewport,
  cutSegments: _cutSegments,
  smoothClosedPath: _smoothClosedPath
} = window.CityMapPathsV3;

const {
  generateLandPolygon: _generateLandPolygon,
  generateCoastDocks: _generateCoastDocks
} = window.CityMapLandV3;

const {
  makeRiverBankRoads: _makeRiverBankRoads,
  generateRivers: _generateRivers
} = window.CityMapWaterV3;

const {
  labelMetrics: _labelMetrics,
  labelPosition: _labelPosition,
  viewportVisibleArea: _viewportVisibleArea,
  slotCountsByRank: _slotCountsByRank,
  placeDotsInPolygon: _placeDotsInPolygon
} = window.CityMapPlacementV3;

const {
  macroDivide3: _macroDivide3,
  bspSubdivide: _bspSubdivide,
  collectAllCuts: _collectAllCuts,
  leavesUnder: _leavesUnder
} = window.CityMapPartitionV3;
const {
  generateDistrictLandmarks: _generateDistrictLandmarks
} = window.CityMapLandmarksV3;
const {
  generateBlockBuildings: _generateBlockBuildings,
  generateCoastStripBuildings: _generateCoastStripBuildings
} = window.CityMapBuildingsV3;
const {
  generateIslands: _generateIslands
} = window.CityMapIslandsV3;
const {
  generateBridges: _generateBridges
} = window.CityMapBridgesV3;

// ============================================================
// MAIN BUILDER
// ============================================================

function buildCityV3(seed) {
  const rng = makeRng((seed >>> 0) || 1);

  // 1. Land
  const landPolygon = _generateLandPolygon(rng);
  const docks = _generateCoastDocks(landPolygon, rng);

  // 1b. River before macro roads so avenue selection can avoid running
  // alongside the water. It still renders later as a mask cutout.
  const river = _generateRivers(landPolygon, rng);
  const riverSegments = river ? river.segments : null;

  // 2. City-wide grid skew. Keep the base grid orthogonal; diagonal roads are
  // independent overlays and should not make the district/block system look
  // like a tilted design comp.
  const cityGridAngle = 0;

  // 3. MACRO DIVISION → 3 districts up front (no leftovers).
  const macro = _macroDivide3(landPolygon, cityGridAngle, rng, riverSegments);
  let regions = macro.regions;
  // Defensive: if division produced fewer than 3 regions, fall back gracefully.
  while (regions.length < 3) regions = [...regions, regions[regions.length - 1]];

  // 4. For each macro region, run BSP to subdivide into blocks/streets.
  // Start at depth 2 so internal streets render as "main" thickness, leaving
  // the macro cuts (depths 0, 1) as the highway/avenue level.
  const districtBSPs = regions.slice(0, 3).map(r => _bspSubdivide(r, 2, cityGridAngle, rng));

  // 5. Build district objects
  const namesShuf = [...DISTRICT_NAMES];
  for (let i = namesShuf.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [namesShuf[i], namesShuf[j]] = [namesShuf[j], namesShuf[i]];
  }
  const colorsShuf = [...DISTRICT_COLORS];
  for (let i = colorsShuf.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [colorsShuf[i], colorsShuf[j]] = [colorsShuf[j], colorsShuf[i]];
  }

  const districts = districtBSPs.map((bspRoot, idx) => {
    const polygon = bspRoot.polygon;
    const centroid = _polygonCentroid(polygon);
    const leafBlocks = _leavesUnder(bspRoot);
    return {
      idx,
      name: namesShuf[idx],
      color: colorsShuf[idx % colorsShuf.length],
      polygon,
      polygonPath: _polygonToPath(polygon),
      // Outline excludes shared-road edges (so adjacent districts don't double-stroke
      // along the highway/avenue, eliminating the "seam" effect) AND includes
      // viewport-boundary edges where the district extends past the screen — so
      // the district visually closes against the viewport border instead of
      // appearing to "fall off" into the background.
      outlinePath: _polygonOutlinePathClippedToViewport(polygon),
      centroid,
      bspRoot,
      leafBlocks,
      landmarks: [],
      dots: [],
      labelPos: { x: centroid.x, y: centroid.y },
      labelText: namesShuf[idx],
      labelBox: null
    };
  });

  // 6. Landmarks per district: big civic/commercial blocks plus dense pocket
  // parks and plazas biased toward smaller blocks.
  _generateDistrictLandmarks(districts, rng, cityGridAngle);

  // 7. Slot placement — rank-driven so maps always have a clearly small and
  // clearly large district. Compute all visible areas first, rank them, then
  // assign: smallest=2 pairs, largest=5 pairs, middle=3 or 4 pairs.
  const districtVisAreas = districts.map(d => _viewportVisibleArea(d.polygon));
  const districtSlotCounts = _slotCountsByRank(districtVisAreas, rng);
  for (const d of districts) {
    const visArea = districtVisAreas[d.idx];
    const target = districtSlotCounts[d.idx];
    const label = _labelPosition(d.polygon, d.landmarks, d.name);
    d.labelPos = { x: label.x, y: label.y };
    d.labelText = label.text || d.name;
    d.labelBox = {
      x: label.x,
      y: label.y,
      halfW: label.halfW || _labelMetrics(d.labelText).halfW,
      halfH: label.halfH || _labelMetrics(d.labelText).halfH
    };
    const placed = _placeDotsInPolygon(d.polygon, rng, d.landmarks, target, visArea, d.labelBox);
    if (placed.length % 2 === 1) placed.pop();
    const ownerByPoint = new Map();
    const sortedByBoardSide = [...placed].sort((a, b) => a.y - b.y || a.x - b.x);
    const split = Math.floor(sortedByBoardSide.length / 2);
    sortedByBoardSide.forEach((p, i) => ownerByPoint.set(p, i < split ? "them" : "you"));
    d.dots = placed.map((p, i) => ({
      id: `D${d.idx}-${i}`,
      districtIdx: d.idx,
      owner: ownerByPoint.get(p) || "you",
      x: p.x,
      y: p.y
    }));
  }

  // 8. Collect all cuts (streets) for rendering: macro cuts (highway+avenue) + per-district BSP cuts.
  const allCuts = [...macro.macroCuts];
  for (const d of districts) _collectAllCuts(d.bspRoot, allCuts);
  if (river) {
    const riverBankCuts = _makeRiverBankRoads(river, landPolygon);
    for (const cut of riverBankCuts) allCuts.push(cut);
  }

  // 9. Road hazards — every cut becomes one or more line segments with a
  // per-tier buffer. This stops the wide-stroke streets from clipping buildings.
  // Buffers are tuned to the visible street widths in the render-layer street
  // style table + an extra
  // ~1px setback so the building's edge doesn't sit flush against the asphalt.
  const _roadBuffer = (depth) => {
    if (depth === 0) return 4.0;   // highway (glow ~4.5 wide → buffer past glow)
    if (depth === 1) return 3.0;   // avenue
    if (depth === 2) return 2.0;   // main street
    return 0;                       // local streets handled by polygon clipping alone
  };
  const roadHazards = [];
  for (const cut of allCuts) {
    if (cut.diagonalOverlay) continue;
    const buf = _roadBuffer(cut.depth);
    if (buf <= 0) continue;
    const segs = _cutSegments(cut);
    for (const s of segs) {
      roadHazards.push({ a: s.a, b: s.b, buffer: buf });
    }
  }

  // 10. Buildings for every leaf block (across all 3 districts) that isn't a
  // landmark. Building generator receives river segments + road hazards so it
  // skips footprints near water and tiered roads — creating natural riverfront
  // gaps / road setbacks / irregular blocks.
  const landmarkPolySet = new Set();
  for (const d of districts) for (const lm of d.landmarks) landmarkPolySet.add(lm.polygon);
  const buildings = [];
  for (const d of districts) {
    for (const leaf of d.leafBlocks) {
      if (landmarkPolySet.has(leaf.polygon)) continue;
      const blockBldgs = _generateBlockBuildings(leaf.polygon, cityGridAngle, rng, riverSegments, roadHazards, river ? river.buildingBuffer : undefined);
      for (const b of blockBldgs) buildings.push(b);
    }
  }

  // 11. Coast road = land polygon inset by ~5px so land extends past the road.
  // Computed before bridges so the bridge step can also handle coast-road
  // crossings of the river.
  const coastRoadPolygon = _insetPolygon(landPolygon, 5);
  const coastRoadPath = _smoothClosedPath(coastRoadPolygon);

  const { bridges, renderedCuts } = _generateBridges({ allCuts, river, riverSegments, coastRoadPolygon, landPolygon });

  // 13. Coast-strip micro-buildings — small buildings on the seaward side of
  // the coast road.
  buildings.push(..._generateCoastStripBuildings(coastRoadPolygon, landPolygon, rng));

  // 14. Islands — small land masses in visible water areas.
  const islands = _generateIslands(landPolygon, coastRoadPolygon, cityGridAngle, rng, riverSegments);

  return {
    landPolygon,
    landPath: _smoothClosedPath(landPolygon),
    coastRoadPath,
    docks,
    districts,
    cuts: renderedCuts,
    ambientLandmarks: [],   // no leftovers in 3-region division
    buildings,
    river,
    bridges,
    islands,
    width: VIEW_W,
    height: VIEW_H
  };
}

// ============================================================
// DOT HELPERS & DETECTION
// ============================================================

const {
  cityV3DotPos,
  cityV3DotDistance,
  whoCanThisCardSeeV3,
  whoCanSeeMeV3
} = window.CityMapRulesV3;

const {
  renderDocksLayer: _renderDocksLayer,
  renderIslandsLayer: _renderIslandsLayer,
  renderDistrictAlertsLayer: _renderDistrictAlertsLayer,
  renderBuildingsLayer: _renderBuildingsLayer,
  renderLandmarksLayer: _renderLandmarksLayer,
  renderDistrictOutlinesLayer: _renderDistrictOutlinesLayer,
  renderStreetsLayer: _renderStreetsLayer,
  renderHighwaysLayer: _renderHighwaysLayer,
  renderRoundaboutsLayer: _renderRoundaboutsLayer,
  renderBridgeLayer: _renderBridgeLayer,
  renderIslandBridgeLayer: _renderIslandBridgeLayer,
  renderCoastRoadLayer: _renderCoastRoadLayer,
  renderDimmerLayer: _renderDimmerLayer,
  renderDebugDotsLayer: _renderDebugDotsLayer,
  renderLabelsLayer: _renderLabelsLayer,
  renderHoverCaptureLayer: _renderHoverCaptureLayer
} = window.CityMapRenderV3;

// ============================================================
// COMPONENT
// ============================================================

function CityMapV3({
  seed, width, height,
  opacity = 1, showLabels = true, showStreets = true, showDots = false,
  // Optional Marvel-Snap-style score tint:
  //   playerScore  — current player's score
  //   enemyScore   — opponent's score
  // The land base is tinted GREEN if winning, RED if losing, YELLOW if tied.
  // Tint strength scales with score gap (capped). When either prop is null
  // or both are zero, no tint is applied.
  playerScore = null,
  enemyScore = null,
  // Optional per-district notification wash:
  //   { [districtIdx]: "red" | "yellow" | "green" | { level, opacity, strength } }
  // or keyed by district name.
  districtAlerts = null
}) {
  const W = width || VIEW_W;
  const H = height || VIEW_H;
  const data = _useMemoCM(() => buildCityV3(seed || 1), [seed]);
  const idBase = `cv3-${seed || 1}`;

  // Track which district (if any) the mouse is hovering over, for outline glow.
  const [hoveredDistrict, setHoveredDistrict] = React.useState(null);
  const BASE_MAP_DIM_OPACITY = 0.18;

  // Sort non-highway cuts by depth (deepest=thinnest first); highways drawn separately on top
  const sortedCuts = data.cuts.filter(c => c.depth > 0).sort((a, b) => b.depth - a.depth);
  const hwyCuts = data.cuts.filter(c => c.depth === 0);
  const alertForDistrict = (d) => {
    if (!districtAlerts) return null;
    return districtAlerts[d.idx] || districtAlerts[d.name] || districtAlerts[d.name.toLowerCase()];
  };

  // Compute score-tint color and opacity.
  let scoreTint = null;
  if (playerScore != null && enemyScore != null && (playerScore !== 0 || enemyScore !== 0)) {
    const diff = playerScore - enemyScore;
    // Tint opacity scales with abs(diff), capped at ~6-point gap.
    const strength = Math.min(0.45, 0.10 + Math.abs(diff) * 0.06);
    if (diff > 0)      scoreTint = { color: "#3eb56b", opacity: strength };  // winning: green
    else if (diff < 0) scoreTint = { color: "#d04848", opacity: strength };  // losing: red
    else               scoreTint = { color: "#e5c14a", opacity: strength * 0.7 }; // tied: yellow
  }

  return (
    <svg
      className="city-map-v3-svg"
      width={W}
      height={H}
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      preserveAspectRatio="none"
      style={{ opacity, display: "block", position: "absolute", left: 0, top: 0 }}
    >
      <defs>
        <clipPath id={`${idBase}-land`}>
          <path d={data.landPath} />
        </clipPath>
        {data.river && (
          <mask id={`${idBase}-city-water-cutout`} maskUnits="userSpaceOnUse">
            <rect x={0} y={0} width={VIEW_W} height={VIEW_H} fill="black" />
            <path d={data.landPath} fill="white" />
            <path
              d={data.river.path}
              fill="none"
              stroke="black"
              strokeWidth={data.river.outerWidth + 1.6}
              strokeLinecap="round"
            />
          </mask>
        )}
        {hoveredDistrict != null && (
          <mask id={`${idBase}-map-dim-mask`}>
            <rect x={0} y={0} width={VIEW_W} height={VIEW_H} fill="white" />
            <path
              d={data.districts[hoveredDistrict].polygonPath}
              fill="black"
            />
          </mask>
        )}
      </defs>

      {/* WATER — single flat-color ocean. */}
      <rect x={0} y={0} width={VIEW_W} height={VIEW_H} fill={PAL.water} />

      {/* DOCKS — building-colored rectangles jut into the water. */}
      {_renderDocksLayer({ docks: data.docks })}

      {/* ISLANDS — small land masses in visible water. */}
      {_renderIslandsLayer({ islands: data.islands, showStreets, baseMapDimOpacity: BASE_MAP_DIM_OPACITY })}

      <g mask={data.river ? `url(#${idBase}-city-water-cutout)` : undefined}>
      {/* LAND base */}
      <path d={data.landPath} fill={PAL.land} />
      {/* Score-driven win/lose tint over land (no-op if scores not provided) */}
      {scoreTint && (
        <path d={data.landPath} fill={scoreTint.color} opacity={scoreTint.opacity}
          style={{ pointerEvents: "none", mixBlendMode: "multiply" }} />
      )}

      {/* District alert backgrounds sit below buildings and roads. */}
      {_renderDistrictAlertsLayer({ districts: data.districts, alertForDistrict })}

      {/* BUILDINGS (subtle footprints — drawn before streets so street network is on top) */}
      {_renderBuildingsLayer({ buildings: data.buildings })}

      {/* DISTRICT OUTLINES — under the road layers, so streets/highways cover border glow. */}
      {_renderDistrictOutlinesLayer({ districts: data.districts, hoveredDistrict })}

      {/* STREETS — render in order: deepest (local) first, then thicker. */}
      {_renderStreetsLayer({ showStreets, sortedCuts })}

      {/* HIGHWAY OUTER GLOW (over depth-0 cuts, beneath their inner stroke) */}
      {_renderHighwaysLayer({ showStreets, hwyCuts })}

      {/* ROUNDABOUTS — short access spurs and ring roads around round buildings. */}
      {_renderRoundaboutsLayer({ showStreets, buildings: data.buildings })}

      {/* COAST ROAD — inset land polygon stroked as a perimeter avenue */}
      {_renderCoastRoadLayer({ showStreets, coastRoadPath: data.coastRoadPath })}

      {/* RIVER OUTLINE — smallest/lightest stroke to define river edges cleanly */}
      {data.river && (
        <path
          d={data.river.path}
          fill="none"
          stroke={PAL.riverOutline}
          strokeWidth={data.river.outerWidth * 0.35}
          strokeLinecap="round"
          opacity={0.72}
        />
      )}

      {/* BASE MAP DIMMER — default darkness applies to the city/land layer only. */}
      {_renderDimmerLayer({ landPath: data.landPath, baseMapDimOpacity: BASE_MAP_DIM_OPACITY, hoveredDistrict, idBase })}
      </g>

      {/* LANDMARKS — drawn LAST so they sit on top of streets and don't get cut through */}
      {_renderLandmarksLayer({ data, idBase })}

      {/* BRIDGES — road and island crossings drawn over the shared water layer. */}
      {_renderBridgeLayer({ showStreets, data })}
      {_renderIslandBridgeLayer({ showStreets, islands: data.islands })}

      {/* Optional dot debug */}
      {_renderDebugDotsLayer({ showDots, districts: data.districts })}

      {/* Labels */}
      {_renderLabelsLayer({ showLabels, districts: data.districts })}

      {/* HOVER CAPTURE — transparent full-polygon paths for each district. */}
      {_renderHoverCaptureLayer({ districts: data.districts, setHoveredDistrict })}
    </svg>
  );
}

// ============================================================
// EXPORTS
// ============================================================

window.CityMapV3 = CityMapV3;
window.buildCityV3 = buildCityV3;
window.cityV3DotPos = cityV3DotPos;
window.cityV3DotDistance = cityV3DotDistance;
window.whoCanThisCardSeeV3 = whoCanThisCardSeeV3;
window.whoCanSeeMeV3 = whoCanSeeMeV3;
window.CITY_V3_W = VIEW_W;
window.CITY_V3_H = VIEW_H;
window.C_CELL_W = CELL_UNIT;
window.C_CELL_H = CELL_UNIT;
