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
  MAP_SLOT_HALF_W,
  MAP_SLOT_HALF_H,
  MAP_SLOT_EDGE_PAD,
  LAND_RX,
  LAND_RY,
  CELL_UNIT,
  DISTRICT_NAMES,
  DISTRICT_SHORT_NAMES,
  DISTRICT_COLORS,
  MICRO_LANDMARK_SHAPES: _MICRO_LANDMARK_SHAPES,
  MAP_HUE,
  MAP_SAT,
  PAL
} = window.CityMapConfigV3;

// ============================================================
// GEOMETRY UTILITIES
// ============================================================

const {
  EPS,
  segIntersect: _segIntersect,
  pointInPolygon: _pointInPolygon,
  polygonArea: _polygonArea,
  polygonCentroid: _polygonCentroid,
  pointToSegmentDist: _pointToSegmentDist,
  pointToPolygonSignedDist: _pointToPolygonSignedDist,
  segmentToSegmentDist: _segmentToSegmentDist,
  polygonToPolygonDist: _polygonToPolygonDist,
  clipPolygonToRect: _clipPolygonToRect,
  insetPolygon: _insetPolygon,
  polygonBBox: _polygonBBox,
  closestPointOnPolygon: _closestPointOnPolygon,
  distToRiver: _distToRiver,
  riverToRiverDistance: _riverToRiverDistance
} = window.CityMapGeometryV3;

function _polylabel(polygon, precision = 1.5) {
  return window.CityMapGeometryV3.polylabel(
    polygon,
    precision,
    { x: VIEW_W / 2, y: VIEW_H / 2 }
  );
}

const {
  polygonToPath: _polygonToPath,
  polygonOutlinePathSkipRoads: _polygonOutlinePathSkipRoads,
  polygonOutlinePathClippedToViewport: _polygonOutlinePathClippedToViewport,
  cutSegments: _cutSegments,
  sampleSmoothPolyline: _sampleSmoothPolyline,
  samplesToSegments: _samplesToSegments,
  smoothPolylinePath: _smoothPolylinePath,
  smoothClosedPath: _smoothClosedPath,
  straightPolylinePath: _straightPolylinePath,
  cutPath: _cutPath,
  cutPoints: _cutPoints,
  offsetPolyline: _offsetPolyline,
  rectPolygon: _rectPolygon,
  rectPath: _rectPath
} = window.CityMapPathsV3;

const {
  generateLandPolygon: _generateLandPolygon,
  generateCoastDocks: _generateCoastDocks
} = window.CityMapLandV3;

// Label placement: scored grid search over the visible district polygon.
// Each candidate point gets a score that combines:
//   - distance from polygon edges + landmark edges (clear-space term)
//   - distance from the visible centroid (centering term, penalty)
//   - exclusion: skip candidates inside landmarks
// The candidate with the highest score wins. This is more robust than a
// naive PIA + centroid blend because it considers BOTH terms simultaneously
// at every candidate, rather than picking two separate winners and averaging
// them (which can land in a non-optimal middle).
function _labelMetrics(text) {
  return {
    halfW: Math.min(62, Math.max(24, text.length * 4.9)),
    halfH: 8
  };
}

function _labelPosition(polygon, landmarks, labelText = "", dots = []) {
  const margin = 24;
  const visible = _clipPolygonToRect(polygon, {
    minX: margin, minY: margin,
    maxX: VIEW_W - margin, maxY: VIEW_H - margin
  });
  if (visible.length < 3) return { x: VIEW_W / 2, y: VIEW_H / 2 };

  const xs = visible.map(p => p.x);
  const ys = visible.map(p => p.y);
  const minX = Math.min.apply(null, xs);
  const maxX = Math.max.apply(null, xs);
  const minY = Math.min.apply(null, ys);
  const maxY = Math.max.apply(null, ys);

  const lms = landmarks || [];

  // Visual center — Mapbox/polylabel-style target: the interior point with
  // maximum clearance from district edges. This behaves much better for
  // L-shaped and C-shaped districts than a geometric centroid.
  let cnt = 0, cSumX = 0, cSumY = 0;
  for (let x = minX; x <= maxX; x += 4) {
    for (let y = minY; y <= maxY; y += 4) {
      if (!_pointInPolygon({ x, y }, visible)) continue;
      let inLm = false;
      for (const lm of lms) {
        if (_pointInPolygon({ x, y }, lm.polygon)) { inLm = true; break; }
      }
      if (inLm) continue;
      cSumX += x; cSumY += y; cnt++;
    }
  }
  const centroidX = cnt > 0 ? cSumX / cnt : (minX + maxX) / 2;
  const centroidY = cnt > 0 ? cSumY / cnt : (minY + maxY) / 2;
  const visualCenter = _polylabel(visible, 1.2);
  const targetX = Number.isFinite(visualCenter.x) ? visualCenter.x : centroidX;
  const targetY = Number.isFinite(visualCenter.y) ? visualCenter.y : centroidY;

  const bboxCenterX = (minX + maxX) / 2;
  const bboxCenterY = (minY + maxY) / 2;
  const rectDotDistance = (x, y, halfW, halfH, dot) => {
    const dx = Math.max(Math.abs(dot.x - x) - halfW, 0);
    const dy = Math.max(Math.abs(dot.y - y) - halfH, 0);
    return Math.hypot(dx, dy);
  };

  const labelBoxFits = (x, y, halfW, halfH) => {
    const pts = [
      { x: x - halfW, y: y - halfH },
      { x, y: y - halfH },
      { x: x + halfW, y: y - halfH },
      { x: x - halfW, y },
      { x: x + halfW, y },
      { x: x - halfW, y: y + halfH },
      { x, y: y + halfH },
      { x: x + halfW, y: y + halfH }
    ];
    for (const p of pts) {
      if (!_pointInPolygon(p, visible)) return false;
      for (const lm of lms) {
        if (_pointInPolygon(p, lm.polygon)) return false;
      }
    }
    return true;
  };

  const shortText = DISTRICT_SHORT_NAMES[labelText] || labelText.slice(0, Math.min(4, labelText.length));
  const textOptions = [labelText, shortText].filter((t, i, a) => t && a.indexOf(t) === i);
  let globalBest = null;

  for (const text of textOptions) {
    // Text needs a usable box, not just point clearance. Include letter spacing
    // so long names don't get accepted inside narrow district necks.
    const { halfW: labelHalfW, halfH: labelHalfH } = _labelMetrics(text);
    if (labelBoxFits(targetX, targetY, labelHalfW, labelHalfH)) {
      return { x: targetX, y: targetY, text, score: Infinity, hardFit: true, halfW: labelHalfW, halfH: labelHalfH };
    }
    let best = null;
    const step = 3;
    for (let x = minX; x <= maxX; x += step) {
      for (let y = minY; y <= maxY; y += step) {
        if (!_pointInPolygon({ x, y }, visible)) continue;
        let inLm = false;
        for (const lm of lms) {
          if (_pointInPolygon({ x, y }, lm.polygon)) { inLm = true; break; }
        }
        if (inLm) continue;
        const boxFits = labelBoxFits(x, y, labelHalfW, labelHalfH);

        // Min distance to any visible polygon edge (district boundary or
        // viewport-clip edge — both treated equally because both feel like
        // "edges" to the user).
        let edgeDist = Infinity;
        for (let i = 0; i < visible.length; i++) {
          const a = visible[i];
          const b = visible[(i + 1) % visible.length];
          const d = _pointToSegmentDist(x, y, a, b);
          if (d < edgeDist) edgeDist = d;
        }
        // Min distance to landmark edge.
        for (const lm of lms) {
          for (let i = 0; i < lm.polygon.length; i++) {
            const a = lm.polygon[i];
            const b = lm.polygon[(i + 1) % lm.polygon.length];
            const d = _pointToSegmentDist(x, y, a, b);
            if (d < edgeDist) edgeDist = d;
          }
        }

        let dotDist = Infinity;
        for (const dot of dots || []) {
          dotDist = Math.min(dotDist, rectDotDistance(x, y, labelHalfW + 10, labelHalfH + 10, dot));
        }
        const dotsClear = dotDist > 24;
        // Distance from the visible centroid (for centering).
        const centroidDist = Math.hypot(x - targetX, y - targetY);
        const bboxCenterDist = Math.hypot(x - bboxCenterX, y - bboxCenterY);

        let boxPenalty = boxFits ? 0 : 48;
        let dotPenalty = dotsClear ? 0 : (24 - dotDist) * 2.6 + 32;
        const clearanceScore = Math.min(edgeDist, 30);

        // Score: require a readable label box, then prefer broad interior space.
        // The polylabel target is already the visual-center / clearance answer,
        // so stay close to it unless the text box genuinely cannot fit there.
        const score =
          clearanceScore * 0.72 -
          centroidDist * 1.12 -
          bboxCenterDist * 0.04 -
          boxPenalty -
          dotPenalty;
        if (!best || score > best.score) {
          best = { x, y, text, score, hardFit: boxFits && dotsClear, halfW: labelHalfW, halfH: labelHalfH };
        }
      }
    }
    if (best && best.hardFit) return best;
    if (best && (!globalBest || best.score > globalBest.score)) globalBest = best;
  }
  return globalBest || { x: targetX, y: targetY, text: labelText, ..._labelMetrics(labelText || "") };
}

// Approximate the polygon's viewport-visible area via grid sampling.
function _viewportVisibleArea(polygon) {
  const step = 6;
  let count = 0;
  for (let x = step / 2; x < VIEW_W; x += step) {
    for (let y = step / 2; y < VIEW_H; y += step) {
      if (_pointInPolygon({ x, y }, polygon)) count++;
    }
  }
  return count * step * step;
}

// Rank-based slot assignment: given sorted visible areas for all 3 districts,
// return [totalSlots0, totalSlots1, totalSlots2] in the same order.
// Smallest district → 2 pairs (4 slots), largest → 5 pairs (10 slots),
// middle → 3 or 4 pairs randomly. Guarantees every map has clear size contrast.
function _slotCountsByRank(visAreas, rng) {
  const indexed = visAreas.map((a, i) => ({ a, i }));
  indexed.sort((x, y) => x.a - y.a); // ascending: [smallest, middle, largest]
  const midPairs = rng() < 0.5 ? 3 : 4;
  const pairsByRank = [2, midPairs, 5];
  const result = new Array(visAreas.length);
  indexed.forEach((item, rank) => { result[item.i] = pairsByRank[rank] * 2; });
  return result;
}

// Split a polygon by a line L1-L2. Optionally curve the cut by providing
// `polylineMids`: an array of mid-points that replace the straight segment
// between the two polygon-edge intersection points.
//
// With polylineMids=null: classic straight cut.
// With polylineMids=[M1,M2,...]: the boundary between halves becomes
//   I1 → M1 → M2 → ... → I2 (in half1) and the reverse in half2.
//
// Interior mids MUST lie inside the polygon for the resulting halves to be
// simple. Caller is expected to validate this.
function _splitPolygonByLine(polygon, L1, L2, polylineMids = null, polylineMode = "smooth") {
  const n = polygon.length;
  const ints = [];
  for (let i = 0; i < n; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % n];
    const inter = _segIntersect(L1, L2, a, b);
    if (inter) ints.push({ x: inter.x, y: inter.y, edgeIdx: i, u: inter.u });
  }
  if (ints.length < 2) return null;
  ints.sort((p, q) => p.edgeIdx - q.edgeIdx);
  let I1 = ints[0], I2 = null;
  for (let i = 1; i < ints.length; i++) {
    if (ints[i].edgeIdx !== I1.edgeIdx) { I2 = ints[i]; break; }
  }
  if (!I2) return null;
  if (I1.u < EPS || I1.u > 1 - EPS) return null;
  if (I2.u < EPS || I2.u > 1 - EPS) return null;

  const a = I1.edgeIdx, b = I2.edgeIdx;
  const aKind = polygon[a].edgeKind || "coast";
  const bKind = polygon[b].edgeKind || "coast";

  const mids = polylineMids || [];

  // edgeKind convention:
  //   "road"    = endpoint of a cut (I1 or I2). The OUTGOING edge from this
  //               vertex lies on a road. A run of just I1+I2 means a STRAIGHT
  //               cut (no curve mids); the path is a plain line.
  //   "roadMid" = curve interior mid-point. Indicates a CURVED cut. A run that
  //               contains one or more "roadMid" vertices is a real curve and
  //               should be Q-smoothed at render time.
  //   "roadBend" = angular/jogged interior point. It is still a road edge, but
  //                it must render as straight L segments, not a smoothed curve.
  // This distinction prevents straight-BSP-cut blocks (where 3-4 consecutive
  // vertices are all I1/I2 endpoints from adjacent cuts) from being mistakenly
  // smoothed into pillow shapes.
  const midEdgeKind = polylineMode === "jog" ? "roadBend" : "roadMid";

  // half1 = V0..Va + I1 + mids(forward) + I2 + V(b+1)..Vn-1
  const half1 = [];
  for (let i = 0; i <= a; i++) half1.push({ x: polygon[i].x, y: polygon[i].y, edgeKind: polygon[i].edgeKind });
  half1.push({ x: I1.x, y: I1.y, edgeKind: "road" });
  for (const m of mids) half1.push({ x: m.x, y: m.y, edgeKind: midEdgeKind });
  half1.push({ x: I2.x, y: I2.y, edgeKind: bKind });
  for (let i = b + 1; i < n; i++) half1.push({ x: polygon[i].x, y: polygon[i].y, edgeKind: polygon[i].edgeKind });

  // half2 = I1 + V(a+1)..Vb + I2 + mids(reverse)
  const half2 = [];
  half2.push({ x: I1.x, y: I1.y, edgeKind: aKind });
  for (let i = a + 1; i <= b; i++) half2.push({ x: polygon[i].x, y: polygon[i].y, edgeKind: polygon[i].edgeKind });
  half2.push({ x: I2.x, y: I2.y, edgeKind: "road" });
  for (let i = mids.length - 1; i >= 0; i--) {
    half2.push({ x: mids[i].x, y: mids[i].y, edgeKind: midEdgeKind });
  }

  if (_polygonArea(half1) < 50 || _polygonArea(half2) < 50) return null;

  const polyline = mids.length
    ? [{ x: I1.x, y: I1.y }, ...mids.map(m => ({ x: m.x, y: m.y })), { x: I2.x, y: I2.y }]
    : null;

  return [half1, half2, {
    p1: { x: I1.x, y: I1.y },
    p2: { x: I2.x, y: I2.y },
    polyline,
    polylineMode: mids.length ? polylineMode : null
  }];
}

// Generate a gentle curve polyline from P1 to P2 as [P1, M1, M2, P2].
// 80% "C-curve" (consistent side), 20% "S-curve" (inflects once).
// Amplitude is kept modest (6-14% of length) to minimize polygon-escape.
// Returns null if the segment is too short to bother curving.
function _curveLine(P1, P2, rng) {
  const dx = P2.x - P1.x, dy = P2.y - P1.y;
  const len = Math.hypot(dx, dy);
  if (len < 55) return null;
  const perpX = -dy / len, perpY = dx / len;

  const amp = 0.06 + rng() * 0.08;      // 0.06..0.14
  const isS = rng() < 0.2;
  const side = rng() < 0.5 ? 1 : -1;
  const a1 = (0.55 + rng() * 0.45) * amp * len * side;
  const a2 = (0.55 + rng() * 0.45) * amp * len * (isS ? -side : side);

  const M1 = { x: P1.x + dx * 0.33 + perpX * a1, y: P1.y + dy * 0.33 + perpY * a1 };
  const M2 = { x: P1.x + dx * 0.66 + perpX * a2, y: P1.y + dy * 0.66 + perpY * a2 };
  return [P1, M1, M2, P2];
}

// Try curving an existing straight-cut result. Returns a new split result with
// the polyline embedded if the curve stays inside the polygon; otherwise returns
// null (caller keeps the straight result).
function _tryCurveCut(polygon, straightResult, p1, p2, rng) {
  const I1 = straightResult[2].p1;
  const I2 = straightResult[2].p2;
  const poly = _curveLine(I1, I2, rng);
  if (!poly) return null;
  const mids = poly.slice(1, -1);
  // Reject if any mid escapes the polygon.
  for (const m of mids) {
    if (!_pointInPolygon(m, polygon)) return null;
  }
  const curved = _splitPolygonByLine(polygon, p1, p2, mids);
  if (!curved) return null;
  return curved;
}

function _jogLine(P1, P2, rng) {
  const dx = P2.x - P1.x, dy = P2.y - P1.y;
  const len = Math.hypot(dx, dy);
  if (len < 70) return null;
  const mostlyVertical = Math.abs(dy) >= Math.abs(dx);
  const side = rng() < 0.5 ? 1 : -1;
  const amp = Math.min(54, Math.max(20, len * (0.14 + rng() * 0.12))) * side;
  const makeL = rng() < 0.76;
  const t1 = 0.24 + rng() * 0.18;
  const t2 = makeL
    ? (rng() < 0.5 ? 0.86 + rng() * 0.06 : 0.10 + rng() * 0.06)
    : 0.58 + rng() * 0.18;
  const tA = Math.min(t1, t2);
  const tB = Math.max(t1, t2);
  if (mostlyVertical) {
    const y1 = P1.y + dy * tA;
    const y2 = P1.y + dy * tB;
    if (makeL) {
      return [
        P1,
        { x: P1.x + dx * tA, y: y1 },
        { x: P1.x + dx * tA + amp, y: y1 },
        { x: P1.x + dx * tB + amp, y: y2 },
        { x: P2.x, y: y2 },
        P2
      ];
    }
    return [
      P1,
      { x: P1.x + dx * tA, y: y1 },
      { x: P1.x + dx * tA + amp, y: y1 },
      { x: P1.x + dx * tB + amp, y: y2 },
      { x: P1.x + dx * tB, y: y2 },
      P2
    ];
  }
  const x1 = P1.x + dx * tA;
  const x2 = P1.x + dx * tB;
  if (makeL) {
    return [
      P1,
      { x: x1, y: P1.y + dy * tA },
      { x: x1, y: P1.y + dy * tA + amp },
      { x: x2, y: P1.y + dy * tB + amp },
      { x: P2.x, y: P1.y + dy * tB + amp },
      P2
    ];
  }
  return [
    P1,
    { x: x1, y: P1.y + dy * tA },
    { x: x1, y: P1.y + dy * tA + amp },
    { x: x2, y: P1.y + dy * tB + amp },
    { x: x2, y: P1.y + dy * tB },
    P2
  ];
}

function _polylineInsidePolygon(points, polygon) {
  for (let i = 1; i < points.length - 1; i++) {
    if (!_pointInPolygon(points[i], polygon)) return false;
  }
  const segs = _samplesToSegments(points);
  for (const s of segs) {
    const mid = { x: (s.a.x + s.b.x) / 2, y: (s.a.y + s.b.y) / 2 };
    if (!_pointInPolygon(mid, polygon)) return false;
  }
  return true;
}

// Angular, block-aligned alternative to spline curves. This keeps roads straight
// but adds a notch/step to major district boundaries, which gives districts
// more L/C-shaped silhouettes without turning the road network into curves.
function _tryJogCut(polygon, straightResult, p1, p2, rng) {
  const I1 = straightResult[2].p1;
  const I2 = straightResult[2].p2;
  for (let attempt = 0; attempt < 6; attempt++) {
    const poly = _jogLine(I1, I2, rng);
    if (!poly) return null;
    if (!_polylineInsidePolygon(poly, polygon)) continue;
    const jogged = _splitPolygonByLine(polygon, p1, p2, poly.slice(1, -1), "jog");
    if (!jogged) continue;
    return jogged;
  }
  return null;
}

// Truncate a cut wherever it crosses a river segment, producing dead-end
// halves on each side of the river. Used for streets that don't get a bridge:
// instead of "swimming" across the water, they retreat from each bank by
// `gap` px and stop. Returns an array of cut-like objects.
//
// For a STRAIGHT cut with N crossings, returns N+1 straight stubs.
// For a CURVED cut, the rendered-polyline is sampled and split at crossings;
// each resulting sub-run becomes a polyline cut (preserving the curve).
// If the cut never crosses the river, returns [cut] unchanged (same reference).
// Stubs shorter than `MIN_STUB_LEN` px are discarded so we don't render slivers.
function _truncateCutAtRiver(cut, riverSegs, gap) {
  const MIN_STUB_LEN = 4;
  const segs = _cutSegments(cut);
  if (!segs.length || !riverSegs || !riverSegs.length) return [cut];

  // Build a list of "runs" — each run is a polyline that doesn't cross the river.
  const runs = [];
  let curRun = [{ x: segs[0].a.x, y: segs[0].a.y }];
  let anyHit = false;

  for (const s of segs) {
    const sx = s.b.x - s.a.x, sy = s.b.y - s.a.y;
    const segLen = Math.hypot(sx, sy) || 1;
    const ux = sx / segLen, uy = sy / segLen;

    // Collect every crossing of this rendered segment with any river segment,
    // sorted by distance along the segment so multi-crossings split correctly.
    const hits = [];
    for (const rs of riverSegs) {
      const hit = _segIntersect(s.a, s.b, rs.a, rs.b);
      if (hit) hits.push({ x: hit.x, y: hit.y, t: hit.t });
    }
    if (hits.length === 0) {
      curRun.push({ x: s.b.x, y: s.b.y });
      continue;
    }
    anyHit = true;
    hits.sort((p, q) => p.t - q.t);
    for (const h of hits) {
      // End the current run at `gap` px BEFORE the crossing (back along ray).
      curRun.push({ x: h.x - ux * gap, y: h.y - uy * gap });
      runs.push(curRun);
      // Start a new run at `gap` px AFTER the crossing (continuing along ray).
      curRun = [{ x: h.x + ux * gap, y: h.y + uy * gap }];
    }
    curRun.push({ x: s.b.x, y: s.b.y });
  }
  if (curRun.length) runs.push(curRun);

  if (!anyHit) return [cut];

  // Filter ultra-short stubs and emit cut-like objects matching the original tier.
  const out = [];
  for (const run of runs) {
    if (run.length < 2) continue;
    let len = 0;
    for (let i = 1; i < run.length; i++) {
      len += Math.hypot(run[i].x - run[i - 1].x, run[i].y - run[i - 1].y);
    }
    if (len < MIN_STUB_LEN) continue;
    if (run.length === 2) {
      out.push({ p1: run[0], p2: run[1], depth: cut.depth });
    } else {
      out.push({
        p1: run[0],
        p2: run[run.length - 1],
        polyline: run,
        polylineMode: cut.polylineMode || "jog",
        depth: cut.depth
      });
    }
  }
  return out;
}

// ============================================================
// BSP SUBDIVISION
// ============================================================

function _landmarkCenter(landmarkOrLeaf) {
  return _polygonCentroid(landmarkOrLeaf.polygon);
}

function _nearestLandmarkDistance(polygon, landmarks, predicate) {
  const c = _polygonCentroid(polygon);
  let best = Infinity;
  for (const lm of landmarks) {
    if (predicate && !predicate(lm)) continue;
    const lc = _landmarkCenter(lm);
    const d = Math.hypot(c.x - lc.x, c.y - lc.y);
    if (d < best) best = d;
  }
  return best;
}

function _weightedPickRemove(items, rng) {
  let total = 0;
  for (const item of items) total += Math.max(0, item.weight || 0);
  if (total <= 0) return items.splice(Math.floor(rng() * items.length), 1)[0];
  let ticket = rng() * total;
  for (let i = 0; i < items.length; i++) {
    ticket -= Math.max(0, items[i].weight || 0);
    if (ticket <= 0) return items.splice(i, 1)[0];
  }
  return items.pop();
}

// Pick a cut line aligned to the city's GRID (gridAngle defines the local "north").
// All cuts are at angle gridAngle OR gridAngle+π/2 (with tiny wobble), so blocks come out
// as proper rectangles with varying sizes (not triangles).
function _pickBspCut(polygon, rng, gridAngle, depth) {
  const c = _polygonCentroid(polygon);

  // Compute the polygon's bbox in the rotated grid frame.
  // u-axis = grid direction, v-axis = perpendicular.
  const cosG = Math.cos(-gridAngle), sinG = Math.sin(-gridAngle);
  let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
  for (const p of polygon) {
    const u = p.x * cosG - p.y * sinG;
    const v = p.x * sinG + p.y * cosG;
    if (u < minU) minU = u;
    if (u > maxU) maxU = u;
    if (v < minV) minV = v;
    if (v > maxV) maxV = v;
  }
  const wU = maxU - minU;
  const wV = maxV - minV;

  // Cross-section the LONGER dimension so blocks stay roughly square.
  // If polygon is wider in U direction (along grid), cut line runs in V direction (perpendicular to grid).
  const crossSectU = wU >= wV;
  const baseCutAngle = crossSectU ? (gridAngle + Math.PI / 2) : gridAngle;
  // Structural block cuts stay orthogonal. Diagonal avenues are separate road
  // overlays, not a source of district/block boundaries.
  const wobble = 0;
  const cutAngle = baseCutAngle + wobble;

  const dx = Math.cos(cutAngle), dy = Math.sin(cutAngle);

  // Offset perpendicular to cut direction = along the dimension we're cross-sectioning.
  // If cross-sectioning U: offset is along U-axis = (cos(gridAngle), sin(gridAngle))
  // If cross-sectioning V: offset is along V-axis = (-sin(gridAngle), cos(gridAngle))
  let offDx, offDy, dim;
  if (crossSectU) {
    offDx = Math.cos(gridAngle); offDy = Math.sin(gridAngle);
    dim = wU;
  } else {
    offDx = -Math.sin(gridAngle); offDy = Math.cos(gridAngle);
    dim = wV;
  }
  // Variable block sizes: offset can be anywhere in the middle 50% of the dim
  const offRange = 0.50;
  const offset = (rng() - 0.5) * dim * offRange;
  const px = c.x + offDx * offset;
  const py = c.y + offDy * offset;

  const HUGE = 4000;
  return {
    angle: cutAngle,
    p1: { x: px - dx * HUGE, y: py - dy * HUGE },
    p2: { x: px + dx * HUGE, y: py + dy * HUGE }
  };
}

// Build a single grid-aligned cut line through the polygon's centroid (with offset & wobble).
// Returns null if no clean split is possible. Used by macro division.
function _tryGridCut(polygon, gridAngle, useSecondaryAxis, offsetMagnitude, rng) {
  const c = _polygonCentroid(polygon);
  const baseAngle = useSecondaryAxis ? (gridAngle + Math.PI / 2) : gridAngle;
  const wobble = 0;
  const cutAngle = baseAngle + wobble;
  const dx = Math.cos(cutAngle), dy = Math.sin(cutAngle);
  // Offset perpendicular to cut direction (i.e., along the dimension being split)
  const offDx = -dy, offDy = dx;
  const offset = (rng() - 0.5) * offsetMagnitude;
  const px = c.x + offDx * offset;
  const py = c.y + offDy * offset;
  const HUGE = 4000;
  const p1 = { x: px - dx * HUGE, y: py - dy * HUGE };
  const p2 = { x: px + dx * HUGE, y: py + dy * HUGE };
  const result = _splitPolygonByLine(polygon, p1, p2);
  if (!result) return null;
  return {
    halfA: result[0], halfB: result[1], cutSeg: result[2], angle: cutAngle,
    cutLineP1: p1, cutLineP2: p2  // retained for later curve-attempt re-split
  };
}

function _tryAngleCut(polygon, baseAngle, offsetMagnitude, rng) {
  const c = _polygonCentroid(polygon);
  const wobble = (rng() - 0.5) * 0.035;
  const cutAngle = baseAngle + wobble;
  const dx = Math.cos(cutAngle), dy = Math.sin(cutAngle);
  const offDx = -dy, offDy = dx;
  const offset = (rng() - 0.5) * offsetMagnitude;
  const px = c.x + offDx * offset;
  const py = c.y + offDy * offset;
  const HUGE = 4000;
  const p1 = { x: px - dx * HUGE, y: py - dy * HUGE };
  const p2 = { x: px + dx * HUGE, y: py + dy * HUGE };
  const result = _splitPolygonByLine(polygon, p1, p2);
  if (!result) return null;
  return {
    halfA: result[0], halfB: result[1], cutSeg: result[2], angle: cutAngle,
    cutLineP1: p1, cutLineP2: p2
  };
}

// Split land into 3 macro regions via 2 sequential cuts.
// First cut: split into 2 halves. Second cut: split the LARGER half into 2.
// Result: 3 regions of roughly comparable size.
//
// Highways (depth 0) and avenues (depth 1) are the "curvable" street tiers:
// after finding each best straight cut, we attempt to curve it. If the curve
// escapes the polygon, we silently fall back to the straight cut.
function _macroDivide3(landPolygon, gridAngle, rng, riverSegments = null) {
  const totalArea = _polygonArea(landPolygon);
  // Random target: 15–45% of total for the first (smaller) district.
  // This drives visible size contrast — maps range from near-equal thirds
  // to a clear small/medium/large layout, which makes the rank-based slot
  // assignment (2/3or4/5 cards) feel earned rather than cosmetic.
  const target1 = totalArea * (0.15 + rng() * 0.30);

  // Curved roads are intentionally disabled for now. Keep the spline code above
  // in place so we can re-enable it later. Roads keep their original straight
  // macro cuts; districts get their own optional angular jogs from copies of
  // those cuts so civic boundaries can differ from transport lines.
  const CURVE_P_HIGHWAY = 0.0;
  const CURVE_P_AVENUE  = 0.0;
  const DISTRICT_JOG_P_HIGHWAY = 0.78;
  const DISTRICT_JOG_P_AVENUE = 1.0;

  // Visible bbox dimensions of a polygon clipped to the viewport. Used to
  // reject cuts that produce a thin "sliver" district — even if the area is
  // OK, the visible width can be very small if the polygon extends mostly
  // off-screen. A minimum visible width prevents Akihabara-style ribbons.
  const visibleBBox = (poly) => {
    const clipped = _clipPolygonToRect(poly, { minX: 0, minY: 0, maxX: VIEW_W, maxY: VIEW_H });
    if (clipped.length < 3) return { w: 0, h: 0 };
    let mnX = Infinity, mxX = -Infinity, mnY = Infinity, mxY = -Infinity;
    for (const p of clipped) {
      if (p.x < mnX) mnX = p.x;
      if (p.x > mxX) mxX = p.x;
      if (p.y < mnY) mnY = p.y;
      if (p.y > mxY) mxY = p.y;
    }
    return { w: mxX - mnX, h: mxY - mnY };
  };

  // First cut: try multiple candidates, prefer balanced 1/3-2/3 splits.
  // We progressively relax constraints if no candidate meets the strict bar,
  // so we always find SOME cut even on awkward land polygons.
  const findFirstCut = (minRatio, minVisibleSmaller, minMinDim) => {
    let best = null, bestScore = Infinity;
    for (let attempt = 0; attempt < 24; attempt++) {
      const useSecondary = attempt % 2 === 0;
      const offMag = 80 + rng() * 50;
      const r = _tryGridCut(landPolygon, gridAngle, useSecondary, offMag, rng);
      if (!r) continue;
      const aArea = _polygonArea(r.halfA);
      const bArea = _polygonArea(r.halfB);
      if (aArea < 1500 || bArea < 1500) continue;
      const visA = _viewportVisibleArea(r.halfA);
      const visB = _viewportVisibleArea(r.halfB);
      if (visA < 2500 || visB < 2500) continue;
      const smallerArea = Math.min(aArea, bArea);
      // Prevent one district from being a thin sliver.
      if (smallerArea < totalArea * minRatio) continue;
      if (Math.min(visA, visB) < minVisibleSmaller) continue;
      // Reject if either half's visible bbox has a dimension below threshold —
      // this is what stops "thin Akihabara ribbon" districts.
      const bbA = visibleBBox(r.halfA);
      const bbB = visibleBBox(r.halfB);
      const minDimA = Math.min(bbA.w, bbA.h);
      const minDimB = Math.min(bbB.w, bbB.h);
      if (Math.min(minDimA, minDimB) < minMinDim) continue;
      const score = Math.abs(smallerArea - target1);
      if (score < bestScore) {
        best = { ...r, useSecondary };
        bestScore = score;
      }
    }
    return best;
  };

  // Strict → relaxed → minimal: ensures we always get a cut.
  // minRatio lowered (0.12) to allow visibly smaller districts (feeds the
  // 2-card vs 5-card size contrast driven by _slotCountsByRank).
  let best1 = findFirstCut(0.12, 3500, 48);
  if (!best1) best1 = findFirstCut(0.08, 2800, 38);
  if (!best1) best1 = findFirstCut(0.0, 2000, 28);
  if (!best1) best1 = findFirstCut(0.0, 2000, 0); // last resort
  if (!best1) return { regions: [landPolygon], macroCuts: [] };
  const roadCut1 = {
    p1: best1.cutSeg.p1,
    p2: best1.cutSeg.p2,
    polyline: best1.cutSeg.polyline || null,
    polylineMode: best1.cutSeg.polylineMode || null,
    depth: 0,
    angle: best1.angle,
    dividedHighway: rng() < 0.5
  };

  // HIGHWAY curve attempt — disabled, kept here for later tuning.
  // if (rng() < CURVE_P_HIGHWAY) {
  //   const straightResult = [best1.halfA, best1.halfB, best1.cutSeg];
  //   const curved = _tryCurveCut(landPolygon, straightResult, best1.cutLineP1, best1.cutLineP2, rng);
  //   if (curved) {
  //     best1.halfA = curved[0];
  //     best1.halfB = curved[1];
  //     best1.cutSeg = curved[2];
  //   }
  // }
  // Do not gerrymander across the divided highway. The freeway stays as the
  // hard civic break; smaller arterial/avenue lines do the irregular shaping.
  if (rng() < DISTRICT_JOG_P_HIGHWAY) {
    const straightResult = [best1.halfA, best1.halfB, best1.cutSeg];
    const jogged = _tryJogCut(landPolygon, straightResult, best1.cutLineP1, best1.cutLineP2, rng);
    if (jogged) {
      best1.halfA = jogged[0];
      best1.halfB = jogged[1];
      best1.cutSeg = jogged[2];
    }
  }

  const aArea = _polygonArea(best1.halfA);
  const bArea = _polygonArea(best1.halfB);
  const smaller = aArea <= bArea ? best1.halfA : best1.halfB;
  const larger  = aArea <= bArea ? best1.halfB : best1.halfA;

  // Second cut: split LARGER half. Use perpendicular axis to first cut for visual contrast.
  // Same min-visible-dimension check as the first cut to avoid thin slivers.
  const findSecondCut = (minMinDim) => {
    let bst = null, bstScore = Infinity;
    const secondAxis = !best1.useSecondary;
    for (let attempt = 0; attempt < 24; attempt++) {
      // District splits stay on the primary civic grid. Diagonal avenues are
      // added later as overlay roads; using them for region splitting creates
      // the giant parallelograms we do not want.
      const preferDiagonal = false;
      const offMag = 50 + rng() * 30;
      const r = _tryGridCut(larger, gridAngle, secondAxis, offMag, rng);
      if (!r) continue;
      const xA = _polygonArea(r.halfA);
      const xB = _polygonArea(r.halfB);
      if (xA < 1200 || xB < 1200) continue;
      if (_viewportVisibleArea(r.halfA) < 2500) continue;
      if (_viewportVisibleArea(r.halfB) < 2500) continue;
      const bbA = visibleBBox(r.halfA);
      const bbB = visibleBBox(r.halfB);
      if (Math.min(bbA.w, bbA.h) < minMinDim) continue;
      if (Math.min(bbB.w, bbB.h) < minMinDim) continue;
      // Prefer balanced halves, with a small bonus for diagonal avenue cuts.
      const ratio = Math.max(xA, xB) / Math.max(1, Math.min(xA, xB));
      let riverPenalty = 0;
      if (riverSegments && riverSegments.length && r.cutSeg) {
        let nearestRiver = Infinity;
        for (const rs of riverSegments) {
          nearestRiver = Math.min(nearestRiver, _segmentToSegmentDist(r.cutSeg.p1, r.cutSeg.p2, rs.a, rs.b));
        }
        // Diagonal avenues may cross rivers, but should not run alongside or
        // hug them. Crossing at a clean distance is better for readable bridges.
        if (nearestRiver < 18) riverPenalty += (18 - nearestRiver) / 9;
      }
      const score = ratio - (preferDiagonal ? 0.16 : 0) + riverPenalty;
      if (score < bstScore) { bst = { ...r, isDiagonalAvenue: preferDiagonal }; bstScore = score; }
    }
    return bst;
  };
  let best2 = findSecondCut(55);
  if (!best2) best2 = findSecondCut(45);
  if (!best2) best2 = findSecondCut(30);
  if (!best2) best2 = findSecondCut(0);
  if (!best2) {
    return {
      regions: [smaller, larger],
      macroCuts: [roadCut1]
    };
  }
  const roadSeg2 = best2.cutSeg;
  const roadCut2 = {
    p1: roadSeg2.p1,
    p2: roadSeg2.p2,
    polyline: roadSeg2.polyline || null,
    polylineMode: roadSeg2.polylineMode || null,
    depth: 1,
    angle: best2.angle
  };

  const findDiagonalAvenue = () => {
    let best = null, bestScore = -Infinity;
    for (let attempt = 0; attempt < 48; attempt++) {
      const sign = rng() < 0.5 ? -1 : 1;
      const diagAngle = gridAngle + sign * Math.PI / 4 + (rng() - 0.5) * 0.12;
      const offMag = 185 + rng() * 150;
      const r = _tryAngleCut(landPolygon, diagAngle, offMag, rng);
      if (!r || !r.cutSeg) continue;
      const len = Math.hypot(r.cutSeg.p2.x - r.cutSeg.p1.x, r.cutSeg.p2.y - r.cutSeg.p1.y);
      if (len < Math.min(VIEW_W, VIEW_H) * 0.72) continue;
      const mid = {
        x: (r.cutSeg.p1.x + r.cutSeg.p2.x) / 2,
        y: (r.cutSeg.p1.y + r.cutSeg.p2.y) / 2
      };
      const centerDist = Math.hypot(mid.x - VIEW_W / 2, mid.y - VIEW_H / 2);
      let riverPenalty = 0;
      if (riverSegments && riverSegments.length) {
        let nearestRiver = Infinity;
        let worstParallel = 0;
        for (const rs of riverSegments) {
          nearestRiver = Math.min(nearestRiver, _segmentToSegmentDist(r.cutSeg.p1, r.cutSeg.p2, rs.a, rs.b));
          const riverAngle = Math.atan2(rs.b.y - rs.a.y, rs.b.x - rs.a.x);
          worstParallel = Math.max(worstParallel, Math.abs(Math.cos(diagAngle - riverAngle)));
        }
        if (nearestRiver < 20) riverPenalty += (20 - nearestRiver) * 4;
        riverPenalty += worstParallel * 18;
      }
      const score = len - centerDist * 0.35 - riverPenalty + rng() * 0.01;
      if (score > bestScore) {
        bestScore = score;
        best = {
          p1: r.cutSeg.p1,
          p2: r.cutSeg.p2,
          polyline: null,
          polylineMode: null,
          depth: 2,
          angle: diagAngle,
          diagonalOverlay: true
        };
      }
    }
    return best;
  };
  const diagonalAvenue = rng() < 0.5 ? findDiagonalAvenue() : null;

  // AVENUE curve attempt — but if the highway already curved, drastically
  // reduce the probability of curving the avenue too. Two curves stacked tend
  // to look chaotic; one feature curve per map reads cleaner.
  const highwayCurved = !!(best1.cutSeg && best1.cutSeg.polyline && best1.cutSeg.polylineMode !== "jog");
  const effAvenueP = highwayCurved ? CURVE_P_AVENUE * 0.4 : CURVE_P_AVENUE;
  // AVENUE curve attempt — disabled, kept here for later tuning.
  // if (rng() < effAvenueP) {
  //   const straightResult = [best2.halfA, best2.halfB, best2.cutSeg];
  //   const curved = _tryCurveCut(larger, straightResult, best2.cutLineP1, best2.cutLineP2, rng);
  //   if (curved) {
  //     best2.halfA = curved[0];
  //     best2.halfB = curved[1];
  //     best2.cutSeg = curved[2];
  //   }
  // }
  if (rng() < DISTRICT_JOG_P_AVENUE) {
    const straightResult = [best2.halfA, best2.halfB, best2.cutSeg];
    const jogged = _tryJogCut(larger, straightResult, best2.cutLineP1, best2.cutLineP2, rng);
    if (jogged) {
      best2.halfA = jogged[0];
      best2.halfB = jogged[1];
      best2.cutSeg = jogged[2];
    }
  }

  return {
    regions: [smaller, best2.halfA, best2.halfB],
    macroCuts: diagonalAvenue ? [roadCut1, roadCut2, diagonalAvenue] : [roadCut1, roadCut2]
  };
}

// Recursive BSP. Returns a node tree.
// Each node = { polygon, depth, isLeaf, cut, left, right }
// gridAngle = the city's "street grid" orientation (radians); inherited unchanged so
// every cut at every depth aligns to one of two perpendicular directions.
function _bspSubdivide(polygon, depth, gridAngle, rng) {
  const area = _polygonArea(polygon);
  // Variable termination so blocks have varied sizes. Tuned for a Brooklyn-
  // style fine grid: many tiny blocks, each holding 2-4 buildings.
  const minArea = 160 + rng() * 200;           // ~160..360 px²
  const maxDepth = 8 + Math.floor(rng() * 3);  // 8..10

  // Rare: stop early at mid-depth to leave a BIG block (stadium / mall / park).
  // Probability scaled so we get ~1-2 of these per district on average.
  if (depth >= 3 && depth <= 4 && rng() < 0.08 && area > 1800 && area < 6000) {
    return { polygon, depth, isLeaf: true, bigLandmark: true };
  }

  if (depth >= maxDepth || area < minArea) {
    return { polygon, depth, isLeaf: true };
  }

  // Try a few cut candidates; accept the first that splits cleanly. Min child
  // area lowered so the BSP can produce the small blocks we need for a fine
  // street grid. Buildings inside still have their own size floors.
  let result = null, cutInfo = null;
  for (let attempt = 0; attempt < 6; attempt++) {
    cutInfo = _pickBspCut(polygon, rng, gridAngle, depth);
    result = _splitPolygonByLine(polygon, cutInfo.p1, cutInfo.p2);
    if (result) {
      const [a, b] = result;
      if (_polygonArea(a) > 30 && _polygonArea(b) > 30) break;
      result = null;
    }
  }
  if (!result) return { polygon, depth, isLeaf: true };

  const [pA, pB, cutSeg] = result;
  return {
    polygon, depth, isLeaf: false,
    cut: { ...cutSeg, depth, angle: cutInfo.angle },
    left: _bspSubdivide(pA, depth + 1, gridAngle, rng),
    right: _bspSubdivide(pB, depth + 1, gridAngle, rng)
  };
}

function _collectAllCuts(node, out = []) {
  if (!node.isLeaf) {
    out.push(node.cut);
    _collectAllCuts(node.left, out);
    _collectAllCuts(node.right, out);
  }
  return out;
}

function _collectLeaves(node, out = []) {
  if (node.isLeaf) {
    out.push(node);
  } else {
    _collectLeaves(node.left, out);
    _collectLeaves(node.right, out);
  }
  return out;
}

function _collectAtDepth(node, targetDepth, out = []) {
  if (node.depth === targetDepth || node.isLeaf) {
    out.push(node);
  } else {
    _collectAtDepth(node.left, targetDepth, out);
    _collectAtDepth(node.right, targetDepth, out);
  }
  return out;
}

function _leavesUnder(node, out = []) {
  if (node.isLeaf) {
    out.push(node);
  } else {
    _leavesUnder(node.left, out);
    _leavesUnder(node.right, out);
  }
  return out;
}

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

// ============================================================
// PLACEMENT
// ============================================================

// Place dots across the polygon by:
//   1. Best-candidate seeding: favor edge clearance first, spacing second.
//   2. Spring relaxation: strong repulsion from district/map edges, softer
//      repulsion between dots so clusters can still happen.
function _placeDotsInPolygon(polygon, rng, leafBlocksToAvoid, target, visibleArea, labelAvoid = null) {
  const xs = polygon.map(p => p.x);
  const ys = polygon.map(p => p.y);
  const PLACEMENT_RING_SAFE_EDGE = MAP_SLOT_EDGE_PAD;
  const VIEW_EDGE_PAD = PLACEMENT_RING_SAFE_EDGE;
  const minX = Math.max(VIEW_EDGE_PAD, Math.min.apply(null, xs));
  const maxX = Math.min(VIEW_W - VIEW_EDGE_PAD, Math.max.apply(null, xs));
  const minY = Math.max(VIEW_EDGE_PAD, Math.min.apply(null, ys));
  const maxY = Math.min(VIEW_H - VIEW_EDGE_PAD, Math.max.apply(null, ys));
  const placed = [];
  if (maxX - minX < 16 || maxY - minY < 16) return placed;

  // Target spacing derived from area & count → reasonable density regardless of district size.
  const area = Math.max(1, visibleArea || ((maxX - minX) * (maxY - minY)));
  const idealSpacing = Math.sqrt(area / Math.max(1, target)) * 0.92;

  const insideBlocked = (x, y) => {
    if (!_pointInPolygon({ x, y }, polygon)) return true;
    if (labelAvoid) {
      const pad = Math.max(MAP_SLOT_HALF_W, MAP_SLOT_HALF_H) + 7;
      if (
        Math.abs(x - labelAvoid.x) < labelAvoid.halfW + pad &&
        Math.abs(y - labelAvoid.y) < labelAvoid.halfH + pad
      ) {
        return true;
      }
    }
    for (const lb of leafBlocksToAvoid) {
      if (_pointInPolygon({ x, y }, lb.polygon)) return true;
    }
    return false;
  };
  const edgeDistance = (x, y) => {
    let best = Math.min(x, y, VIEW_W - x, VIEW_H - y);
    for (let k = 0; k < polygon.length; k++) {
      const a = polygon[k];
      const b = polygon[(k + 1) % polygon.length];
      best = Math.min(best, _pointToSegmentDist(x, y, a, b));
    }
    return best;
  };

  // ----- Phase 1: candidate pool + coverage selection -----
  // Build a legal pool first, then choose points by coverage rather than
  // sequential random luck. This avoids straight-line accidents and gives
  // labels like Ginza/Nakano/Ninjuku dots that intentionally occupy the shape.
  const centroid = _polygonCentroid(polygon);
  const candidates = [];
  const candidateTarget = Math.max(700, target * 180);
  let attempts = 0;
  while (candidates.length < candidateTarget && attempts < candidateTarget * 8) {
    attempts++;
    const x = minX + rng() * (maxX - minX);
    const y = minY + rng() * (maxY - minY);
    if (insideBlocked(x, y)) continue;
    const edgeD = edgeDistance(x, y);
    if (edgeD < PLACEMENT_RING_SAFE_EDGE) continue;
    candidates.push({
      x, y, edgeD,
      angle: Math.atan2(y - centroid.y, x - centroid.x),
      radial: Math.hypot(x - centroid.x, y - centroid.y)
    });
  }
  const angleSep = (a, b) => {
    const d = Math.abs(a - b) % (Math.PI * 2);
    return Math.min(d, Math.PI * 2 - d);
  };
  while (placed.length < target && candidates.length) {
    let bestIdx = -1, bestScore = -Infinity;
    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      let nearestDot = placed.length ? Infinity : idealSpacing * 0.75;
      let nearestAngle = placed.length ? Infinity : Math.PI;
      for (const p of placed) {
        nearestDot = Math.min(nearestDot, Math.hypot(p.x - c.x, p.y - c.y));
        nearestAngle = Math.min(nearestAngle, angleSep(p.angle, c.angle));
      }
      const spacingScore = Math.min(nearestDot, idealSpacing * 1.15);
      const edgeBand = Math.min(c.edgeD - PLACEMENT_RING_SAFE_EDGE, idealSpacing * 0.45);
      const radialScore = Math.min(c.radial, idealSpacing * 1.35);
      const angleScore = Math.min(nearestAngle, Math.PI / 2) * 12;
      const score =
        spacingScore * 1.20 +
        edgeBand * 0.50 +
        radialScore * 0.34 +
        angleScore +
        rng() * 0.01;
      if (score > bestScore) { bestScore = score; bestIdx = i; }
    }
    if (bestIdx < 0) break;
    placed.push(candidates.splice(bestIdx, 1)[0]);
  }

  // If we couldn't even seed enough dots, return what we have.
  if (placed.length < 2) return placed;

  // The minimum distance from any polygon edge (= a road or coast). Dots
  // closer than this to ANY edge would feel like they're sitting on the road
  // boundary — bad for gameplay readability. Tuned so even small districts
  // keep dots clearly inside.
  const HARD_MIN_EDGE = PLACEMENT_RING_SAFE_EDGE;

  // ----- Phase 2: spring relaxation for even spread + edge avoidance -----
  const ITERATIONS = 10;          // light polish; selection already handles spread
  const stepScale = 0.28;
  const EDGE_BUFFER = HARD_MIN_EDGE + 8;
  const DOT_REPEL_SPACING = idealSpacing * 0.58;
  for (let iter = 0; iter < ITERATIONS; iter++) {
    for (let i = 0; i < placed.length; i++) {
      let fx = 0, fy = 0;
      // Repulsion between dots
      for (let j = 0; j < placed.length; j++) {
        if (i === j) continue;
        const dx = placed[i].x - placed[j].x;
        const dy = placed[i].y - placed[j].y;
        const d = Math.hypot(dx, dy);
        if (d > 0.01 && d < DOT_REPEL_SPACING) {
          const f = (DOT_REPEL_SPACING - d) / DOT_REPEL_SPACING * 0.72;
          fx += (dx / d) * f;
          fy += (dy / d) * f;
        }
      }
      // Repulsion from polygon edges (push toward interior)
      for (let k = 0; k < polygon.length; k++) {
        const a = polygon[k];
        const b = polygon[(k + 1) % polygon.length];
        const ex = b.x - a.x, ey = b.y - a.y;
        const len2 = ex * ex + ey * ey || 1e-9;
        const t = Math.max(0, Math.min(1, ((placed[i].x - a.x) * ex + (placed[i].y - a.y) * ey) / len2));
        const cx = a.x + t * ex, cy = a.y + t * ey;
        const dx = placed[i].x - cx, dy = placed[i].y - cy;
        const d = Math.hypot(dx, dy);
        if (d < EDGE_BUFFER && d > 0.01) {
          // Stronger force closer to the edge
          const f = (EDGE_BUFFER - d) / EDGE_BUFFER * 1.75;
          fx += (dx / d) * f;
          fy += (dy / d) * f;
        }
      }
      // Apply force, clamp to polygon
      const newX = placed[i].x + fx * stepScale;
      const newY = placed[i].y + fy * stepScale;
      if (!insideBlocked(newX, newY) && edgeDistance(newX, newY) >= HARD_MIN_EDGE) {
        placed[i].x = Math.max(minX, Math.min(maxX, newX));
        placed[i].y = Math.max(minY, Math.min(maxY, newY));
      }
    }
  }

  // ----- Phase 2b: HARD-CONSTRAINT edge fixup -----
  // Any dot still within HARD_MIN_EDGE of a polygon edge gets pushed inward
  // along the inward normal until it clears. Guarantees no dot ends up on
  // a road / district boundary, which is the user-facing requirement.
  const FIXUP_PASSES = 4;
  for (let pass = 0; pass < FIXUP_PASSES; pass++) {
    let allClear = true;
    for (let i = 0; i < placed.length; i++) {
      let nearestD = Infinity;
      let nearestNX = 0, nearestNY = 0; // inward normal
      for (let k = 0; k < polygon.length; k++) {
        const a = polygon[k];
        const b = polygon[(k + 1) % polygon.length];
        const ex = b.x - a.x, ey = b.y - a.y;
        const len2 = ex * ex + ey * ey || 1e-9;
        const t = Math.max(0, Math.min(1, ((placed[i].x - a.x) * ex + (placed[i].y - a.y) * ey) / len2));
        const cx = a.x + t * ex, cy = a.y + t * ey;
        const dx = placed[i].x - cx, dy = placed[i].y - cy;
        const d = Math.hypot(dx, dy);
        if (d < nearestD) {
          nearestD = d;
          if (d > 0.01) { nearestNX = dx / d; nearestNY = dy / d; }
          else { nearestNX = 0; nearestNY = 0; }
        }
      }
      if (nearestD < HARD_MIN_EDGE && nearestD > 0.01) {
        const push = HARD_MIN_EDGE - nearestD + 0.5;
        const nx = placed[i].x + nearestNX * push;
        const ny = placed[i].y + nearestNY * push;
        if (!insideBlocked(nx, ny)) {
          placed[i].x = nx;
          placed[i].y = ny;
          allClear = false;
        }
      }
    }
    if (allClear) break;
  }

  return placed;
}

// ============================================================
// ISLANDS — small land masses in the water, with buildings and a bridge
// ============================================================

function _islandBlob(cx, cy, r, rng) {
  const N = 12 + Math.floor(rng() * 6);
  const pA = rng() * Math.PI * 2, pB = rng() * Math.PI * 2, pC = rng() * Math.PI * 2;
  const poly = [];
  for (let i = 0; i < N; i++) {
    const ang = (i / N) * Math.PI * 2;
    const rad = r * Math.max(0.38,
      0.78 + 0.15 * Math.cos(ang * 2 + pA) + 0.09 * Math.cos(ang * 3 + pB)
           + 0.05 * Math.cos(ang * 5 + pC) + (rng() - 0.5) * 0.16
    );
    poly.push({ x: cx + Math.cos(ang) * rad, y: cy + Math.sin(ang) * rad, edgeKind: "coast" });
  }
  return poly;
}

function _islandShorePt(cx, cy, poly, ux, uy, maxR) {
  let shore = { x: cx, y: cy };
  for (let t = 1; t <= maxR + 12; t++) {
    const pt = { x: cx + ux * t, y: cy + uy * t };
    if (!_pointInPolygon(pt, poly)) { shore = { x: cx + ux * (t - 1), y: cy + uy * (t - 1) }; break; }
  }
  return shore;
}

function _generateIslands(landPolygon, coastRoadPolygon, gridAngle, rng, riverSegments) {
  const viewArea = VIEW_W * VIEW_H;
  const landVisArea = _viewportVisibleArea(landPolygon);
  const waterFraction = 1 - landVisArea / viewArea;
  const MIN_ISLAND_CHANNEL = 14;
  const islandClearsMainland = (poly) => _polygonToPolygonDist(poly, landPolygon) >= MIN_ISLAND_CHANNEL;

  // Only spawn when there's meaningful water
  if (waterFraction < 0.22) return [];
  // Near-guaranteed once threshold is met; probability climbs with water area
  const spawnProb = Math.min(0.94, 0.60 + (waterFraction - 0.22) * 2.8);
  if (rng() > spawnProb) return [];

  // Always just 1 island per map
  for (let tries = 0; tries < 140; tries++) {
    // Allow center slightly off-screen so huge islands can peek in from an edge
    const over = 70;
    const cx = -over + rng() * (VIEW_W + over * 2);
    const cy = -over + rng() * (VIEW_H + over * 2);

    if (_pointInPolygon({ x: cx, y: cy }, landPolygon)) continue;

    const coastClearance = _closestPointOnPolygon(cx, cy, landPolygon).dist;
    if (coastClearance < 10) continue;

    // River clearance
    if (riverSegments) {
      let skip = false;
      for (const seg of riverSegments) {
        if (_pointToSegmentDist(cx, cy, seg.a, seg.b) < 18) { skip = true; break; }
      }
      if (skip) continue;
    }

    // Island must have some part visible
    const maxR = 32 + rng() * 100; // 32–132 px
    if (cx + maxR < 0 || cx - maxR > VIEW_W || cy + maxR < 0 || cy - maxR > VIEW_H) continue;

    // Decide shape: single blob (75%) or forked twin-lobe (25%)
    const isFork = rng() < 0.25 && maxR > 50;

    let polygons, paths, allBuildings, islandRoadPath = null;
    let primaryPoly, primaryCx, primaryCy; // for bridge anchor

    if (!isFork) {
      const poly = _islandBlob(cx, cy, maxR, rng);
      if (!islandClearsMainland(poly)) continue;
      const visVerts = poly.filter(v => v.x > 0 && v.x < VIEW_W && v.y > 0 && v.y < VIEW_H);
      if (visVerts.length < 2) continue;

      polygons = [poly];
      paths = [_smoothClosedPath(poly)];
      allBuildings = _generateBlockBuildings(poly, gridAngle, rng, null, [], undefined);
      primaryPoly = poly; primaryCx = cx; primaryCy = cy;

      const area = Math.abs(_polygonArea(poly));
      if (area > 1800 && rng() < 0.75) {
        for (const useSecondary of [false, true]) {
          const res = _tryGridCut(poly, gridAngle, useSecondary, 0, rng);
          if (res && _polygonArea(res.halfA) > 200 && _polygonArea(res.halfB) > 200) {
            islandRoadPath = `M ${res.cutSeg.p1.x.toFixed(2)} ${res.cutSeg.p1.y.toFixed(2)} L ${res.cutSeg.p2.x.toFixed(2)} ${res.cutSeg.p2.y.toFixed(2)}`;
            break;
          }
        }
      }
    } else {
      // Fork: two overlapping blobs along a random axis, renders as one merged landmass
      const forkAxis = rng() * Math.PI * 2;
      const sep = maxR * (0.65 + rng() * 0.30); // center-to-center
      const r1 = maxR * (0.58 + rng() * 0.14);
      const r2 = maxR * (0.50 + rng() * 0.18);
      const cx1 = cx + Math.cos(forkAxis) * sep * 0.5;
      const cy1 = cy + Math.sin(forkAxis) * sep * 0.5;
      const cx2 = cx - Math.cos(forkAxis) * sep * 0.5;
      const cy2 = cy - Math.sin(forkAxis) * sep * 0.5;
      const poly1 = _islandBlob(cx1, cy1, r1, rng);
      const poly2 = _islandBlob(cx2, cy2, r2, rng);
      if (!islandClearsMainland(poly1) || !islandClearsMainland(poly2)) continue;

      const vis1 = poly1.filter(v => v.x > 0 && v.x < VIEW_W && v.y > 0 && v.y < VIEW_H).length;
      const vis2 = poly2.filter(v => v.x > 0 && v.x < VIEW_W && v.y > 0 && v.y < VIEW_H).length;
      if (vis1 + vis2 < 3) continue;

      polygons = [poly1, poly2];
      paths = [_smoothClosedPath(poly1), _smoothClosedPath(poly2)];
      const b1 = _generateBlockBuildings(poly1, gridAngle, rng, null, [], undefined);
      const b2 = _generateBlockBuildings(poly2, gridAngle, rng, null, [], undefined);
      allBuildings = [...b1, ...b2];
      // Bridge anchors to whichever lobe is closer to the coast road
      const d1 = _closestPointOnPolygon(cx1, cy1, coastRoadPolygon).dist;
      const d2 = _closestPointOnPolygon(cx2, cy2, coastRoadPolygon).dist;
      if (d1 <= d2) { primaryPoly = poly1; primaryCx = cx1; primaryCy = cy1; }
      else          { primaryPoly = poly2; primaryCx = cx2; primaryCy = cy2; }
    }

    // Bridge: micro islands (maxR < 36 and fully in viewport) skip the bridge
    const isMicro = maxR < 36 &&
      cx > 0 && cx < VIEW_W && cy > 0 && cy < VIEW_H;
    let bridge = null;
    if (!isMicro) {
      const coastPt = _closestPointOnPolygon(primaryCx, primaryCy, coastRoadPolygon);
      const bdx = coastPt.x - primaryCx, bdy = coastPt.y - primaryCy;
      const blen = Math.hypot(bdx, bdy) || 1;
      const ux = bdx / blen, uy = bdy / blen;
      const shore = _islandShorePt(primaryCx, primaryCy, primaryPoly, ux, uy, maxR);
      const bridgeLen = Math.hypot(coastPt.x - shore.x, coastPt.y - shore.y);
      if (bridgeLen > 4) {
        bridge = {
          x: (coastPt.x + shore.x) / 2,
          y: (coastPt.y + shore.y) / 2,
          angle: Math.atan2(uy, ux),
          len: bridgeLen
        };
      }
    }

    return [{
      cx, cy, maxR,
      paths,
      polygons,
      buildings: allBuildings,
      islandRoadPath,
      bridge
    }];
  }

  return [];
}

// ============================================================
// RIVER (meandering line between two coast points)
// ============================================================

function _generateRiver(landPolygon, rng) {
  const n = landPolygon.length;
  // Pick two random coastal points roughly opposite each other.
  const i1 = Math.floor(rng() * n);
  const offset = Math.floor(n * 0.4 + rng() * n * 0.2); // ~40-60% around the perimeter
  const i2 = (i1 + offset) % n;

  const segIdx = (idx) => {
    const a = landPolygon[idx];
    const b = landPolygon[(idx + 1) % n];
    const t = 0.2 + rng() * 0.6;
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  };
  const start = segIdx(i1);
  const end = segIdx(i2);

  // 5 meandering control points between start and end
  const numCtrlSegs = 6;
  const dx = end.x - start.x, dy = end.y - start.y;
  const len = Math.hypot(dx, dy) || 1;
  const perpX = -dy / len, perpY = dx / len;

  const pts = [start];
  for (let i = 1; i < numCtrlSegs; i++) {
    const t = i / numCtrlSegs;
    const baseX = start.x + dx * t;
    const baseY = start.y + dy * t;
    // Stronger meander in the middle, less near the endpoints
    const taper = Math.sin(t * Math.PI);
    const meander = (rng() - 0.5) * len * 0.22 * taper;
    pts.push({ x: baseX + perpX * meander, y: baseY + perpY * meander });
  }
  pts.push(end);

  // Smooth path via quadratic curves through midpoints (Catmull-Rom-like)
  let d = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i].x + pts[i + 1].x) / 2;
    const my = (pts[i].y + pts[i + 1].y) / 2;
    d += ` Q ${pts[i].x.toFixed(2)} ${pts[i].y.toFixed(2)} ${mx.toFixed(2)} ${my.toFixed(2)}`;
  }
  d += ` L ${pts[pts.length - 1].x.toFixed(2)} ${pts[pts.length - 1].y.toFixed(2)}`;

  // Sample the EXACT same Q-bezier curve the SVG path renders, so building
  // buffers and bridge intersections line up visually.
  const segments = _sampleSmoothPolyline(pts, 10);

  // Width variety: rivers vary from intimate creek (0.55) to broad waterway (1.6).
  // Both base stroke widths AND building/bridge buffers scale with this.
  const widthScale = 0.55 + rng() * 1.05;          // 0.55..1.60
  const outerWidth = 7 * widthScale;
  const innerWidth = 3.5 * widthScale;
  const buildingBuffer = 7 * widthScale;            // matches outer width

  return { path: d, segments, pts, widthScale, outerWidth, innerWidth, buildingBuffer };
}

function _makeRiverBankRoads(river, landPolygon) {
  if (!river || !river.segments || river.segments.length < 1) return [];
  const offset = Math.max(4, river.outerWidth / 2 + 1.35);
  const cuts = [];
  const basePts = [river.segments[0].a, ...river.segments.map(s => s.b)];
  const runLength = (pts) => pts.slice(1).reduce((sum, p, i) => {
    const prev = pts[i];
    return sum + Math.hypot(p.x - prev.x, p.y - prev.y);
  }, 0);
  const pushRun = (pts) => {
    if (pts.length < 2) return;
    const len = runLength(pts);
    if (len < 26) return;
    cuts.push({
      p1: pts[0],
      p2: pts[pts.length - 1],
      polyline: pts,
      polylineMode: null,
      depth: 3,
      angle: Math.atan2(pts[pts.length - 1].y - pts[0].y, pts[pts.length - 1].x - pts[0].x),
      riverBank: true
    });
  };
  for (const side of [-1, 1]) {
    const pts = _offsetPolyline(basePts, side * offset);
    let run = [];
    for (const p of pts) {
      if (_pointInPolygon(p, landPolygon)) {
        run.push(p);
      } else {
        pushRun(run);
        run = [];
      }
    }
    pushRun(run);
  }
  return cuts;
}

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
  const river1 = rng() < 0.6 ? _generateRiver(landPolygon, rng) : null;
  let river2 = null;
  if (river1 && rng() < 0.5) {
    let bestRiver = null;
    let bestDist = -Infinity;
    for (let attempt = 0; attempt < 8; attempt++) {
      const candidate = _generateRiver(landPolygon, rng);
      const d = _riverToRiverDistance(river1, candidate);
      if (d > bestDist) { bestDist = d; bestRiver = candidate; }
      if (d > 46) break;
    }
    river2 = bestDist > 28 ? bestRiver : null;
  }
  let river = null;
  if (river1 && river2) {
    river = {
      path: river1.path + " " + river2.path,
      segments: [...river1.segments, ...river2.segments],
      pts: river1.pts,
      widthScale: river1.widthScale,
      outerWidth: river1.outerWidth,
      innerWidth: river1.innerWidth,
      buildingBuffer: Math.max(river1.buildingBuffer, river2.buildingBuffer)
    };
  } else if (river1) {
    river = river1;
  }
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
