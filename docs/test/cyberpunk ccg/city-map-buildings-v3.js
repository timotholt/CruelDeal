(function () {
  "use strict";

  const {
    pointInPolygon: _pointInPolygon,
    polygonArea: _polygonArea,
    polygonCentroid: _polygonCentroid,
    pointToSegmentDist: _pointToSegmentDist,
    distToRiver: _distToRiver
  } = window.CityMapGeometryV3;
  const {
    polygonToPath: _polygonToPath
  } = window.CityMapPathsV3;
// ============================================================
// BUILDINGS (subdivide each block into footprints)
// ============================================================

// roadHazards: optional [{ a, b, buffer }, ...] list. Each hazard is a line
// segment with a per-segment buffer (typically half the visible street width
// plus a small setback). Building footprints whose corners fall within the
// segment's buffer are rejected, producing a natural "setback" gap along
// highways/avenues that prevents the wide street stroke from clipping buildings.
function _generateBlockBuildings(blockPolygon, gridAngle, rng, riverSegments, roadHazards, riverBuffer) {
  const blockArea = _polygonArea(blockPolygon);

  // Buffer (in px) to keep building footprints clear of the river. Defaults to
  // 7 (matches a "normal-width" river stroke). When the river is wider/narrower
  // the caller passes the matching buffer.
  const RIVER_BUFFER = (typeof riverBuffer === "number" ? riverBuffer : 7.0);

  const cornerNearRiver = (corners) => {
    if (!riverSegments) return false;
    for (const c of corners) {
      if (_distToRiver(c.x, c.y, riverSegments) < RIVER_BUFFER) return true;
    }
    return false;
  };

  // Per-segment buffer because each road hazard carries its own buffer (highway
  // wider than avenue wider than main street, etc.).
  const cornerNearRoad = (corners) => {
    if (!roadHazards || !roadHazards.length) return false;
    for (const c of corners) {
      for (const hz of roadHazards) {
        const d = _pointToSegmentDist(c.x, c.y, hz.a, hz.b);
        if (d < hz.buffer) return true;
      }
    }
    return false;
  };

  // Detect "irregular" blocks — those whose boundary genuinely deviates from
  // axis-aligned rectangles:
  //   (a) curved-road boundary: ANY vertex tagged "roadMid" (true polyline
  //       mid-point from a curved cut). Straight BSP cuts only produce "road"
  //       endpoints, never "roadMid", so this signal is precise.
  //   (b) coast boundary: ANY "coast" vertex (block touches the irregular land
  //       polygon and likely has multiple coast vertices forming a curve).
  let hasCurvedBoundary = false;
  let hasCoastBoundary = false;
  for (const v of blockPolygon) {
    if (v.edgeKind === "roadMid" || v.edgeKind === "roadBend") hasCurvedBoundary = true;
    if (v.edgeKind === "coast")   hasCoastBoundary  = true;
  }
  const isIrregular = hasCurvedBoundary || hasCoastBoundary;

  // Rare: render the whole block as a single circular landmark building (rotunda / arena).
  // Roads go around it naturally because they're the BSP cuts at the block boundary.
  // Skip on irregular blocks — a perfect circle inside an irregular polygon looks awkward.
  if (!isIrregular && rng() < 0.04 && blockArea > 700) {
    const c = _polygonCentroid(blockPolygon);
    let inscribed = Infinity;
    for (let i = 0; i < blockPolygon.length; i++) {
      const a = blockPolygon[i];
      const b = blockPolygon[(i + 1) % blockPolygon.length];
      const d = _pointToSegmentDist(c.x, c.y, a, b);
      if (d < inscribed) inscribed = d;
    }
    // Building radius: 0.70 of inscribed circle. Roundabout ring sits at
    // 0.85 of inscribed (between building and block edge) so there is clear
    // padding between the ring and the surrounding roads.
    const r = inscribed * 0.70;
    // Skip round building if the block centroid is on the river — riverfront
    // areas read better as open promenade than as a giant stadium in water.
    const centerNearRiver = riverSegments && _distToRiver(c.x, c.y, riverSegments) < r + RIVER_BUFFER;
    let roadCutsCircle = false;
    if (roadHazards && roadHazards.length) {
      for (const hz of roadHazards) {
        if (_pointToSegmentDist(c.x, c.y, hz.a, hz.b) < r + hz.buffer + 1.5) {
          roadCutsCircle = true;
          break;
        }
      }
    }
    if (r > 4.5 && !centerNearRiver && !roadCutsCircle) {
      const sides = 18;
      const pts = [];
      for (let i = 0; i < sides; i++) {
        const ang = (i / sides) * Math.PI * 2;
        pts.push({ x: c.x + Math.cos(ang) * r, y: c.y + Math.sin(ang) * r });
      }
      // Edge midpoints — used to draw short access-road spurs from the
      // roundabout out to each surrounding street, so the stadium reads as
      // connected to the city grid rather than floating in a gap.
      const edgeMidpoints = [];
      for (let i = 0; i < blockPolygon.length; i++) {
        const va = blockPolygon[i];
        const vb = blockPolygon[(i + 1) % blockPolygon.length];
        edgeMidpoints.push({ x: (va.x + vb.x) / 2, y: (va.y + vb.y) / 2 });
      }
      return [{
        path: _polygonToPath(pts),
        shade: rng(),
        round: true,
        cx: c.x,
        cy: c.y,
        radius: r,
        ringRadius: inscribed * 0.85,  // roundabout ring (clear of roads)
        edgeMidpoints
      }];
    }
  }

  // Rotate polygon to (u, v) frame aligned with grid
  const cosG = Math.cos(-gridAngle), sinG = Math.sin(-gridAngle);
  const cosI = Math.cos(gridAngle), sinI = Math.sin(gridAngle);
  let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
  for (const p of blockPolygon) {
    const u = p.x * cosG - p.y * sinG;
    const v = p.x * sinG + p.y * cosG;
    if (u < minU) minU = u;
    if (u > maxU) maxU = u;
    if (v < minV) minV = v;
    if (v > maxV) maxV = v;
  }
  const wU = maxU - minU;
  const wV = maxV - minV;
  if (wU < 7 || wV < 7) return [];

  // Tuned for a Brooklyn-grade fine grid: blocks are tiny (deep BSP), so we
  // also want footprints small enough that even a 100 px² block packs 2-4
  // buildings rather than a single oversized box. CLUSTER / LARGE / MEGA modes
  // still inject per-cell size variety.
  const targetSize = isIrregular
    ? (6.0 + rng() * 2.0)    // ~6-8 px (small, fits curves/coast)
    : (7.0 + rng() * 3.2);   // ~7-10.2 px (dense regular blocks)
  const skipRate = isIrregular ? 0.15 : 0.01;  // almost no empty lots in regular blocks
  const inset    = isIrregular ? 0.30 : 0.30;  // tight inset → buildings nearly touch

  const nU = Math.max(1, Math.round(wU / targetSize));
  const nV = Math.max(1, Math.round(wV / targetSize));
  const cellU = wU / nU;
  const cellV = wV / nV;
  const insetU = inset;
  const insetV = inset;

  const buildings = [];
  // Parallel array of world-space bboxes for previously placed buildings,
  // used by tryPushFootprint to reject overlapping placements. Stored in
  // ROTATED grid space (u, v) — overlaps in this space exactly correspond
  // to overlaps in world space because the rotation is uniform. Comparing
  // in (u, v) avoids reconstructing rotated bboxes per check.
  const placedUVBoxes = [];
  // Small slack (in u,v units) so neighboring buildings have a hair of gap
  // and tiny rounding differences don't trigger false positives.
  const OVERLAP_PAD = 0.25;

  // Helper: validate then push a quad footprint defined in (u,v) space.
  // Irregular/coastal/jogged blocks get occasional mild trapezoid skew so
  // buildings can visually hug angled roads/coastlines instead of looking like
  // a rectangular stamp pasted into a non-rectangular lot.
  const tryPushFootprint = (u1, u2, v1, v2) => {
    if (u2 - u1 < 1.0 || v2 - v1 < 1.0) return false;
    // Reject if this footprint overlaps any previously placed footprint.
    // Two axis-aligned (in u,v) boxes overlap iff they overlap on both axes.
    for (const b of placedUVBoxes) {
      if (u2 + OVERLAP_PAD > b.u1 && u1 - OVERLAP_PAD < b.u2 &&
          v2 + OVERLAP_PAD > b.v1 && v1 - OVERLAP_PAD < b.v2) {
        return false;
      }
    }
    let uvCorners = [
      { u: u1, v: v1 }, { u: u2, v: v1 },
      { u: u2, v: v2 }, { u: u1, v: v2 }
    ];
    if (isIrregular && rng() < 0.36) {
      const maxSkew = Math.min(u2 - u1, v2 - v1) * 0.22;
      const skew = (rng() < 0.5 ? -1 : 1) * maxSkew * (0.45 + rng() * 0.55);
      if (rng() < 0.5) {
        uvCorners = [
          { u: u1 + skew, v: v1 }, { u: u2 + skew, v: v1 },
          { u: u2 - skew, v: v2 }, { u: u1 - skew, v: v2 }
        ];
      } else {
        uvCorners = [
          { u: u1, v: v1 + skew }, { u: u2, v: v1 - skew },
          { u: u2, v: v2 - skew }, { u: u1, v: v2 + skew }
        ];
      }
    }
    const corners = uvCorners.map(p => ({
      x: p.u * cosI - p.v * sinI,
      y: p.u * sinI + p.v * cosI
    }));
    if (!corners.every(c => _pointInPolygon(c, blockPolygon))) return false;
    if (cornerNearRiver(corners)) return false;
    if (cornerNearRoad(corners)) return false;
    buildings.push({
      path: `M ${corners[0].x.toFixed(2)} ${corners[0].y.toFixed(2)} ` +
            `L ${corners[1].x.toFixed(2)} ${corners[1].y.toFixed(2)} ` +
            `L ${corners[2].x.toFixed(2)} ${corners[2].y.toFixed(2)} ` +
            `L ${corners[3].x.toFixed(2)} ${corners[3].y.toFixed(2)} Z`,
      shade: rng()
    });
    placedUVBoxes.push({ u1, u2, v1, v2 });
    return true;
  };

  // Track cells consumed by MEGA mode (a 1x2 or 2x1 footprint covers two cells
  // — we mark the second one so the next iteration skips it).
  const consumed = new Array(nU * nV).fill(false);
  const cellIdx = (i, j) => i * nV + j;

  for (let i = 0; i < nU; i++) {
    for (let j = 0; j < nV; j++) {
      if (consumed[cellIdx(i, j)]) continue;
      // Skip some cells for visual variety
      if (rng() < skipRate) continue;

      // Edge/corner cells (touching the block perimeter) get more cluster /
      // large variety — real cities have varied shops, corner stores, and
      // mixed-use buildings on their street frontage. Interior cells stay
      // more uniform (apartment / office blocks).
      const onEdge = (i === 0 || i === nU - 1 || j === 0 || j === nV - 1);
      const isCorner = (i === 0 || i === nU - 1) && (j === 0 || j === nV - 1);

      // Per-cell mode probabilities (NORMAL / CLUSTER / LARGE / MEGA).
      // MEGA spans 2 cells (1x2 or 2x1) → roughly 2x normal building size.
      let pNormal, pCluster, pLarge;
      if (isCorner)    { pNormal = 0.40; pCluster = 0.40; pLarge = 0.13; } // corners: variety
      else if (onEdge) { pNormal = 0.50; pCluster = 0.30; pLarge = 0.13; }
      else             { pNormal = 0.65; pCluster = 0.07; pLarge = 0.18; } // interior: more big
      // Remaining is MEGA.

      const mode = rng();
      const baseU0 = minU + i * cellU;
      const baseV0 = minV + j * cellV;

      if (mode < pNormal) {
        // NORMAL — one building. Aspect ratio varies via per-axis inset.
        const aspectExtra = (rng() - 0.5) * 0.4 * cellU; // ±20% of cell width on insetU
        const u1 = baseU0 + insetU + Math.max(0, aspectExtra) + rng() * 0.3;
        const u2 = baseU0 + cellU - insetU - Math.max(0, -aspectExtra) - rng() * 0.3;
        const v1 = baseV0 + insetV + rng() * 0.3;
        const v2 = baseV0 + cellV - insetV - rng() * 0.3;
        tryPushFootprint(u1, u2, v1, v2);
      } else if (mode < pNormal + pCluster) {
        // CLUSTER — 2 to 4 micro-buildings inside this cell.
        const layouts = [[2, 1], [1, 2], [2, 2], [3, 1], [1, 3]];
        const [su, sv] = layouts[Math.floor(rng() * layouts.length)];
        const innerInsetU = Math.max(0.25, insetU * 0.55);
        const innerInsetV = Math.max(0.25, insetV * 0.55);
        const subU = (cellU - 2 * innerInsetU) / su;
        const subV = (cellV - 2 * innerInsetV) / sv;
        const subInset = 0.30;
        for (let si = 0; si < su; si++) {
          for (let sj = 0; sj < sv; sj++) {
            if (rng() < 0.22) continue;
            const u1 = baseU0 + innerInsetU + si * subU + subInset + rng() * 0.25;
            const u2 = baseU0 + innerInsetU + (si + 1) * subU - subInset - rng() * 0.25;
            const v1 = baseV0 + innerInsetV + sj * subV + subInset + rng() * 0.25;
            const v2 = baseV0 + innerInsetV + (sj + 1) * subV - subInset - rng() * 0.25;
            tryPushFootprint(u1, u2, v1, v2);
          }
        }
      } else if (mode < pNormal + pCluster + pLarge) {
        // LARGE — single bigger building, more rectangular than NORMAL.
        const tightU = Math.max(0.15, insetU * 0.35);
        const tightV = Math.max(0.15, insetV * 0.35);
        // Bias aspect ratio strongly one way for variety
        const stretchU = rng() < 0.5;
        const u1 = baseU0 + tightU + (stretchU ? 0 : 0.4) + rng() * 0.2;
        const u2 = baseU0 + cellU - tightU - (stretchU ? 0 : 0.4) - rng() * 0.2;
        const v1 = baseV0 + tightV + (stretchU ? 0.4 : 0) + rng() * 0.2;
        const v2 = baseV0 + cellV - tightV - (stretchU ? 0.4 : 0) - rng() * 0.2;
        tryPushFootprint(u1, u2, v1, v2);
      } else {
        // MEGA — span this cell + an adjacent cell (horizontally or vertically).
        // Falls back to LARGE if no neighbor is available/free.
        const canRight = (i + 1 < nU) && !consumed[cellIdx(i + 1, j)];
        const canDown  = (j + 1 < nV) && !consumed[cellIdx(i, j + 1)];
        let placed = false;
        if (canRight && (!canDown || rng() < 0.5)) {
          // 1x2 horizontal mega
          const tightU = Math.max(0.15, insetU * 0.40);
          const tightV = Math.max(0.15, insetV * 0.40);
          const u1 = baseU0 + tightU + rng() * 0.2;
          const u2 = baseU0 + 2 * cellU - tightU - rng() * 0.2;
          const v1 = baseV0 + tightV + rng() * 0.2;
          const v2 = baseV0 + cellV - tightV - rng() * 0.2;
          if (tryPushFootprint(u1, u2, v1, v2)) {
            consumed[cellIdx(i + 1, j)] = true;
            placed = true;
          }
        } else if (canDown) {
          // 2x1 vertical mega
          const tightU = Math.max(0.15, insetU * 0.40);
          const tightV = Math.max(0.15, insetV * 0.40);
          const u1 = baseU0 + tightU + rng() * 0.2;
          const u2 = baseU0 + cellU - tightU - rng() * 0.2;
          const v1 = baseV0 + tightV + rng() * 0.2;
          const v2 = baseV0 + 2 * cellV - tightV - rng() * 0.2;
          if (tryPushFootprint(u1, u2, v1, v2)) {
            consumed[cellIdx(i, j + 1)] = true;
            placed = true;
          }
        }
        if (!placed) {
          // No neighbor available — fall back to a regular LARGE single cell.
          const tightU = Math.max(0.15, insetU * 0.35);
          const tightV = Math.max(0.15, insetV * 0.35);
          const u1 = baseU0 + tightU + rng() * 0.2;
          const u2 = baseU0 + cellU - tightU - rng() * 0.2;
          const v1 = baseV0 + tightV + rng() * 0.2;
          const v2 = baseV0 + cellV - tightV - rng() * 0.2;
          tryPushFootprint(u1, u2, v1, v2);
        }
      }
    }
  }

  // ----- INFILL PASS -----
  // Cities don't leave large vacant lots between buildings. After the main
  // grid pass, scan each cell that produced few buildings and try to insert
  // micro-fillers in any sub-quadrant that's empty enough. This packs in
  // little corner-shop / row-house style structures around the main buildings
  // and dramatically reduces visible empty space.
  if (!isIrregular) {
    // Build a quick proximity test: a candidate point is "empty" if no
    // existing building's bbox is within MIN_FILL_GAP px of it.
    const buildingCenters = [];
    for (const b of buildings) {
      // crude center extraction from path: parse "M x y "
      const m = b.path.match(/^M\s+([0-9.\-]+)\s+([0-9.\-]+)/);
      if (m) buildingCenters.push({ x: parseFloat(m[1]), y: parseFloat(m[2]) });
    }
    const isOpenSpot = (x, y, gap) => {
      for (const c of buildingCenters) {
        if (Math.hypot(c.x - x, c.y - y) < gap) return false;
      }
      return true;
    };
    // Try ~3-4 fillers per main cell — most will fail (overlap / off-polygon)
    // but the survivors fill in gaps.
    for (let i = 0; i < nU; i++) {
      for (let j = 0; j < nV; j++) {
        if (consumed[cellIdx(i, j)]) continue;
        const tries = 3;
        for (let t = 0; t < tries; t++) {
          // Random sub-cell point
          const fu = minU + (i + 0.15 + rng() * 0.7) * cellU;
          const fv = minV + (j + 0.15 + rng() * 0.7) * cellV;
          const fx = fu * cosI - fv * sinI;
          const fy = fu * sinI + fv * cosI;
          // Already covered by main building?
          if (!isOpenSpot(fx, fy, cellU * 0.45)) continue;
          // Tiny micro footprint (~3-5 px)
          const mw = 2.5 + rng() * 2.5;
          const mh = 2.5 + rng() * 2.5;
          const u1 = fu - mw / 2, u2 = fu + mw / 2;
          const v1 = fv - mh / 2, v2 = fv + mh / 2;
          if (tryPushFootprint(u1, u2, v1, v2)) {
            buildingCenters.push({ x: fx, y: fy });
            break; // one filler per cell at most
          }
        }
      }
    }
  }

  return buildings;
}

function _generateCoastStripBuildings(coastRoadPolygon, landPolygon, rng) {
  const buildings = [];
  const stripCentroid = _polygonCentroid(coastRoadPolygon);
  const N = coastRoadPolygon.length;
  for (let i = 0; i < N; i++) {
    const a = coastRoadPolygon[i];
    const b = coastRoadPolygon[(i + 1) % N];
    const segDx = b.x - a.x, segDy = b.y - a.y;
    const segLen = Math.hypot(segDx, segDy);
    if (segLen < 5) continue;
    const tx = segDx / segLen, ty = segDy / segLen;
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    const cmx = mx - stripCentroid.x, cmy = my - stripCentroid.y;
    const p1x = -ty, p1y = tx;
    const outward = (p1x * cmx + p1y * cmy) > 0
      ? { x: p1x,  y: p1y  }
      : { x: -p1x, y: -p1y };

    // 60% of segments stay empty so the strip looks intermittent.
    if (rng() < 0.60) continue;

    const numHere = 1 + Math.floor(rng() * 3);
    for (let k = 0; k < numHere; k++) {
      const t = (k + 0.5 + (rng() - 0.5) * 0.7) / numHere;
      const along = t * segLen;
      const offset = 1.4 + rng() * 2.6;
      const cx = a.x + tx * along + outward.x * offset;
      const cy = a.y + ty * along + outward.y * offset;

      if (!_pointInPolygon({ x: cx, y: cy }, landPolygon)) continue;

      const w = 1.8 + rng() * 2.4;
      const h = 1.4 + rng() * 1.6;
      const segAng = Math.atan2(ty, tx);
      const ang = segAng + (rng() - 0.5) * 0.5;
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
  return buildings;
}


  window.CityMapBuildingsV3 = {
    generateBlockBuildings: _generateBlockBuildings,
    generateCoastStripBuildings: _generateCoastStripBuildings
  };
})();
