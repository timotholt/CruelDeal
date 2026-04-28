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
  MICRO_LANDMARK_SHAPES: _MICRO_LANDMARK_SHAPES,
  PAL
} = window.CityMapConfigV3;

// ============================================================
// GEOMETRY UTILITIES
// ============================================================

const {
  segIntersect: _segIntersect,
  pointInPolygon: _pointInPolygon,
  polygonArea: _polygonArea,
  polygonCentroid: _polygonCentroid,
  pointToSegmentDist: _pointToSegmentDist,
  insetPolygon: _insetPolygon,
  polygonBBox: _polygonBBox,
  distToRiver: _distToRiver
} = window.CityMapGeometryV3;

const {
  polygonToPath: _polygonToPath,
  polygonOutlinePathSkipRoads: _polygonOutlinePathSkipRoads,
  polygonOutlinePathClippedToViewport: _polygonOutlinePathClippedToViewport,
  cutSegments: _cutSegments,
  smoothClosedPath: _smoothClosedPath,
  straightPolylinePath: _straightPolylinePath,
  cutPath: _cutPath,
  cutPoints: _cutPoints,
  offsetPolyline: _offsetPolyline
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
  leavesUnder: _leavesUnder,
  truncateCutAtRiver: _truncateCutAtRiver,
  nearestLandmarkDistance: _nearestLandmarkDistance,
  weightedPickRemove: _weightedPickRemove
} = window.CityMapPartitionV3;
const {
  generateBlockBuildings: _generateBlockBuildings
} = window.CityMapBuildingsV3;
const {
  generateIslands: _generateIslands
} = window.CityMapIslandsV3;
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

  // 6. Landmarks per district. Rules:
  //    - At most 1 BIG landmark per district.
  //    - At most 1 STADIUM per district (independent of big-landmark count).
  //    - Stadium probability per big-landmark candidate ≈ 30%, mall ≈ 40%, big-park ≈ 30%.
  for (const d of districts) {
    const big = d.leafBlocks.filter(lb => lb.bigLandmark);
    const small = d.leafBlocks.filter(lb => !lb.bigLandmark);
    const picks = [];
    if (big.length > 0) {
      // Take just ONE big landmark per district.
      // Prefer the most central candidate to avoid edge-cropped landmarks.
      const sortedBig = big
        .map(lb => ({
          lb,
          dist: Math.hypot(_polygonCentroid(lb.polygon).x - d.centroid.x,
                           _polygonCentroid(lb.polygon).y - d.centroid.y)
        }))
        .sort((a, b) => a.dist - b.dist);
      picks.push({ lb: sortedBig[0].lb, big: true });
    } else {
      // No big block this district — fall back to a regular sized block.
      const sortedSmall = small
        .map(lb => ({ lb, area: _polygonArea(lb.polygon) }))
        .filter(x => x.area > 300 && x.area < 2500)
        .sort((a, b) => b.area - a.area + (rng() - 0.5) * 200);
      if (sortedSmall.length > 0) picks.push({ lb: sortedSmall[0].lb, big: false });
    }
    // Always seed additional small parks/plazas/strip-malls per district.
    // Real cities have *many* small green & civic spaces. Smaller blocks get
    // weighted heavily, but parks keep a minimum spacing from other parks so
    // the result reads like a distributed park system instead of green clumps.
    const numSmallExtra = 24 + Math.floor(rng() * 9); // 24..32
    {
      const candidates = small
        .map(lb => ({ lb, area: _polygonArea(lb.polygon) }))
        // Allow tinier candidates so pocket parks slot into the dense grid.
        .filter(x => x.area > 45 && x.area < 1500)
        .filter(x => !picks.some(p => p.lb === x.lb))
        .map(x => ({
          ...x,
          // Inverse-area weighting: tiny blocks can become pocket parks, while
          // larger blocks are still available for plazas and strip malls.
          weight: Math.pow(1400 / Math.max(55, x.area), 1.35) * (0.75 + rng() * 0.5)
        }));
      for (let k = 0; k < numSmallExtra && candidates.length; k++) {
        const picked = _weightedPickRemove(candidates, rng);
        picks.push({ lb: picked.lb, big: false, area: picked.area });
      }
    }

    let stadiumUsed = false;
    for (const p of picks) {
      const lb = p.lb;
      let type;
      if (p.big) {
        const r = rng();
        if (!stadiumUsed && r < 0.30) {
          // Pick a sport for the stadium. Each sport has a different field
          // aspect ratio that's drawn at the correct relative size inside
          // the block (see _renderLandmark for the exact field geometry).
          const sportR = rng();
          if (sportR < 0.34)      type = "stadium_soccer";   // most common
          else if (sportR < 0.67) type = "stadium_football"; // long, narrow
          else                    type = "stadium_baseball"; // diamond + outfield
          stadiumUsed = true;
        }
        else if (r < 0.30 + 0.40)     type = "mall";
        else                          type = "park";
      } else {
        // Small landmark type weighted by block area:
        //   tiny block (<=120 px2): nearly always a pocket park
        //   small      (<=420)   : heavily park-biased
        //   medium     (<=800)   : mixed park/plaza/mall
        //   large      (<=1500)  : more civic/commercial than green
        // Smaller block ⇒ much more likely to be a pocket park.
        const area = p.area != null ? p.area : _polygonArea(lb.polygon);
        let parkP, plazaP;
        if      (area <= 120)  { parkP = 0.995; plazaP = 0.005; }
        else if (area <= 220)  { parkP = 0.97; plazaP = 0.025; }
        else if (area <= 420)  { parkP = 0.88; plazaP = 0.09; }
        else if (area <= 800)  { parkP = 0.62; plazaP = 0.25; }
        else                    { parkP = 0.28; plazaP = 0.44; }
        const r = rng();
        if (r < parkP)              type = "park";
        else if (r < parkP + plazaP) type = "plaza";
        else                         type = "mall"; // small "strip mall"

        if (type === "park") {
          const parkSpacing = area <= 120 ? 11 : (area <= 300 ? 16 : 24);
          const nearPark = _nearestLandmarkDistance(lb.polygon, d.landmarks, lm => lm.type === "park") < parkSpacing;
          if (nearPark) {
            // Keep the block special, but don't create park clusters.
            type = rng() < 0.68 ? "plaza" : "mall";
          }
        }
      }
      const landmark = {
        polygon: lb.polygon,
        path: _polygonToPath(lb.polygon),
        type
      };
      d.landmarks.push(landmark);
    }

    // ----- MICRO-LANDMARK PASS — DISABLED -----
    // The tetromino-shaped sub-block landmarks didn't read well at this scale
    // (small parks ended up looking like floating debris on the block). Left
    // in as commented code for now in case we want to revisit a different
    // approach (e.g. only on bigger blocks, or as building-aligned cutouts).
    /*
    const usedBlocks = new Set(picks.map(p => p.lb));
    const microShapes = _MICRO_LANDMARK_SHAPES;
    for (const lb of d.leafBlocks) {
      if (usedBlocks.has(lb)) continue;
      if (rng() > 0.30) continue;
      const blockArea = _polygonArea(lb.polygon);
      if (blockArea < 220 || blockArea > 2200) continue;
      const c = _polygonCentroid(lb.polygon);
      let minR = Infinity;
      for (let i = 0; i < lb.polygon.length; i++) {
        const a = lb.polygon[i];
        const b = lb.polygon[(i + 1) % lb.polygon.length];
        const d2 = _pointToSegmentDist(c.x, c.y, a, b);
        if (d2 < minR) minR = d2;
      }
      const shape = microShapes[Math.floor(rng() * microShapes.length)];
      const fillFrac = 0.35 + rng() * 0.30;
      const scale = (minR * 2 * fillFrac) / shape.unitSize;
      const rot = cityGridAngle + (rng() < 0.5 ? 0 : Math.PI / 2);
      const cosR = Math.cos(rot), sinR = Math.sin(rot);
      const microPoly = shape.points.map(p => {
        const ux = (p.x - shape.unitSize / 2) * scale;
        const uy = (p.y - shape.unitSize / 2) * scale;
        return {
          x: c.x + ux * cosR - uy * sinR,
          y: c.y + ux * sinR + uy * cosR,
          edgeKind: "coast"
        };
      });
      let inside = true;
      for (const p of microPoly) {
        if (!_pointInPolygon(p, lb.polygon)) { inside = false; break; }
      }
      if (!inside) continue;
      const r = rng();
      const microType = (r < 0.55) ? "park" : (r < 0.85) ? "plaza" : "mall";
      d.landmarks.push({
        polygon: microPoly,
        path: _polygonToPath(microPoly),
        type: microType,
        micro: true
      });
    }
    */
  }

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
  // Buffers are tuned to the visible street widths in `_streetStyle` + an extra
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

  // 12. Bridges — placed where BIG and MID streets (highway / avenue / main
  // street / collector-local) and the coast road cross the river. Rules:
  //   - Cuts with depth <= 3 are eligible (highways, avenues, main streets,
  //     and the next road level down). Smaller local streets still dead-end at
  //     the bank in step 12b.
  //   - Sort cuts by depth (highways first) so bigger streets get priority.
  //     If two streets cross the river too close together, only the bigger
  //     one (or earliest in iteration) gets a bridge.
  //   - Enforce a MIN_BRIDGE_DIST so bridges aren't piled on top of each other.
  //   - The coast road also gets bridges where the river meets the coast.
  const bridges = [];
  const MIN_BRIDGE_DIST = 20; // px between major bridge centers
  const _bridgeMinDist = (depth) => {
    if (depth <= 1) return 20;
    if (depth === 2) return 17;
    return 14;
  };
  const _bridgeTooClose = (x, y, depth, list = bridges) => {
    const candidateMinDist = _bridgeMinDist(depth);
    for (const b of list) {
      const minDist = Math.max(candidateMinDist, _bridgeMinDist(b.depth));
      if (Math.hypot(b.x - x, b.y - y) < minDist) return true;
    }
    return false;
  };
  const _cutRiverHits = (cut) => {
    const hits = [];
    const cutSegs = _cutSegments(cut);
    let along = 0;
    for (const cs of cutSegs) {
      const segLen = Math.hypot(cs.b.x - cs.a.x, cs.b.y - cs.a.y) || 1;
      for (const rs of riverSegments || []) {
        const hit = _segIntersect(cs.a, cs.b, rs.a, rs.b);
        if (!hit) continue;
        hits.push({
          x: hit.x,
          y: hit.y,
          along: along + hit.t * segLen,
          roadAngle: Math.atan2(cs.b.y - cs.a.y, cs.b.x - cs.a.x)
        });
      }
      along += segLen;
    }
    hits.sort((a, b) => a.along - b.along);
    const clustered = [];
    for (const h of hits) {
      const prev = clustered[clustered.length - 1];
      if (prev && Math.hypot(prev.x - h.x, prev.y - h.y) < 18) {
        prev.x = (prev.x + h.x) / 2;
        prev.y = (prev.y + h.y) / 2;
        prev.along = (prev.along + h.along) / 2;
      } else {
        clustered.push({ ...h });
      }
    }
    return clustered;
  };
  if (riverSegments) {
    // (a) Street bridges — depth-0/1/2/3 cuts crossing the river.
    const cutsByPriority = [...allCuts]
      .filter(c => c.depth <= 3 && !c.riverBank)
      .sort((a, b) => a.depth - b.depth);
    for (const cut of cutsByPriority) {
      for (const hit of _cutRiverHits(cut)) {
        const tooClose = _bridgeTooClose(hit.x, hit.y, cut.depth);
        if (tooClose && cut.depth > 0) continue;
        bridges.push({
          x: hit.x,
          y: hit.y,
          angle: hit.roadAngle,
          roadAngle: hit.roadAngle,
          depth: cut.depth
        });
        break;
      }
    }

    // Highway backstop: divided highways are the one road tier that should
    // never appear to dive under / vanish through the river. The spacing pass
    // above handles normal cases; this adds any missing depth-0 crossings.
    for (const cut of allCuts.filter(c => c.depth === 0)) {
      for (const hit of _cutRiverHits(cut)) {
        const already = bridges.some(b => Math.hypot(b.x - hit.x, b.y - hit.y) < 8);
        if (already) continue;
        bridges.push({
          x: hit.x,
          y: hit.y,
          angle: hit.roadAngle,
          roadAngle: hit.roadAngle,
          depth: 0,
          highwayBackstop: true
        });
      }
    }

    // (b) Coast-road bridges — at every river-mouth (where the river crosses
    // the inset coast-road polygon). Treated as avenue-tier (depth=1).
    const NCR = coastRoadPolygon.length;
    for (let i = 0; i < NCR; i++) {
      const a = coastRoadPolygon[i];
      const b = coastRoadPolygon[(i + 1) % NCR];
      let crHit = null;
      let crRiverSeg = null;
      for (const rs of riverSegments) {
        const hit = _segIntersect(a, b, rs.a, rs.b);
        if (hit) { crHit = hit; crRiverSeg = rs; break; }
      }
      if (!crHit) continue;
      let tooClose = false;
      for (const br of bridges) {
        if (Math.hypot(br.x - crHit.x, br.y - crHit.y) < MIN_BRIDGE_DIST) { tooClose = true; break; }
      }
      if (tooClose) continue;
      const segAngle = Math.atan2(b.y - a.y, b.x - a.x);
      bridges.push({ x: crHit.x, y: crHit.y, angle: segAngle, roadAngle: segAngle, depth: 1 });
    }

    // (c) Gap-fill river bridges. After the priority pass, add a few depth-2/3
    // crossings only when they sit in an under-served river stretch. This avoids
    // both giant empty spans and local bridge clusters.
    const fillCandidates = [];
    for (const cut of allCuts) {
      if (cut.riverBank) continue;
      if (cut.depth < 2 || cut.depth > 3) continue;
      const cutSegs = _cutSegments(cut);
      for (const cs of cutSegs) {
        for (let ri = 0; ri < riverSegments.length; ri++) {
          const rs = riverSegments[ri];
          const hit = _segIntersect(cs.a, cs.b, rs.a, rs.b);
          if (!hit) continue;
          const nearest = bridges.reduce((best, b) => Math.min(best, Math.hypot(b.x - hit.x, b.y - hit.y)), Infinity);
          if (nearest < 34 || nearest > 88) continue;
          fillCandidates.push({
            x: hit.x,
            y: hit.y,
            angle: Math.atan2(cs.b.y - cs.a.y, cs.b.x - cs.a.x),
            roadAngle: Math.atan2(cs.b.y - cs.a.y, cs.b.x - cs.a.x),
            depth: cut.depth,
            score: nearest
          });
        }
      }
    }
    fillCandidates.sort((a, b) => b.score - a.score || a.depth - b.depth);
    for (const c of fillCandidates) {
      if (bridges.length > 14) break;
      if (_bridgeTooClose(c.x, c.y, c.depth)) continue;
      bridges.push({ x: c.x, y: c.y, angle: c.angle, roadAngle: c.roadAngle, depth: c.depth });
    }
  }

  // 12c. Offshore bridges — highways that exit into ocean get long causeways
  // extending well off-screen, like real inter-island or mainland crossings.
  // Bridge center is placed far outside the viewport so the span goes from
  // the coastline to beyond the visible area.
  {
    const OFFSHORE_REACH = 160; // px past coast to bridge center
    const offshoreCandidates = [];
    for (const cut of allCuts.filter(c => c.depth === 0)) {
      const pts = cut.polyline && cut.polyline.length >= 2
        ? cut.polyline
        : [cut.p1, cut.p2];
      const ends = [
        { edge: pts[0], next: pts[1] },
        { edge: pts[pts.length - 1], next: pts[pts.length - 2] }
      ];
      for (const end of ends) {
        const dx = end.edge.x - end.next.x;
        const dy = end.edge.y - end.next.y;
        const len = Math.hypot(dx, dy) || 1;
        let ox = dx / len;
        let oy = dy / len;
        if (_pointInPolygon({ x: end.edge.x + ox * 3, y: end.edge.y + oy * 3 }, landPolygon)) {
          ox = -ox; oy = -oy;
        }
        // Center bridge far off-screen; inward half is hidden under land fill.
        const bx = end.edge.x + ox * OFFSHORE_REACH;
        const by = end.edge.y + oy * OFFSHORE_REACH;
        // Skip if somehow still inside viewport (highway endpoint is deep inland).
        if (bx > 4 && bx < VIEW_W - 4 && by > 4 && by < VIEW_H - 4) continue;
        if (riverSegments && _distToRiver(end.edge.x, end.edge.y, riverSegments) < 24) continue;
        offshoreCandidates.push({
          x: bx,
          y: by,
          angle: Math.atan2(oy, ox),
          depth: 0,
          offshore: true
        });
      }
    }
    offshoreCandidates.sort((a, b) => (a.y - b.y) || (a.x - b.x));
    let placedOffshore = 0;
    for (const c of offshoreCandidates) {
      if (placedOffshore >= 2) break;
      if (_bridgeTooClose(c.x, c.y, c.depth)) continue;
      bridges.push(c);
      placedOffshore++;
    }
  }

  // 12b. Truncate small streets that cross the river without a bridge.
  // For cuts that did not get a bridge, any river crossing splits the cut into
  // dead-end halves that retreat from each bank by `riverGap`.
  // For depth 0/1/2/3 cuts that DID get a bridge, leave them intact (the bridge
  // sprite covers the river crossing visually).
  // For eligible cuts that DIDN'T get a bridge (e.g. close to another bigger
  // bridge), truncate so they don't appear to swim across the water.
  let renderedCuts = allCuts;
  if (riverSegments) {
    const riverGap = (river.outerWidth / 2) + 1; // dead-end just past the bank
    // Build a quick lookup of bridge positions keyed by approximate location.
    const hasBridgeNear = (cut) => {
      const segs = _cutSegments(cut);
      for (const cs of segs) {
        for (const rs of riverSegments) {
          const hit = _segIntersect(cs.a, cs.b, rs.a, rs.b);
          if (!hit) continue;
          for (const br of bridges) {
            if (Math.hypot(br.x - hit.x, br.y - hit.y) < 4) return true;
          }
        }
      }
      return false;
    };
    const out = [];
    for (const cut of allCuts) {
      if (cut.depth <= 3 && hasBridgeNear(cut)) {
        out.push(cut);                         // keep big/mid streets that bridge the river
        continue;
      }
      const truncated = _truncateCutAtRiver(cut, riverSegments, riverGap);
      for (const t of truncated) out.push(t);
    }
    renderedCuts = out;
  }

  // 13. Coast-strip micro-buildings — small buildings on the SEAWARD side of
  // the coast road (between the road and the water). Real cities often have
  // beach houses, marinas, or shacks here. Probabilistic per coast segment so
  // the strip isn't continuously built up; some segments stay empty.
  {
    const stripCentroid = _polygonCentroid(coastRoadPolygon);
    const N = coastRoadPolygon.length;
    for (let i = 0; i < N; i++) {
      const a = coastRoadPolygon[i];
      const b = coastRoadPolygon[(i + 1) % N];
      const segDx = b.x - a.x, segDy = b.y - a.y;
      const segLen = Math.hypot(segDx, segDy);
      if (segLen < 5) continue;
      const tx = segDx / segLen, ty = segDy / segLen;
      // Outward perpendicular: pick whichever points away from the centroid.
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      const cmx = mx - stripCentroid.x, cmy = my - stripCentroid.y;
      const p1x = -ty, p1y = tx;
      const outward = (p1x * cmx + p1y * cmy) > 0
        ? { x: p1x,  y: p1y  }
        : { x: -p1x, y: -p1y };

      // 60% of segments stay empty so the strip looks intermittent
      if (rng() < 0.60) continue;

      const numHere = 1 + Math.floor(rng() * 3); // 1..3 small buildings on this segment
      for (let k = 0; k < numHere; k++) {
        const t = (k + 0.5 + (rng() - 0.5) * 0.7) / numHere;
        const along = t * segLen;
        const offset = 1.4 + rng() * 2.6; // 1.4-4.0 px outward into the strip
        const cx = a.x + tx * along + outward.x * offset;
        const cy = a.y + ty * along + outward.y * offset;

        // Must still be inside the land polygon (i.e., not in the ocean)
        if (!_pointInPolygon({ x: cx, y: cy }, landPolygon)) continue;

        // Tiny rectangular footprint, slightly off-axis from the road.
        const w = 1.8 + rng() * 2.4;     // 1.8-4.2 px
        const h = 1.4 + rng() * 1.6;     // 1.4-3.0 px
        const segAng = Math.atan2(ty, tx);
        const ang = segAng + (rng() - 0.5) * 0.5;  // ±~14° wobble
        const ca = Math.cos(ang), sa = Math.sin(ang);
        const corners = [
          { x: -w / 2, y: -h / 2 },
          { x:  w / 2, y: -h / 2 },
          { x:  w / 2, y:  h / 2 },
          { x: -w / 2, y:  h / 2 }
        ].map(p => ({
          x: cx + p.x * ca - p.y * sa,
          y: cy + p.x * sa + p.y * ca
        }));
        if (!corners.every(c => _pointInPolygon(c, landPolygon))) continue;

        buildings.push({
          path:
            `M ${corners[0].x.toFixed(2)} ${corners[0].y.toFixed(2)} ` +
            `L ${corners[1].x.toFixed(2)} ${corners[1].y.toFixed(2)} ` +
            `L ${corners[2].x.toFixed(2)} ${corners[2].y.toFixed(2)} ` +
            `L ${corners[3].x.toFixed(2)} ${corners[3].y.toFixed(2)} Z`,
          shade: rng()
        });
      }
    }
  }

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

// ============================================================
// COMPONENT
// ============================================================

function _districtAlertStyle(alert) {
  if (!alert) return null;
  const raw = typeof alert === "string" ? { level: alert } : alert;
  const level = raw.level || raw.type || raw.color || "yellow";
  const strength = raw.strength != null ? raw.strength : 1;
  const alpha = Math.max(0, Math.min(0.65, (raw.opacity != null ? raw.opacity : 0.28) * strength));
  if (level === "red" || level === "danger" || level === "losing") {
    return { fill: "#ff3868", opacity: alpha, blend: "screen" };
  }
  if (level === "green" || level === "success" || level === "winning") {
    return { fill: "#47ff8a", opacity: alpha, blend: "screen" };
  }
  return { fill: "#ffd84d", opacity: alpha, blend: "screen" };
}

// Stroke styling per BSP depth
function _streetStyle(depth) {
  if (depth === 0) return { width: 1.7, stroke: PAL.hwyInner };
  if (depth === 1) return { width: 1.05, stroke: PAL.avenue };
  if (depth === 2) return { width: 0.48, stroke: PAL.streetMain };
  if (depth === 3) return { width: 0.38, stroke: PAL.streetMain };
  return { width: 0.32, stroke: PAL.streetLocal };
}

// Render a typed landmark (park / plaza / stadium / mall) as SVG.
// Each returns a React fragment.
function _renderLandmark(key, l, opacity) {
  const t = l.type;
  const bbox = _polygonBBox(l.polygon);
  const detailLines = (clipId, stroke = PAL.mallAccent, lineOpacity = 0.45) => {
    const lines = [];
    const span = Math.max(bbox.w, bbox.h);
    if (span < 14) return null;
    const step = span > 42 ? 9 : 7;
    for (let x = bbox.minX + step; x < bbox.maxX - 1; x += step) {
      lines.push(
        <line
          key={`vx-${x.toFixed(1)}`}
          x1={x} y1={bbox.minY} x2={x} y2={bbox.maxY}
          stroke={stroke} strokeWidth={0.22} opacity={lineOpacity}
        />
      );
    }
    for (let y = bbox.minY + step; y < bbox.maxY - 1; y += step) {
      lines.push(
        <line
          key={`hy-${y.toFixed(1)}`}
          x1={bbox.minX} y1={y} x2={bbox.maxX} y2={y}
          stroke={stroke} strokeWidth={0.22} opacity={lineOpacity * 0.85}
        />
      );
    }
    return <g clipPath={`url(#${clipId})`}>{lines}</g>;
  };
  if (t === "stadium_soccer" || t === "stadium_football" || t === "stadium_baseball") {
    // Compute the block's centroid and inscribed-circle-ish min radius, then
    // render a sport-correct field inside. Real-world relative sizes:
    //   soccer pitch    105m x 68m  → 1.55:1 ratio   (medium length)
    //   football field  109m x 49m  → 2.22:1 ratio   (longest, narrowest)
    //   baseball field  120m x 120m → square        (largest area, square)
    // Field is drawn at a size proportional to these ratios so an adjacent
    // baseball field reads as bigger overall than a football field, and a
    // football field reads as longer/narrower than a soccer field.
    let cx = 0, cy = 0;
    const n = l.polygon.length || 1;
    for (const p of l.polygon) { cx += p.x; cy += p.y; }
    cx /= n; cy /= n;
    let minR = Infinity;
    for (let i = 0; i < l.polygon.length; i++) {
      const a = l.polygon[i];
      const b = l.polygon[(i + 1) % l.polygon.length];
      const d = _pointToSegmentDist(cx, cy, a, b);
      if (d < minR) minR = d;
    }
    // Real-world reference: 1 unit = 60 meters. Field is sized to fit inside
    // the block but keeps real-world aspect ratio.
    const REF_M = 60;
    let fwM, fhM; // field width, height in meters
    if (t === "stadium_soccer")        { fwM = 105; fhM = 68; }
    else if (t === "stadium_football") { fwM = 109; fhM = 49; }
    else                                { fwM = 120; fhM = 120; }
    // Scale: pick the largest size that fits with margin
    const maxSizePx = minR * 1.6; // visual cap
    const scale = Math.min(maxSizePx / fwM, (minR * 1.4) / fhM);
    const fw = fwM * scale;
    const fh = fhM * scale;
    // Random orientation per stadium (not all aligned same way)
    const rotDeg = (l.polygon[0].x + l.polygon[0].y) % 90 - 45; // deterministic-ish
    const fillBlock = <path d={l.path} fill={PAL.stadium} />;
    if (fw < 6 || fh < 4) {
      // Block too small — just paint solid green, no field markings
      return <g key={key} opacity={opacity}>{fillBlock}</g>;
    }
    if (t === "stadium_baseball") {
      // Baseball: diamond infield + outer arc. Diamond is a 90° rotated square,
      // outer outfield is a quarter circle bound to the home plate corner.
      const half = fw / 2;
      const diamondSize = fh * 0.42;
      return (
        <g key={key} opacity={opacity} transform={`rotate(${rotDeg} ${cx} ${cy})`}>
          {fillBlock}
          {/* Outfield arc (quarter pie centered on home plate) */}
          <path
            d={`M ${cx - half} ${cy + half * 0.3}
                A ${fw} ${fw} 0 0 1 ${cx + half} ${cy + half * 0.3}
                L ${cx} ${cy + half * 0.3} Z`}
            fill={PAL.stadiumField}
          />
          {/* Infield diamond (rotated square) */}
          <path
            d={`M ${cx} ${cy + half * 0.3}
                L ${cx + diamondSize} ${cy + half * 0.3 - diamondSize}
                L ${cx} ${cy + half * 0.3 - 2 * diamondSize}
                L ${cx - diamondSize} ${cy + half * 0.3 - diamondSize} Z`}
            fill={PAL.diamond}
            stroke={PAL.fieldLine}
            strokeWidth={0.4}
          />
        </g>
      );
    }
    if (t === "stadium_football") {
      // American football: long rectangle with end zones (slight color shift)
      // and yard-line markings.
      const x0 = cx - fw / 2, y0 = cy - fh / 2;
      const ezW = fw * 0.10; // end zone width
      return (
        <g key={key} opacity={opacity} transform={`rotate(${rotDeg} ${cx} ${cy})`}>
          {fillBlock}
          <rect x={x0} y={y0} width={fw} height={fh} fill={PAL.stadiumField} />
          {/* End zones — slightly darker green */}
          <rect x={x0} y={y0} width={ezW} height={fh} fill={PAL.stadium} opacity={0.55} />
          <rect x={x0 + fw - ezW} y={y0} width={ezW} height={fh} fill={PAL.stadium} opacity={0.55} />
          {/* Yard lines */}
          {[0.25, 0.5, 0.75].map((t, i) => (
            <line key={i}
              x1={x0 + ezW + (fw - 2 * ezW) * t} y1={y0 + 0.5}
              x2={x0 + ezW + (fw - 2 * ezW) * t} y2={y0 + fh - 0.5}
              stroke={PAL.fieldLine} strokeWidth={0.35}
            />
          ))}
        </g>
      );
    }
    // Soccer: rectangle, center circle, halfway line, two penalty boxes.
    const x0 = cx - fw / 2, y0 = cy - fh / 2;
    const pbW = fw * 0.12, pbH = fh * 0.55;
    const ccR = Math.min(fw, fh) * 0.13;
    return (
      <g key={key} opacity={opacity} transform={`rotate(${rotDeg} ${cx} ${cy})`}>
        {fillBlock}
        <rect x={x0} y={y0} width={fw} height={fh} fill={PAL.stadiumField} />
        {/* Halfway line */}
        <line x1={cx} y1={y0 + 0.5} x2={cx} y2={y0 + fh - 0.5} stroke={PAL.fieldLine} strokeWidth={0.4} />
        {/* Center circle */}
        <circle cx={cx} cy={cy} r={ccR} fill="none" stroke={PAL.fieldLine} strokeWidth={0.4} />
        {/* Penalty boxes */}
        <rect x={x0} y={cy - pbH / 2} width={pbW} height={pbH} fill="none" stroke={PAL.fieldLine} strokeWidth={0.4} />
        <rect x={x0 + fw - pbW} y={cy - pbH / 2} width={pbW} height={pbH} fill="none" stroke={PAL.fieldLine} strokeWidth={0.4} />
      </g>
    );
  }
  if (t === "mall") {
    const clipId = `clip-${key}`;
    return (
      <g key={key} opacity={opacity}>
        <defs>
          <clipPath id={clipId}>
            <path d={l.path} />
          </clipPath>
        </defs>
        <path d={l.path} fill={PAL.mall} />
        {detailLines(clipId, PAL.mallAccent, 0.36)}
        <path d={l.path} fill="none" stroke={PAL.mallAccent} strokeWidth={0.38} opacity={0.75} />
      </g>
    );
  }
  if (t === "plaza") {
    const clipId = `clip-${key}`;
    return (
      <g key={key} opacity={opacity}>
        <defs>
          <clipPath id={clipId}>
            <path d={l.path} />
          </clipPath>
        </defs>
        <path d={l.path} fill={PAL.plaza} />
        {detailLines(clipId, PAL.fieldLine, 0.28)}
      </g>
    );
  }
  // park / plaza
  return (
    <path
      key={key}
      d={l.path}
      fill={PAL.park}
      opacity={opacity}
    />
  );
}

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

      {/* DOCKS — building-colored rectangles jut into the water. Drawn before
          city land so the in-land half is buried under the coastline, leaving
          only the pier extension visible over the shared water layer. */}
      {data.docks.map((dock, i) => (
        <path key={`dock-${i}`} d={dock.path} fill={PAL.bldgA} />
      ))}

      {/* ISLANDS — small land masses in visible water. Land fill + buildings +
          optional road rendered as a self-contained mini-city block.
          Forked islands have 2 paths rendered with same fill so they merge visually. */}
      {data.islands && data.islands.map((isl, i) => (
        <g key={`isl-${i}`}>
          {isl.paths.map((p, k) => <path key={`isl-land-${k}`} d={p} fill={PAL.land} />)}
          {isl.paths.map((p, k) => <path key={`isl-dim-${k}`} d={p} fill="black" opacity={BASE_MAP_DIM_OPACITY} style={{ pointerEvents: "none" }} />)}
          {isl.buildings.map((b, j) => (
            b.round
              ? <path key={`ib-${j}`} d={b.path} fill={PAL.roundBldg} />
              : <path key={`ib-${j}`} d={b.path} fill={b.shade > 0.5 ? PAL.bldgA : PAL.bldgB} />
          ))}
          {isl.islandRoadPath && showStreets && (
            <path
              d={isl.islandRoadPath}
              fill="none"
              stroke={PAL.streetMain}
              strokeWidth={0.55}
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          )}
          {isl.paths.map((p, k) => (
            <path key={`isl-outline-${k}`} d={p} fill="none" stroke={PAL.coastRoad}
              strokeWidth={0.9} strokeLinejoin="round" opacity={0.80}
              vectorEffect="non-scaling-stroke" />
          ))}
        </g>
      ))}

      <g mask={data.river ? `url(#${idBase}-city-water-cutout)` : undefined}>
      {/* LAND base */}
      <path d={data.landPath} fill={PAL.land} />
      {/* Score-driven win/lose tint over land (no-op if scores not provided) */}
      {scoreTint && (
        <path d={data.landPath} fill={scoreTint.color} opacity={scoreTint.opacity}
          style={{ pointerEvents: "none", mixBlendMode: "multiply" }} />
      )}

      {/* District alert backgrounds. These sit below buildings and roads, so
          notification color reads as a district state without hiding the map. */}
      {data.districts.map(d => {
        const alert = _districtAlertStyle(alertForDistrict(d));
        if (!alert) return null;
        return (
          <path
            key={`alert-${d.idx}`}
            d={d.polygonPath}
            fill={alert.fill}
            opacity={alert.opacity}
            style={{ mixBlendMode: alert.blend, pointerEvents: "none" }}
          />
        );
      })}

      {/* BUILDINGS (subtle footprints — drawn before streets so street network is on top) */}
      <g>
        {data.buildings.map((b, i) => {
          if (b.round) {
            // Round buildings read as landmarks: lighter fill + soft outer halo
            return (
              <g key={`b-${i}`}>
                <path d={b.path} fill={PAL.roundBldg} />
                <path d={b.path} fill="none" stroke={PAL.streetMain} strokeWidth={0.5} opacity={0.48} />
              </g>
            );
          }
          // Exactly TWO building shades — no in-between greys. ~50/50 split.
          const fill = b.shade < 0.5 ? PAL.bldgA : PAL.bldgB;
          return <path key={`b-${i}`} d={b.path} fill={fill} />;
        })}
      </g>

      {/* AMBIENT LANDMARKS (non-district city blocks) */}
      <g clipPath={`url(#${idBase}-land)`}>
        {data.ambientLandmarks.map((l, i) => _renderLandmark(`amb-${i}`, l, 0.7))}
      </g>

      {/* DISTRICT LANDMARKS (block-shaped, possibly large — stadiums / malls / parks / plazas) */}
      <g>
        {data.districts.flatMap((d, di) =>
          d.landmarks.map((l, li) => _renderLandmark(`lm-${di}-${li}`, l, 0.9))
        )}
      </g>

      {/* DISTRICT OUTLINES — under the road layers, so streets/highways cover
          the glow where borders run along roads. */}
      <g>
        {data.districts.map(d => {
          const isHovered = hoveredDistrict === d.idx;
          return (
            <path
              key={`outline-${d.idx}`}
              d={d.outlinePath}
              fill="none"
              stroke={PAL.regionLine}
              strokeWidth={isHovered ? 1.45 : 0.75}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={isHovered ? 0.95 : 0.52}
              vectorEffect="non-scaling-stroke"
              style={{
                filter: isHovered
                  ? `drop-shadow(0 0 2px ${PAL.regionGlow}) drop-shadow(0 0 5px ${PAL.regionGlow}) drop-shadow(0 0 10px ${PAL.regionGlow})`
                  : "none",
                transition: "stroke-width 0.15s ease, opacity 0.15s ease, filter 0.15s ease",
                pointerEvents: "none"
              }}
            />
          );
        })}
      </g>

      {/* STREETS — render in order: deepest (local) first, then thicker.
          Jogged cuts render as angular polylines; old curved cuts still render
          smoothly if re-enabled later. Straight cuts stay as <line>. */}
      {showStreets && (
        <g>
          {sortedCuts.map((cut, i) => {
            const style = _streetStyle(cut.depth);
            if (cut.polyline) {
              return (
                <path
                  key={`s-${i}`}
                  d={_cutPath(cut)}
                  fill="none"
                  stroke={style.stroke}
                  strokeWidth={style.width}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              );
            }
            return (
              <line
                key={`s-${i}`}
                x1={cut.p1.x} y1={cut.p1.y} x2={cut.p2.x} y2={cut.p2.y}
                stroke={style.stroke}
                strokeWidth={style.width}
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            );
          })}
        </g>
      )}

      {/* HIGHWAY OUTER GLOW (over depth-0 cuts, beneath their inner stroke) */}
      {showStreets && (
        <g>
          {hwyCuts.map((cut, i) => {
            const pts = _cutPoints(cut);
            const basePath = _straightPolylinePath(pts);
            if (!cut.dividedHighway) {
              return (
                <g key={`hwy-${i}`}>
                  <path
                    d={basePath}
                    fill="none"
                    stroke={PAL.hwyOuter}
                    strokeWidth={3.3}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={0.30}
                    vectorEffect="non-scaling-stroke"
                  />
                  <path
                    d={basePath}
                    fill="none"
                    stroke={PAL.hwyInner}
                    strokeWidth={1.15}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={0.92}
                    vectorEffect="non-scaling-stroke"
                  />
                </g>
              );
            }
            const left = _straightPolylinePath(_offsetPolyline(pts, -0.72));
            const right = _straightPolylinePath(_offsetPolyline(pts, 0.72));
            return (
              <g key={`hwy-${i}`}>
                <path
                  d={basePath}
                  fill="none"
                  stroke={PAL.hwyOuter}
                  strokeWidth={4.2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={0.34}
                  vectorEffect="non-scaling-stroke"
                />
                <path
                  d={basePath}
                  fill="none"
                  stroke={PAL.hwyOuter}
                  strokeWidth={2.7}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={0.20}
                  vectorEffect="non-scaling-stroke"
                />
                <path
                  d={basePath}
                  fill="none"
                  stroke={PAL.land}
                  strokeWidth={0.82}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={0.95}
                  vectorEffect="non-scaling-stroke"
                />
                <path
                  d={left}
                  fill="none"
                  stroke={PAL.hwyInner}
                  strokeWidth={0.78}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
                <path
                  d={right}
                  fill="none"
                  stroke={PAL.hwyInner}
                  strokeWidth={0.78}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              </g>
            );
          })}
        </g>
      )}

      {/* ROUNDABOUTS — short access spurs from each block-edge midpoint into
          the ring, then the ring road itself encircling the round building.
          Spurs are drawn first so the ring sits cleanly on top of their inner
          ends, making them read as small streets feeding into the rotary. */}
      {showStreets && (
        <g>
          {data.buildings.filter(b => b.round).flatMap((b, i) => {
            const ring = b.ringRadius != null ? b.ringRadius : b.radius * 1.20;
            const mids = b.edgeMidpoints || [];
            const spurs = mids.map((m, j) => {
              const dx = m.x - b.cx;
              const dy = m.y - b.cy;
              const dist = Math.hypot(dx, dy);
              if (dist < ring + 0.5) return null; // edge inside ring (shouldn't happen)
              const ux = dx / dist, uy = dy / dist;
              // Spur runs from the ring outward to the edge midpoint, where it
              // meets the BSP-cut road that bounds the block.
              const x1 = b.cx + ux * ring;
              const y1 = b.cy + uy * ring;
              return (
                <line
                  key={`spur-${i}-${j}`}
                  x1={x1} y1={y1} x2={m.x} y2={m.y}
                  stroke={PAL.streetLocal}
                  strokeWidth={0.32}
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              );
            });
            return [
              <g key={`spurs-${i}`}>{spurs}</g>,
              <g key={`rb-${i}`}>
                <circle
                  cx={b.cx} cy={b.cy} r={ring}
                  fill="none" stroke={PAL.streetLocal} strokeWidth={0.68}
                  opacity={0.32}
                  vectorEffect="non-scaling-stroke"
                />
                <circle
                  cx={b.cx} cy={b.cy} r={ring}
                  fill="none" stroke={PAL.streetLocal} strokeWidth={0.32}
                  opacity={0.82}
                  vectorEffect="non-scaling-stroke"
                />
              </g>
            ];
          })}
        </g>
      )}

      {/* COAST ROAD — inset land polygon stroked as a perimeter avenue */}
      {showStreets && (
        <path
          d={data.coastRoadPath}
          fill="none"
          stroke={PAL.coastRoad}
          strokeWidth={1.3}
          strokeLinejoin="round"
          opacity={0.94}
          vectorEffect="non-scaling-stroke"
        />
      )}

      {/* BASE MAP DIMMER — default darkness applies to the city/land layer only.
          Water stays invariant, so ocean and river remain the exact same color.
          Hover cuts a hole in this dimmer for the active district instead of
          tinting districts different colors or making non-hovered districts
          extra dark. */}
      <path
        d={data.landPath}
        fill="black"
        opacity={BASE_MAP_DIM_OPACITY}
        mask={hoveredDistrict != null ? `url(#${idBase}-map-dim-mask)` : undefined}
        style={{ pointerEvents: "none" }}
      />
      </g>

      {/* BRIDGES — render where big streets and the coast road cross the
          river cutout. Drawn AFTER the city mask so the bridge deck sits
          cleanly over the shared water layer. Width-along-road spans the river;
          thickness-across-road is sized by street depth. */}
      {showStreets && data.bridges && data.bridges.map((b, i) => {
        // Offshore bridge: center is 160px off coast, so 320px total span goes
        // from deep under land to well off-screen — looks like a long causeway.
        const baseW = b.offshore ? 320 : (b.depth === 0 ? 11 : (b.depth === 1 ? 9 : (b.depth === 2 ? 7 : 5.5)));
        const riverW = data.river ? data.river.outerWidth : 0;
        const w = b.offshore ? baseW : Math.max(baseW, riverW + 3);
        const h = b.depth === 0 ? 4.5 : (b.depth === 1 ? 3.6 : 3);
        return (
          <g key={`br-${i}`} transform={`translate(${b.x},${b.y}) rotate(${(b.angle || 0) * 180 / Math.PI})`}>
            {/* road-aligned deck: simpler and closer to the earlier bridge behavior */}
            <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={1} fill="rgba(20,40,65,0.92)" />
            <rect x={-w / 2 + 0.6} y={-h / 2 + 0.6} width={w - 1.2} height={h - 1.2} rx={0.6}
                  fill={PAL.avenue} />
            <rect x={-w / 2} y={-h / 2 - 0.5} width={1.5} height={h + 1} fill="rgba(20,40,65,0.92)" />
            <rect x={ w / 2 - 1.5} y={-h / 2 - 0.5} width={1.5} height={h + 1} fill="rgba(20,40,65,0.92)" />
          </g>
        );
      })}

      {/* ISLAND BRIDGES — connect coast road to each island shore.
          Skipped for micro islands (bridge === null). */}
      {showStreets && data.islands && data.islands.map((isl, i) => {
        if (!isl.bridge) return null;
        const { bridge } = isl;
        const w = bridge.len;
        const h = 3.0;
        return (
          <g key={`isl-br-${i}`} transform={`translate(${bridge.x},${bridge.y}) rotate(${bridge.angle * 180 / Math.PI})`}>
            <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={0.8} fill="rgba(20,40,65,0.92)" />
            <rect x={-w / 2 + 0.5} y={-h / 2 + 0.5} width={w - 1} height={h - 1} rx={0.4}
                  fill={PAL.avenue} opacity={0.85} />
            <rect x={-w / 2} y={-h / 2 - 0.4} width={1.2} height={h + 0.8} fill="rgba(20,40,65,0.90)" />
            <rect x={ w / 2 - 1.2} y={-h / 2 - 0.4} width={1.2} height={h + 0.8} fill="rgba(20,40,65,0.90)" />
          </g>
        );
      })}

      {/* Optional dot debug */}
      {showDots && (
        <g>
          {data.districts.flatMap(d => d.dots.map(p => (
            <circle key={p.id} cx={p.x} cy={p.y} r={1.6} fill={d.color} />
          )))}
        </g>
      )}

      {/* Labels */}
      {showLabels && (
        <g>
          {data.districts.map(d => (
            <text
              key={`lab-${d.idx}`}
              x={d.labelPos.x} y={d.labelPos.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontFamily="'Roboto Mono', 'Azeret Mono', 'JetBrains Mono', monospace"
              fontSize={9.4}
              fontWeight={500}
              letterSpacing={2.0}
              fill={PAL.label}
              stroke={PAL.labelStroke}
              strokeWidth={0.28}
              paintOrder="stroke"
              style={{
                pointerEvents: "none",
                fontStretch: "condensed",
                filter: `drop-shadow(0 0 2px ${PAL.labelGlow}) drop-shadow(0 0 5px ${PAL.labelGlow})`
              }}
            >
              {d.labelText || d.name}
            </text>
          ))}
        </g>
      )}

      {/* HOVER CAPTURE — transparent full-polygon paths for each district,
          rendered last so they sit on top in the SVG event-handling order.
          They emit no visible pixels (fill="transparent") but capture mouse
          events and update the hover state, which drives the outline glow. */}
      <g>
        {data.districts.map(d => (
          <path
            key={`hover-${d.idx}`}
            d={d.polygonPath}
            fill="transparent"
            stroke="none"
            style={{ cursor: "pointer" }}
            onMouseEnter={() => setHoveredDistrict(d.idx)}
            onMouseLeave={() => setHoveredDistrict(prev => prev === d.idx ? null : prev)}
          />
        ))}
      </g>
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
