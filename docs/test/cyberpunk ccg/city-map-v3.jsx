/* global React, makeRng, STAGE_W, BOARD_H */
/* exposes:
   window.CityMapV3, buildCityV3, cityV3DotPos, cityV3DotDistance,
   whoCanThisCardSeeV3, whoCanSeeMeV3
*/

const { useMemo: _useMemoCM } = React;

// ============================================================
// CONSTANTS
// ============================================================

const VIEW_W = STAGE_W;       // 360
const VIEW_H = BOARD_H;       // 384

// Land polygon — base radius. Combined with a randomly offset center and a wide
// radius variation, the polygon will clearly extend past viewport on some sides
// and clearly retreat (showing ocean) on others, avoiding the "almost-there" tip.
const LAND_RX = VIEW_W * 0.68;  // ~245
const LAND_RY = VIEW_H * 0.68;  // ~261

// Detection unit (one "block")
const CELL_UNIT = 26;

const DISTRICT_NAMES = [
  "DOWNTOWN", "ROPPONGI", "SHIBUYA", "ASAKUSA", "SHINJUKU",
  "AKIHABARA", "GINZA", "UENO", "HARAJUKU", "EBISU",
  "MEGURO", "SETAGAYA", "KOTO", "OTSUKA", "NAKANO"
];

const DISTRICT_COLORS = [
  "#ff6ea0", "#5dffe6", "#ffd05d", "#a98dff", "#7dff9b", "#ff945d"
];

const PAL = {
  waterDeep:    "#0d2c4d",
  waterMid:     "#11365d",
  land:         "#4f87b8",
  // Streets at different depths
  hwyOuter:     "rgba(255,255,255,0.45)",
  hwyInner:     "rgba(230,250,255,0.95)",
  avenue:       "rgba(245,250,255,0.85)",
  streetMain:   "rgba(255,255,255,0.55)",
  streetLocal:  "rgba(255,255,255,0.30)",
  // Landmarks (parks/stadiums green; malls/plazas stay in the blue palette)
  park:         "#5fa97a",
  plaza:        "#7da3c6",
  stadium:      "#6dba8a",
  stadiumField: "#9ad7a8",
  mall:         "#3c5878",
  mallAccent:   "rgba(20, 35, 55, 0.55)",
  mallHighlight:"rgba(180, 210, 235, 0.18)",
  // Buildings (subtle on the land color)
  bldgA:        "rgba(36, 66, 92, 0.32)",
  bldgB:        "rgba(48, 80, 108, 0.30)",
  bldgC:        "rgba(28, 56, 80, 0.36)",
  // Coast road
  coastRoad:    "rgba(255,255,255,0.55)",
  label:        "#f0fbff",
  labelStroke:  "rgba(8,20,36,0.85)"
};

// ============================================================
// GEOMETRY UTILITIES
// ============================================================

const EPS = 1e-9;

function _segIntersect(a, b, c, d) {
  const dx1 = b.x - a.x, dy1 = b.y - a.y;
  const dx2 = d.x - c.x, dy2 = d.y - c.y;
  const denom = dx1 * dy2 - dy1 * dx2;
  if (Math.abs(denom) < EPS) return null;
  const t = ((c.x - a.x) * dy2 - (c.y - a.y) * dx2) / denom;
  const u = ((c.x - a.x) * dy1 - (c.y - a.y) * dx1) / denom;
  if (t < -EPS || t > 1 + EPS || u < -EPS || u > 1 + EPS) return null;
  return { x: a.x + t * dx1, y: a.y + t * dy1, t, u };
}

function _pointInPolygon(p, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    const intersect = ((yi > p.y) !== (yj > p.y)) &&
      (p.x < (xj - xi) * (p.y - yi) / ((yj - yi) || EPS) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function _polygonArea(polygon) {
  let a = 0;
  const n = polygon.length;
  for (let i = 0; i < n; i++) {
    const p = polygon[i];
    const q = polygon[(i + 1) % n];
    a += p.x * q.y - q.x * p.y;
  }
  return Math.abs(a) / 2;
}

function _polygonCentroid(polygon) {
  let cx = 0, cy = 0, a = 0;
  const n = polygon.length;
  for (let i = 0; i < n; i++) {
    const p = polygon[i];
    const q = polygon[(i + 1) % n];
    const cross = p.x * q.y - q.x * p.y;
    a += cross;
    cx += (p.x + q.x) * cross;
    cy += (p.y + q.y) * cross;
  }
  a /= 2;
  if (Math.abs(a) < EPS) {
    const xs = polygon.reduce((s, p) => s + p.x, 0) / n;
    const ys = polygon.reduce((s, p) => s + p.y, 0) / n;
    return { x: xs, y: ys };
  }
  return { x: cx / (6 * a), y: cy / (6 * a) };
}

function _pointToSegmentDist(px, py, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len2 = dx * dx + dy * dy || 1e-9;
  const t = Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / len2));
  const cx = a.x + t * dx, cy = a.y + t * dy;
  return Math.hypot(px - cx, py - cy);
}

// Pole of inaccessibility (approx): grid-search the polygon for the point
// farthest from any polygon edge, viewport edge, AND landmark edge. Skips
// candidates that fall inside any landmark polygon.
function _labelPosition(polygon, landmarks) {
  const xs = polygon.map(p => p.x);
  const ys = polygon.map(p => p.y);
  const margin = 14;
  const minX = Math.max(margin, Math.min.apply(null, xs));
  const maxX = Math.min(VIEW_W - margin, Math.max.apply(null, xs));
  const minY = Math.max(margin, Math.min.apply(null, ys));
  const maxY = Math.min(VIEW_H - margin, Math.max.apply(null, ys));
  if (maxX <= minX || maxY <= minY) {
    return { x: VIEW_W / 2, y: VIEW_H / 2 };
  }
  let bestX = (minX + maxX) / 2, bestY = (minY + maxY) / 2, bestDist = -1;
  const step = 3;
  const lms = landmarks || [];
  for (let x = minX; x <= maxX; x += step) {
    for (let y = minY; y <= maxY; y += step) {
      if (!_pointInPolygon({ x, y }, polygon)) continue;
      // Skip candidates inside a landmark (so labels don't sit on stadiums/malls)
      let inLm = false;
      for (const lm of lms) {
        if (_pointInPolygon({ x, y }, lm.polygon)) { inLm = true; break; }
      }
      if (inLm) continue;
      let edgeDist = Infinity;
      // Distance to nearest polygon edge
      for (let i = 0; i < polygon.length; i++) {
        const a = polygon[i];
        const b = polygon[(i + 1) % polygon.length];
        const d = _pointToSegmentDist(x, y, a, b);
        if (d < edgeDist) edgeDist = d;
      }
      // Distance to nearest landmark edge (push label away)
      for (const lm of lms) {
        for (let i = 0; i < lm.polygon.length; i++) {
          const a = lm.polygon[i];
          const b = lm.polygon[(i + 1) % lm.polygon.length];
          const d = _pointToSegmentDist(x, y, a, b);
          if (d < edgeDist) edgeDist = d;
        }
      }
      // Distance to viewport edges
      edgeDist = Math.min(edgeDist, x - 4, VIEW_W - 4 - x, y - 4, VIEW_H - 4 - y);
      if (edgeDist > bestDist) { bestDist = edgeDist; bestX = x; bestY = y; }
    }
  }
  return { x: bestX, y: bestY };
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

// Number of play locations based on district size.
function _dotCountForArea(area) {
  if (area < 6500)  return 2;
  if (area < 13000) return 4;
  if (area < 20000) return 6;
  if (area < 28000) return 8;
  return 10;
}

function _polygonToPath(polygon) {
  if (polygon.length === 0) return "";
  let d = `M ${polygon[0].x.toFixed(2)} ${polygon[0].y.toFixed(2)}`;
  for (let i = 1; i < polygon.length; i++) {
    d += ` L ${polygon[i].x.toFixed(2)} ${polygon[i].y.toFixed(2)}`;
  }
  d += " Z";
  return d;
}

function _splitPolygonByLine(polygon, L1, L2) {
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

  const half1 = [];
  for (let i = 0; i <= a; i++) half1.push({ x: polygon[i].x, y: polygon[i].y, edgeKind: polygon[i].edgeKind });
  half1.push({ x: I1.x, y: I1.y, edgeKind: "road" });
  half1.push({ x: I2.x, y: I2.y, edgeKind: bKind });
  for (let i = b + 1; i < n; i++) half1.push({ x: polygon[i].x, y: polygon[i].y, edgeKind: polygon[i].edgeKind });

  const half2 = [];
  half2.push({ x: I1.x, y: I1.y, edgeKind: aKind });
  for (let i = a + 1; i <= b; i++) half2.push({ x: polygon[i].x, y: polygon[i].y, edgeKind: polygon[i].edgeKind });
  half2.push({ x: I2.x, y: I2.y, edgeKind: "road" });

  if (_polygonArea(half1) < 50 || _polygonArea(half2) < 50) return null;

  return [half1, half2, { p1: { x: I1.x, y: I1.y }, p2: { x: I2.x, y: I2.y } }];
}

// ============================================================
// LAND POLYGON
// ============================================================

function _generateLandPolygon(rng) {
  // Random center offset so polygon sits asymmetrically: 1-2 sides extend past
  // viewport, 1-2 show coast clearly.
  const cx = VIEW_W / 2 + (rng() - 0.5) * 60;
  const cy = VIEW_H / 2 + (rng() - 0.5) * 60;
  const N = 20;
  const phaseA = rng() * Math.PI * 2;
  const phaseB = rng() * Math.PI * 2;
  const phaseC = rng() * Math.PI * 2;
  // Wide variation: directions with k < ~0.85 show clear coast inside the
  // viewport; directions with k > ~1.15 clearly extend past.
  const verts = [];
  for (let i = 0; i < N; i++) {
    const angle = (i / N) * Math.PI * 2 + (rng() - 0.5) * 0.18;
    const r1 = 0.22 * Math.cos(angle * 1 + phaseA);
    const r2 = 0.13 * Math.cos(angle * 3 + phaseB);
    const r3 = 0.07 * Math.cos(angle * 5 + phaseC);
    const jitter = (rng() - 0.5) * 0.06;
    const k = 1.05 + r1 + r2 + r3 + jitter; // ~0.55..1.55
    verts.push({
      x: cx + Math.cos(angle) * LAND_RX * k,
      y: cy + Math.sin(angle) * LAND_RY * k,
      edgeKind: "coast"
    });
  }
  return verts;
}

// ============================================================
// BSP SUBDIVISION
// ============================================================

// Inset (shrink) a polygon inward by `dist` pixels. Uses angle bisectors with
// inward direction validated against centroid (handles either winding order).
function _insetPolygon(polygon, dist) {
  const n = polygon.length;
  if (n < 3) return polygon;
  const cx = polygon.reduce((s, p) => s + p.x, 0) / n;
  const cy = polygon.reduce((s, p) => s + p.y, 0) / n;
  const out = [];
  for (let i = 0; i < n; i++) {
    const prev = polygon[(i - 1 + n) % n];
    const cur = polygon[i];
    const next = polygon[(i + 1) % n];
    const e1x = cur.x - prev.x, e1y = cur.y - prev.y;
    const e2x = next.x - cur.x, e2y = next.y - cur.y;
    const e1Len = Math.hypot(e1x, e1y) || 1e-9;
    const e2Len = Math.hypot(e2x, e2y) || 1e-9;
    // Perpendicular candidates for each edge; pick the one pointing toward centroid
    let n1x = -e1y / e1Len, n1y = e1x / e1Len;
    if (n1x * (cx - (prev.x + cur.x) / 2) + n1y * (cy - (prev.y + cur.y) / 2) < 0) {
      n1x = -n1x; n1y = -n1y;
    }
    let n2x = -e2y / e2Len, n2y = e2x / e2Len;
    if (n2x * (cx - (cur.x + next.x) / 2) + n2y * (cy - (cur.y + next.y) / 2) < 0) {
      n2x = -n2x; n2y = -n2y;
    }
    const bx = n1x + n2x, by = n1y + n2y;
    const bLen = Math.hypot(bx, by);
    if (bLen < 1e-6) { out.push({ x: cur.x + n1x * dist, y: cur.y + n1y * dist }); continue; }
    const moveDist = dist / (bLen / 2);
    out.push({ x: cur.x + (bx / bLen) * moveDist, y: cur.y + (by / bLen) * moveDist });
  }
  return out;
}

function _polygonBBox(polygon) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of polygon) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, maxX, minY, maxY, w: maxX - minX, h: maxY - minY };
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
  // Tiny wobble for organic feel — small enough to keep rectangles
  const wobble = (rng() - 0.5) * 0.04;  // ±~1.1°
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
  const wobble = (rng() - 0.5) * 0.05;
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
  return { halfA: result[0], halfB: result[1], cutSeg: result[2], angle: cutAngle };
}

// Split land into 3 macro regions via 2 sequential cuts.
// First cut: split into 2 halves. Second cut: split the LARGER half into 2.
// Result: 3 regions of roughly comparable size.
function _macroDivide3(landPolygon, gridAngle, rng) {
  const totalArea = _polygonArea(landPolygon);
  const target1 = totalArea / 3; // smaller half should be ~1/3 of total

  // Try first cut along both grid axes; pick the one whose smaller half is closest to 1/3.
  let best1 = null, best1Score = Infinity;
  for (let attempt = 0; attempt < 18; attempt++) {
    const useSecondary = attempt % 2 === 0;
    const offMag = 90 + rng() * 40; // wide range so we get 1/3-2/3 splits
    const r = _tryGridCut(landPolygon, gridAngle, useSecondary, offMag, rng);
    if (!r) continue;
    const aArea = _polygonArea(r.halfA);
    const bArea = _polygonArea(r.halfB);
    if (aArea < 1500 || bArea < 1500) continue;
    const visA = _viewportVisibleArea(r.halfA);
    const visB = _viewportVisibleArea(r.halfB);
    if (visA < 2500 || visB < 2500) continue;
    const smallerArea = Math.min(aArea, bArea);
    const score = Math.abs(smallerArea - target1);
    if (score < best1Score) {
      best1 = { ...r, useSecondary };
      best1Score = score;
    }
  }
  if (!best1) return { regions: [landPolygon], macroCuts: [] };

  const aArea = _polygonArea(best1.halfA);
  const bArea = _polygonArea(best1.halfB);
  const smaller = aArea <= bArea ? best1.halfA : best1.halfB;
  const larger  = aArea <= bArea ? best1.halfB : best1.halfA;

  // Second cut: split LARGER half. Use perpendicular axis to first cut for visual contrast.
  let best2 = null, best2Score = Infinity;
  const secondAxis = !best1.useSecondary;
  for (let attempt = 0; attempt < 18; attempt++) {
    const offMag = 50 + rng() * 30;
    const r = _tryGridCut(larger, gridAngle, secondAxis, offMag, rng);
    if (!r) continue;
    const xA = _polygonArea(r.halfA);
    const xB = _polygonArea(r.halfB);
    if (xA < 1200 || xB < 1200) continue;
    if (_viewportVisibleArea(r.halfA) < 2500) continue;
    if (_viewportVisibleArea(r.halfB) < 2500) continue;
    // Prefer balanced halves
    const ratio = Math.max(xA, xB) / Math.max(1, Math.min(xA, xB));
    const score = ratio;
    if (score < best2Score) { best2 = r; best2Score = score; }
  }
  if (!best2) {
    return {
      regions: [smaller, larger],
      macroCuts: [{ p1: best1.cutSeg.p1, p2: best1.cutSeg.p2, depth: 0, angle: best1.angle }]
    };
  }

  return {
    regions: [smaller, best2.halfA, best2.halfB],
    macroCuts: [
      { p1: best1.cutSeg.p1, p2: best1.cutSeg.p2, depth: 0, angle: best1.angle },
      { p1: best2.cutSeg.p1, p2: best2.cutSeg.p2, depth: 1, angle: best2.angle }
    ]
  };
}

// Recursive BSP. Returns a node tree.
// Each node = { polygon, depth, isLeaf, cut, left, right }
// gridAngle = the city's "street grid" orientation (radians); inherited unchanged so
// every cut at every depth aligns to one of two perpendicular directions.
function _bspSubdivide(polygon, depth, gridAngle, rng) {
  const area = _polygonArea(polygon);
  // Variable termination so blocks have varied sizes
  const minArea = 320 + rng() * 480;   // 320..800
  const maxDepth = 6 + Math.floor(rng() * 3); // 6..8

  // Rare: stop early at mid-depth to leave a BIG block (stadium / mall / park).
  // Probability scaled so we get ~1-2 of these per district on average.
  if (depth >= 3 && depth <= 4 && rng() < 0.08 && area > 1800 && area < 6000) {
    return { polygon, depth, isLeaf: true, bigLandmark: true };
  }

  if (depth >= maxDepth || area < minArea) {
    return { polygon, depth, isLeaf: true };
  }

  // Try a few cut candidates; accept the first that splits cleanly
  let result = null, cutInfo = null;
  for (let attempt = 0; attempt < 6; attempt++) {
    cutInfo = _pickBspCut(polygon, rng, gridAngle, depth);
    result = _splitPolygonByLine(polygon, cutInfo.p1, cutInfo.p2);
    if (result) {
      const [a, b] = result;
      if (_polygonArea(a) > 80 && _polygonArea(b) > 80) break;
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

function _generateBlockBuildings(blockPolygon, gridAngle, rng, riverSegments) {
  const blockArea = _polygonArea(blockPolygon);

  // Buffer (in px) to keep building footprints clear of the river.
  const RIVER_BUFFER = 5.5;

  // Check whether any of the corners is too close to the river.
  const cornerNearRiver = (corners) => {
    if (!riverSegments) return false;
    for (const c of corners) {
      if (_distToRiver(c.x, c.y, riverSegments) < RIVER_BUFFER) return true;
    }
    return false;
  };

  // Rare: render the whole block as a single circular landmark building (rotunda / arena).
  // Roads go around it naturally because they're the BSP cuts at the block boundary.
  if (rng() < 0.04 && blockArea > 700) {
    const c = _polygonCentroid(blockPolygon);
    let r = Infinity;
    for (let i = 0; i < blockPolygon.length; i++) {
      const a = blockPolygon[i];
      const b = blockPolygon[(i + 1) % blockPolygon.length];
      const d = _pointToSegmentDist(c.x, c.y, a, b);
      if (d < r) r = d;
    }
    r *= 0.85;
    // Skip round building if the block centroid is on the river — riverfront
    // areas read better as open promenade than as a giant stadium in water.
    const centerNearRiver = riverSegments && _distToRiver(c.x, c.y, riverSegments) < r + RIVER_BUFFER;
    if (r > 4.5 && !centerNearRiver) {
      const sides = 18;
      const pts = [];
      for (let i = 0; i < sides; i++) {
        const ang = (i / sides) * Math.PI * 2;
        pts.push({ x: c.x + Math.cos(ang) * r, y: c.y + Math.sin(ang) * r });
      }
      return [{
        path: _polygonToPath(pts),
        shade: rng(),
        round: true,
        cx: c.x,
        cy: c.y,
        radius: r
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

  const targetSize = 8 + rng() * 4; // ~8-12 px per building
  const nU = Math.max(1, Math.round(wU / targetSize));
  const nV = Math.max(1, Math.round(wV / targetSize));
  if (nU === 1 && nV === 1) {
    // tiny block — at most 1 building, tested for fit
  }
  const cellU = wU / nU;
  const cellV = wV / nV;
  const insetU = 0.7;
  const insetV = 0.7;

  const buildings = [];
  for (let i = 0; i < nU; i++) {
    for (let j = 0; j < nV; j++) {
      // Skip some cells for visual variety
      if (rng() < 0.18) continue;
      const u1 = minU + i * cellU + insetU + rng() * 0.4;
      const u2 = minU + (i + 1) * cellU - insetU - rng() * 0.4;
      const v1 = minV + j * cellV + insetV + rng() * 0.4;
      const v2 = minV + (j + 1) * cellV - insetV - rng() * 0.4;
      if (u2 - u1 < 1.5 || v2 - v1 < 1.5) continue;
      const corners = [
        { u: u1, v: v1 }, { u: u2, v: v1 },
        { u: u2, v: v2 }, { u: u1, v: v2 }
      ].map(p => ({
        x: p.u * cosI - p.v * sinI,
        y: p.u * sinI + p.v * cosI
      }));
      // Skip if any corner is outside the block (avoids overhang into streets)
      if (!corners.every(c => _pointInPolygon(c, blockPolygon))) continue;
      // Skip if any corner is too close to the river — leaves a riverfront gap
      // that naturally reads as a promenade or irregular waterfront block.
      if (cornerNearRiver(corners)) continue;
      buildings.push({
        path: `M ${corners[0].x.toFixed(2)} ${corners[0].y.toFixed(2)} ` +
              `L ${corners[1].x.toFixed(2)} ${corners[1].y.toFixed(2)} ` +
              `L ${corners[2].x.toFixed(2)} ${corners[2].y.toFixed(2)} ` +
              `L ${corners[3].x.toFixed(2)} ${corners[3].y.toFixed(2)} Z`,
        shade: rng() // deterministic per building, used to pick a tone
      });
    }
  }
  return buildings;
}

// ============================================================
// PLACEMENT
// ============================================================

// Place dots evenly across the polygon by:
//   1. Random rejection seeding (with min-distance constraint).
//   2. Spring relaxation: repulsion between dots, repulsion from polygon edges,
//      so dots fan out to fill the available space evenly.
//   3. Optional flavor: pull two dots slightly closer together so the field
//      doesn't look mathematically perfect.
function _placeDotsInPolygon(polygon, rng, leafBlocksToAvoid, target, visibleArea) {
  const xs = polygon.map(p => p.x);
  const ys = polygon.map(p => p.y);
  const minX = Math.max(8, Math.min.apply(null, xs));
  const maxX = Math.min(VIEW_W - 8, Math.max.apply(null, xs));
  const minY = Math.max(8, Math.min.apply(null, ys));
  const maxY = Math.min(VIEW_H - 8, Math.max.apply(null, ys));
  const placed = [];
  if (maxX - minX < 16 || maxY - minY < 16) return placed;

  // Target spacing derived from area & count → reasonable density regardless of district size.
  const area = Math.max(1, visibleArea || ((maxX - minX) * (maxY - minY)));
  const idealSpacing = Math.sqrt(area / Math.max(1, target)) * 0.95;
  const seedMinDist = idealSpacing * 0.78; // looser at seeding so we hit `target`

  // ----- Phase 1: rejection-sample seeds -----
  let attempts = 0;
  while (placed.length < target && attempts < 1500) {
    attempts++;
    const x = minX + rng() * (maxX - minX);
    const y = minY + rng() * (maxY - minY);
    if (!_pointInPolygon({ x, y }, polygon)) continue;
    let inLandmark = false;
    for (const lb of leafBlocksToAvoid) {
      if (_pointInPolygon({ x, y }, lb.polygon)) { inLandmark = true; break; }
    }
    if (inLandmark) continue;
    let ok = true;
    for (const p of placed) {
      if (Math.hypot(p.x - x, p.y - y) < seedMinDist) { ok = false; break; }
    }
    if (ok) placed.push({ x, y });
  }

  // If we couldn't even seed enough dots, return what we have.
  if (placed.length < 2) return placed;

  // ----- Phase 2: spring relaxation for even spread -----
  const ITERATIONS = 14;
  const stepScale = 0.45;
  for (let iter = 0; iter < ITERATIONS; iter++) {
    for (let i = 0; i < placed.length; i++) {
      let fx = 0, fy = 0;
      // Repulsion between dots
      for (let j = 0; j < placed.length; j++) {
        if (i === j) continue;
        const dx = placed[i].x - placed[j].x;
        const dy = placed[i].y - placed[j].y;
        const d = Math.hypot(dx, dy);
        if (d > 0.01 && d < idealSpacing) {
          const f = (idealSpacing - d) / idealSpacing;
          fx += (dx / d) * f;
          fy += (dy / d) * f;
        }
      }
      // Repulsion from polygon edges (push toward interior)
      const EDGE_BUFFER = idealSpacing * 0.45;
      for (let k = 0; k < polygon.length; k++) {
        const a = polygon[k];
        const b = polygon[(k + 1) % polygon.length];
        // Closest point on segment
        const ex = b.x - a.x, ey = b.y - a.y;
        const len2 = ex * ex + ey * ey || 1e-9;
        const t = Math.max(0, Math.min(1, ((placed[i].x - a.x) * ex + (placed[i].y - a.y) * ey) / len2));
        const cx = a.x + t * ex, cy = a.y + t * ey;
        const dx = placed[i].x - cx, dy = placed[i].y - cy;
        const d = Math.hypot(dx, dy);
        if (d < EDGE_BUFFER && d > 0.01) {
          const f = (EDGE_BUFFER - d) / EDGE_BUFFER * 1.2;
          fx += (dx / d) * f;
          fy += (dy / d) * f;
        }
      }
      // Apply force, clamp to polygon
      const newX = placed[i].x + fx * stepScale;
      const newY = placed[i].y + fy * stepScale;
      if (_pointInPolygon({ x: newX, y: newY }, polygon)) {
        // Avoid landmark blocks
        let inLandmark = false;
        for (const lb of leafBlocksToAvoid) {
          if (_pointInPolygon({ x: newX, y: newY }, lb.polygon)) { inLandmark = true; break; }
        }
        if (!inLandmark) {
          placed[i].x = Math.max(minX, Math.min(maxX, newX));
          placed[i].y = Math.max(minY, Math.min(maxY, newY));
        }
      }
    }
  }

  // ----- Phase 3: occasional "flavor pair" so distribution isn't too perfect -----
  if (placed.length >= 4 && rng() < 0.55) {
    const i = Math.floor(rng() * placed.length);
    let j = Math.floor(rng() * placed.length);
    if (j === i) j = (j + 1) % placed.length;
    const dx = placed[j].x - placed[i].x;
    const dy = placed[j].y - placed[i].y;
    const newX = placed[i].x + dx * 0.45;
    const newY = placed[i].y + dy * 0.45;
    if (_pointInPolygon({ x: newX, y: newY }, polygon)) {
      let inLandmark = false;
      for (const lb of leafBlocksToAvoid) {
        if (_pointInPolygon({ x: newX, y: newY }, lb.polygon)) { inLandmark = true; break; }
      }
      if (!inLandmark) { placed[j].x = newX; placed[j].y = newY; }
    }
  }

  return placed;
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

  // Densely sample the curve into straight segments for hit-testing
  // (used to push buildings away from riverfront and detect bridge crossings).
  const samples = [];
  const STEPS_PER_SEG = 8;
  for (let i = 0; i < pts.length - 1; i++) {
    if (i === pts.length - 2) {
      samples.push(pts[i + 1]);
      continue;
    }
    const c = pts[i];
    const m1 = i === 0 ? pts[0] : { x: (pts[i - 1].x + pts[i].x) / 2, y: (pts[i - 1].y + pts[i].y) / 2 };
    const m2 = { x: (pts[i].x + pts[i + 1].x) / 2, y: (pts[i].y + pts[i + 1].y) / 2 };
    for (let s = 0; s <= STEPS_PER_SEG; s++) {
      const t = s / STEPS_PER_SEG;
      const mt = 1 - t;
      const x = mt * mt * m1.x + 2 * mt * t * c.x + t * t * m2.x;
      const y = mt * mt * m1.y + 2 * mt * t * c.y + t * t * m2.y;
      samples.push({ x, y });
    }
  }
  // Build segment list for fast hit-tests
  const segments = [];
  for (let i = 0; i < samples.length - 1; i++) {
    segments.push({ a: samples[i], b: samples[i + 1] });
  }

  return { path: d, segments, pts };
}

// Distance from point to nearest river segment.
function _distToRiver(x, y, riverSegments) {
  if (!riverSegments || !riverSegments.length) return Infinity;
  let best = Infinity;
  for (const s of riverSegments) {
    const d = _pointToSegmentDist(x, y, s.a, s.b);
    if (d < best) best = d;
  }
  return best;
}

// ============================================================
// MAIN BUILDER
// ============================================================

function buildCityV3(seed) {
  const rng = makeRng((seed >>> 0) || 1);

  // 1. Land
  const landPolygon = _generateLandPolygon(rng);

  // 2. City-wide grid angle (drives all street alignment).
  const cityGridAngle = (rng() - 0.5) * 0.5; // ±~14°

  // 3. MACRO DIVISION → 3 districts up front (no leftovers).
  const macro = _macroDivide3(landPolygon, cityGridAngle, rng);
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
      centroid,
      bspRoot,
      leafBlocks,
      landmarks: [],
      dots: [],
      labelPos: { x: centroid.x, y: centroid.y }
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
    // Possibly add a small extra park/plaza for variety (independent of big).
    if (rng() < 0.4) {
      const sortedSmall = small
        .map(lb => ({ lb, area: _polygonArea(lb.polygon) }))
        .filter(x => x.area > 300 && x.area < 1800)
        .filter(x => !picks.some(p => p.lb === x.lb))
        .sort((a, b) => b.area - a.area);
      if (sortedSmall.length > 0) picks.push({ lb: sortedSmall[0].lb, big: false });
    }

    let stadiumUsed = false;
    for (const p of picks) {
      const lb = p.lb;
      let type;
      if (p.big) {
        const r = rng();
        if (!stadiumUsed && r < 0.30) { type = "stadium"; stadiumUsed = true; }
        else if (r < 0.30 + 0.40)     type = "mall";
        else                          type = "park";
      } else {
        // Small landmarks are parks/plazas only (no stadiums on small blocks).
        type = rng() < 0.65 ? "park" : "plaza";
      }
      d.landmarks.push({
        polygon: lb.polygon,
        path: _polygonToPath(lb.polygon),
        type
      });
    }
  }

  // 7. Dot placement — variable count by land mass (visible area), evenly
  // distributed via spring relaxation, with one optional "flavor" pair.
  for (const d of districts) {
    const visArea = _viewportVisibleArea(d.polygon);
    const target = _dotCountForArea(visArea);
    const placed = _placeDotsInPolygon(d.polygon, rng, d.landmarks, target, visArea);
    d.dots = placed.map((p, i) => ({
      id: `D${d.idx}-${i}`,
      districtIdx: d.idx,
      x: p.x,
      y: p.y
    }));
    d.labelPos = _labelPosition(d.polygon, d.landmarks);
  }

  // 8. Collect all cuts (streets) for rendering: macro cuts (highway+avenue) + per-district BSP cuts.
  const allCuts = [...macro.macroCuts];
  for (const d of districts) _collectAllCuts(d.bspRoot, allCuts);

  // 9. River FIRST — buildings need to know about it so they can leave riverfront gaps.
  const river = rng() < 0.6 ? _generateRiver(landPolygon, rng) : null;
  const riverSegments = river ? river.segments : null;

  // 10. Buildings for every leaf block (across all 3 districts) that isn't a
  // landmark. Building generator receives river segments so it skips footprints
  // near water — creating natural riverfront gaps / irregular blocks.
  const landmarkPolySet = new Set();
  for (const d of districts) for (const lm of d.landmarks) landmarkPolySet.add(lm.polygon);
  const buildings = [];
  for (const d of districts) {
    for (const leaf of d.leafBlocks) {
      if (landmarkPolySet.has(leaf.polygon)) continue;
      const blockBldgs = _generateBlockBuildings(leaf.polygon, cityGridAngle, rng, riverSegments);
      for (const b of blockBldgs) buildings.push(b);
    }
  }

  // 11. Bridges — every street that crosses the river gets a small bridge marker.
  const bridges = [];
  if (riverSegments) {
    for (const cut of allCuts) {
      // Find first intersection between this street and any river segment
      for (const rs of riverSegments) {
        const hit = _segIntersect(cut.p1, cut.p2, rs.a, rs.b);
        if (hit) {
          bridges.push({
            x: hit.x,
            y: hit.y,
            angle: cut.angle,
            depth: cut.depth   // bigger streets → bigger bridges
          });
          break;
        }
      }
    }
  }

  // 12. Coast road = land polygon inset by ~5px so land extends past the road.
  const coastRoadPolygon = _insetPolygon(landPolygon, 5);
  const coastRoadPath = _polygonToPath(coastRoadPolygon);

  return {
    landPolygon,
    landPath: _polygonToPath(landPolygon),
    coastRoadPath,
    districts,
    cuts: allCuts,
    ambientLandmarks: [],   // no leftovers in 3-region division
    buildings,
    river,
    bridges,
    width: VIEW_W,
    height: VIEW_H
  };
}

// ============================================================
// DOT HELPERS & DETECTION
// ============================================================

function cityV3DotPos(dot) { return { x: dot.x, y: dot.y }; }

function cityV3DotDistance(a, b) {
  if (a.districtIdx !== b.districtIdx) return Infinity;
  return Math.hypot(a.x - b.x, a.y - b.y) / CELL_UNIT;
}

function whoCanThisCardSeeV3(dot, vis, placedCards, algo) {
  const seen = [];
  for (const other of placedCards) {
    if (other.dot.id === dot.id) continue;
    const d = cityV3DotDistance(dot, other.dot);
    const r = algo.range(vis, other.stealth);
    if (d <= r) seen.push(other);
  }
  return seen;
}

function whoCanSeeMeV3(dot, myStealth, placedCards, algo) {
  const seers = [];
  for (const other of placedCards) {
    if (other.dot.id === dot.id) continue;
    const d = cityV3DotDistance(dot, other.dot);
    const r = algo.range(other.vis, myStealth);
    if (d <= r) seers.push(other);
  }
  return seers;
}

// ============================================================
// COMPONENT
// ============================================================

function _tint(hex, alpha) {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// Stroke styling per BSP depth
function _streetStyle(depth) {
  if (depth === 0) return { width: 2.4, stroke: PAL.hwyInner };
  if (depth === 1) return { width: 1.5, stroke: PAL.avenue };
  if (depth === 2) return { width: 0.95, stroke: PAL.streetMain };
  if (depth === 3) return { width: 0.65, stroke: PAL.streetMain };
  return { width: 0.4, stroke: PAL.streetLocal };
}

// Render a typed landmark (park / plaza / stadium / mall) as SVG.
// Each returns a React fragment.
function _renderLandmark(key, l, opacity) {
  const t = l.type;
  if (t === "stadium") {
    // Block tinted as stadium grounds + an inscribed oval "field"
    let cx = 0, cy = 0, n = l.polygon.length || 1;
    let minR = Infinity;
    for (const p of l.polygon) { cx += p.x; cy += p.y; }
    cx /= n; cy /= n;
    for (let i = 0; i < l.polygon.length; i++) {
      const a = l.polygon[i];
      const b = l.polygon[(i + 1) % l.polygon.length];
      const d = _pointToSegmentDist(cx, cy, a, b);
      if (d < minR) minR = d;
    }
    const rField = Math.max(2, minR * 0.6);
    return (
      <g key={key} opacity={opacity}>
        <path d={l.path} fill={PAL.stadium} />
        <ellipse cx={cx} cy={cy} rx={rField * 1.15} ry={rField * 0.78} fill={PAL.stadiumField} />
        <ellipse cx={cx} cy={cy} rx={rField * 1.15} ry={rField * 0.78} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth={0.4} />
      </g>
    );
  }
  if (t === "mall") {
    return (
      <g key={key} opacity={opacity}>
        <path d={l.path} fill={PAL.mall} />
        <path d={l.path} fill="none" stroke={PAL.mallAccent} strokeWidth={0.6} />
      </g>
    );
  }
  // park / plaza
  return (
    <path
      key={key}
      d={l.path}
      fill={t === "park" ? PAL.park : PAL.plaza}
      opacity={opacity}
    />
  );
}

function CityMapV3({ seed, width, height, opacity = 1, showLabels = true, showStreets = true, showDots = false }) {
  const W = width || VIEW_W;
  const H = height || VIEW_H;
  const data = _useMemoCM(() => buildCityV3(seed || 1), [seed]);
  const idBase = `cv3-${seed || 1}`;

  // Sort non-highway cuts by depth (deepest=thinnest first); highways drawn separately on top
  const sortedCuts = data.cuts.filter(c => c.depth > 0).sort((a, b) => b.depth - a.depth);
  const hwyCuts = data.cuts.filter(c => c.depth === 0);

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
      </defs>

      {/* WATER — plain dark blue */}
      <rect x={0} y={0} width={VIEW_W} height={VIEW_H} fill={PAL.waterDeep} />
      <rect x={0} y={0} width={VIEW_W} height={VIEW_H} fill={PAL.waterMid} opacity={0.32} />

      {/* LAND base */}
      <path d={data.landPath} fill={PAL.land} />

      {/* RIVER — meandering water feature crossing land. Drawn over land, beneath
          tints, buildings and streets so streets/bridges visually cross over it. */}
      {data.river && (
        <g clipPath={`url(#${idBase}-land)`}>
          <path
            d={data.river.path}
            fill="none"
            stroke={PAL.waterMid}
            strokeWidth={7}
            strokeLinecap="round"
            opacity={0.95}
          />
          <path
            d={data.river.path}
            fill="none"
            stroke={PAL.waterDeep}
            strokeWidth={3.5}
            strokeLinecap="round"
            opacity={0.9}
          />
        </g>
      )}

      {/* District tints (subtle wash within district polygons) */}
      {data.districts.map(d => (
        <path key={`tint-${d.idx}`} d={d.polygonPath} fill={_tint(d.color, 0.10)} />
      ))}

      {/* BUILDINGS (subtle footprints — drawn before streets so street network is on top) */}
      <g>
        {data.buildings.map((b, i) => {
          if (b.round) {
            // Round buildings read as landmarks: lighter fill + soft outer halo
            return (
              <g key={`b-${i}`}>
                <path d={b.path} fill="rgba(80, 120, 160, 0.55)" />
                <path d={b.path} fill="none" stroke="rgba(220, 240, 255, 0.35)" strokeWidth={0.5} />
              </g>
            );
          }
          const fill = b.shade < 0.33 ? PAL.bldgA : (b.shade < 0.66 ? PAL.bldgB : PAL.bldgC);
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

      {/* STREETS — render in order: deepest (local) first, then thicker */}
      {showStreets && (
        <g>
          {sortedCuts.map((cut, i) => {
            const style = _streetStyle(cut.depth);
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
          {hwyCuts.map((cut, i) => (
            <line
              key={`hwy-glow-${i}`}
              x1={cut.p1.x} y1={cut.p1.y} x2={cut.p2.x} y2={cut.p2.y}
              stroke={PAL.hwyOuter}
              strokeWidth={4.5}
              strokeLinecap="round"
              opacity={0.55}
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {hwyCuts.map((cut, i) => (
            <line
              key={`hwy-inner-${i}`}
              x1={cut.p1.x} y1={cut.p1.y} x2={cut.p2.x} y2={cut.p2.y}
              stroke={PAL.hwyInner}
              strokeWidth={2.0}
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </g>
      )}

      {/* BRIDGES — render where streets cross the river. Width scales with street depth. */}
      {showStreets && data.bridges && data.bridges.map((b, i) => {
        const w = b.depth === 0 ? 11 : (b.depth === 1 ? 9 : (b.depth === 2 ? 7 : 5.5));
        const h = b.depth === 0 ? 4.5 : (b.depth === 1 ? 3.6 : 3);
        return (
          <g key={`br-${i}`} transform={`translate(${b.x},${b.y}) rotate(${(b.angle || 0) * 180 / Math.PI})`}>
            {/* outer dark plate */}
            <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={1} fill="rgba(20,40,65,0.92)" />
            {/* inner bright deck */}
            <rect x={-w / 2 + 0.6} y={-h / 2 + 0.6} width={w - 1.2} height={h - 1.2} rx={0.6}
                  fill="rgba(235,245,255,0.85)" />
            {/* tiny end-caps to suggest railings */}
            <rect x={-w / 2} y={-h / 2 - 0.5} width={1.5} height={h + 1} fill="rgba(20,40,65,0.92)" />
            <rect x={ w / 2 - 1.5} y={-h / 2 - 0.5} width={1.5} height={h + 1} fill="rgba(20,40,65,0.92)" />
          </g>
        );
      })}

      {/* ROUNDABOUTS — ring road encircling each round (circular) building */}
      {showStreets && (
        <g>
          {data.buildings.filter(b => b.round).map((b, i) => (
            <g key={`rb-${i}`}>
              <circle
                cx={b.cx} cy={b.cy} r={b.radius * 1.20}
                fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth={1.0}
                vectorEffect="non-scaling-stroke"
              />
              <circle
                cx={b.cx} cy={b.cy} r={b.radius * 1.20}
                fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth={2.4}
                vectorEffect="non-scaling-stroke"
              />
            </g>
          ))}
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
          opacity={0.85}
          vectorEffect="non-scaling-stroke"
        />
      )}

      {/* DISTRICT BRIGHT OUTLINES — full polygon stroke (highlights each picked district) */}
      <g>
        {data.districts.map(d => (
          <path
            key={`outline-${d.idx}`}
            d={d.polygonPath}
            fill="none"
            stroke={d.color}
            strokeWidth={1.6}
            strokeLinejoin="round"
            opacity={0.95}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </g>

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
              fontFamily="JetBrains Mono, monospace"
              fontSize={10}
              fontWeight={700}
              letterSpacing={2.4}
              fill={PAL.label}
              stroke={PAL.labelStroke}
              strokeWidth={2.5}
              paintOrder="stroke"
              style={{ pointerEvents: "none" }}
            >
              {d.name}
            </text>
          ))}
        </g>
      )}
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
