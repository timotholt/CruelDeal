(function () {
  "use strict";

  const { VIEW_W, VIEW_H } = window.CityMapConfigV3;
  const {
    EPS,
    segIntersect: _segIntersect,
    pointInPolygon: _pointInPolygon,
    polygonArea: _polygonArea,
    polygonCentroid: _polygonCentroid,
    segmentToSegmentDist: _segmentToSegmentDist,
    clipPolygonToRect: _clipPolygonToRect
  } = window.CityMapGeometryV3;
  const {
    cutSegments: _cutSegments,
    samplesToSegments: _samplesToSegments
  } = window.CityMapPathsV3;
  const {
    viewportVisibleArea: _viewportVisibleArea
  } = window.CityMapPlacementV3;
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
  const ENABLE_DISTRICT_JOGS = false;  // Set to true to enable jog cuts on district boundaries
  const DISTRICT_JOG_P_HIGHWAY = ENABLE_DISTRICT_JOGS ? 0.78 : 0.0;
  const DISTRICT_JOG_P_AVENUE = ENABLE_DISTRICT_JOGS ? 1.0 : 0.0;

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
      roadCut1.p1 = jogged[2].p1;
      roadCut1.p2 = jogged[2].p2;
      roadCut1.polyline = jogged[2].polyline || null;
      roadCut1.polylineMode = jogged[2].polylineMode || null;
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
  let best2 = findSecondCut(65);
  if (!best2) best2 = findSecondCut(55);
  if (!best2) best2 = findSecondCut(42);
  if (!best2) best2 = findSecondCut(32);
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
  // Diagonal avenue disabled — creates awkward cuts through districts.
  // A proper diagonal should emerge from the macro division itself, not be overlaid after.
  // For now, stick with orthogonal cuts (highway + avenue) which create cleaner districts.
  const diagonalAvenue = null;

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
      roadCut2.p1 = jogged[2].p1;
      roadCut2.p2 = jogged[2].p2;
      roadCut2.polyline = jogged[2].polyline || null;
      roadCut2.polylineMode = jogged[2].polylineMode || null;
    }
  }

  // Validate diagonal avenue: only keep it if it actually divides districts meaningfully.
  // If the diagonal cuts through a single district without creating a natural boundary,
  // discard it. A valid diagonal should either:
  // 1. Pass through the boundary between two of the three districts, OR
  // 2. Create a visually coherent sub-division that aligns with the district's grid
  let validDiagonal = diagonalAvenue;
  if (validDiagonal) {
    // Check if diagonal passes through or near the existing macro cuts.
    // If it's far from both cuts, it's likely cutting through a single district awkwardly.
    const distToCut1 = _segmentToSegmentDist(validDiagonal.p1, validDiagonal.p2, roadCut1.p1, roadCut1.p2);
    const distToCut2 = _segmentToSegmentDist(validDiagonal.p1, validDiagonal.p2, roadCut2.p1, roadCut2.p2);
    const minDistToCuts = Math.min(distToCut1, distToCut2);
    
    // If diagonal is far from both existing cuts (>80px), it's likely cutting through
    // a single district. Discard it to keep district coherence.
    if (minDistToCuts > 80) {
      validDiagonal = null;
    }
  }

  return {
    regions: [smaller, best2.halfA, best2.halfB],
    macroCuts: validDiagonal ? [roadCut1, roadCut2, validDiagonal] : [roadCut1, roadCut2]
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


  window.CityMapPartitionV3 = {
    splitPolygonByLine: _splitPolygonByLine,
    tryGridCut: _tryGridCut,
    macroDivide3: _macroDivide3,
    bspSubdivide: _bspSubdivide,
    collectAllCuts: _collectAllCuts,
    collectLeaves: _collectLeaves,
    collectAtDepth: _collectAtDepth,
    leavesUnder: _leavesUnder,
    truncateCutAtRiver: _truncateCutAtRiver,
    nearestLandmarkDistance: _nearestLandmarkDistance,
    weightedPickRemove: _weightedPickRemove
  };
})();
