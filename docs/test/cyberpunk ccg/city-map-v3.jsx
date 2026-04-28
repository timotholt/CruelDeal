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

// Tetromino-style polygon shapes used for micro-landmarks (small parks/plazas/
// mini-malls placed inside leaf blocks). All shapes are CCW-oriented in a
// `unitSize × unitSize` grid; the placement code centers and scales them.
// New shapes can be added freely — each is a closed polygon as a list of
// {x, y} points (the closing edge to the first point is implicit).
const _MICRO_LANDMARK_SHAPES = [
  // Square (1x1 of the unit grid)
  { unitSize: 3, points: [{x:0,y:0},{x:3,y:0},{x:3,y:3},{x:0,y:3}] },
  // Wide rectangle
  { unitSize: 4, points: [{x:0,y:1},{x:4,y:1},{x:4,y:3},{x:0,y:3}] },
  // Tall rectangle
  { unitSize: 4, points: [{x:1,y:0},{x:3,y:0},{x:3,y:4},{x:1,y:4}] },
  // L-shape
  { unitSize: 4, points: [{x:0,y:0},{x:2,y:0},{x:2,y:2},{x:4,y:2},{x:4,y:4},{x:0,y:4}] },
  // L-shape rotated 180°
  { unitSize: 4, points: [{x:2,y:0},{x:4,y:0},{x:4,y:4},{x:0,y:4},{x:0,y:2},{x:2,y:2}] },
  // T-shape
  { unitSize: 4, points: [{x:0,y:0},{x:4,y:0},{x:4,y:2},{x:3,y:2},{x:3,y:4},{x:1,y:4},{x:1,y:2},{x:0,y:2}] },
  // Plus / cross
  { unitSize: 4, points: [{x:1,y:0},{x:3,y:0},{x:3,y:1},{x:4,y:1},{x:4,y:3},{x:3,y:3},{x:3,y:4},{x:1,y:4},{x:1,y:3},{x:0,y:3},{x:0,y:1},{x:1,y:1}] },
  // Z-shape (horizontal)
  { unitSize: 5, points: [{x:0,y:0},{x:3,y:0},{x:3,y:1},{x:5,y:1},{x:5,y:3},{x:2,y:3},{x:2,y:2},{x:0,y:2}] },
  // Step / staircase
  { unitSize: 4, points: [{x:0,y:2},{x:2,y:2},{x:2,y:1},{x:4,y:1},{x:4,y:4},{x:0,y:4}] },
];

// PAL — HSL/HSLA color palette mirrored from `city-map-v3.css`.
//
// Design rule: every map element sits on a TONAL HIERARCHY of L values in a
// shared blue family (MAP_HUE). Brightness encodes scale / importance:
//   water  L=10   (background — darkest)
//   land   L=30   (canvas)
//   bldgA  L=50   ┐ buildings — exactly two shades, no in-between greys.
//   bldgB  L=60   ┘
//   roads  L=70…92 (network — brightest, biggest road = brightest L)
// This produces a readable depth order: any element above another is brighter.
//
// Keep these values in sync with the CSS file. Both files exist so:
//   - The CSS file is the human-friendly source of truth (CSS custom props).
//   - The JS uses literal HSL strings so SVG fills don't depend on
//     getComputedStyle.
const MAP_HUE = 220;  // true blue (was 212 = sky-blue-cyan)
const MAP_SAT = 100;  // shared base saturation for the blue family
const PAL = {
  // Water — single flat color shared by ocean and river. High saturation +
  // very low L = a deep saturated blue, no cyan cast.
  water:        `hsl(${MAP_HUE}, 100%, 10%)`,
  // Land — saturated mid-blue canvas.
  land:         `hsl(${MAP_HUE}, 65%, 30%)`,
  // Buildings — exactly two shades (L=50, L=60), painted at 30% opacity so
  // the land color shows through.
  bldgA:        `hsla(${MAP_HUE}, 40%, 50%, 0.30)`,
  bldgB:        `hsla(${MAP_HUE}, 35%, 60%, 0.30)`,
  // Streets — L hierarchy by tier. Bigger road = brighter L.
  streetLocal:  `hsla(${MAP_HUE}, 20%, 70%, 0.85)`,   // L=70  — depth 4+
  streetMain:   `hsla(${MAP_HUE}, 20%, 80%, 0.90)`,   // L=80  — depth 2/3
  coastRoad:    `hsla(${MAP_HUE}, 20%, 78%, 0.85)`,   // L=78  — perimeter avenue
  avenue:       `hsla(${MAP_HUE}, 25%, 86%, 0.92)`,   // L=86  — depth 1
  hwyOuter:     `hsla(${MAP_HUE}, 30%, 95%, 0.45)`,   // glow halo
  hwyInner:     `hsl(${MAP_HUE}, 30%, 92%)`,          // L=92  — depth 0
  // Landmarks. Parks and shopping malls are rendered at 30% opacity (per
  // the design rule) so the land + building grid shows through.
  park:         "hsla(140, 38%, 52%, 0.30)",
  plaza:        `hsl(${MAP_HUE}, 30%, 63%)`,
  stadium:      "hsl(140, 35%, 58%)",
  stadiumField: "hsl(135, 50%, 70%)",
  fieldLine:    "hsla(0, 0%, 100%, 0.55)",
  diamond:      "hsl(28, 45%, 55%)",
  mall:         `hsla(${MAP_HUE}, 45%, 35%, 0.30)`,
  mallAccent:   `hsla(${MAP_HUE}, 50%, 13%, 0.55)`,
  mallHighlight:`hsla(${MAP_HUE}, 60%, 81%, 0.18)`,
  // Labels
  label:        "hsl(200, 90%, 96%)",
  labelStroke:  `hsla(${MAP_HUE}, 70%, 8%, 0.85)`
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

// Sutherland-Hodgman polygon clipping against an axis-aligned rectangle.
// Returns the clipped polygon (may be empty if no overlap). Used to compute
// the district's *visible shape* — the part actually on screen.
//
// edgeKind preservation:
//   - Surviving original vertices keep their edgeKind.
//   - Newly-inserted intersection vertices inherit the edgeKind of the edge
//     being clipped (so a coast edge clipped at the viewport still produces
//     a coast-tagged endpoint, etc.).
//   - Edges that run ALONG a viewport boundary (between two consecutive
//     clip-introduced vertices) are tagged "viewport" so the outline renderer
//     can decide whether to draw them.
// To carry this info, each vertex in the result has a `_clipNew` flag set
// to true when it was inserted by clipping. Callers can detect "edge along
// viewport boundary" by checking whether BOTH endpoints have `_clipNew` true.
function _clipPolygonToRect(polygon, rect) {
  // rect = { minX, minY, maxX, maxY }
  const clipEdge = (poly, isInside, intersectFn) => {
    if (!poly.length) return poly;
    const result = [];
    for (let i = 0; i < poly.length; i++) {
      const curr = poly[i];
      const prev = poly[(i - 1 + poly.length) % poly.length];
      const cIn = isInside(curr);
      const pIn = isInside(prev);
      if (cIn) {
        if (!pIn) result.push(intersectFn(prev, curr));
        result.push(curr);
      } else if (pIn) {
        result.push(intersectFn(prev, curr));
      }
    }
    return result;
  };
  // The edgeKind on the OUTGOING edge from `a` is the kind we want for the
  // intersection vertex (which sits on that same edge between a and b).
  const inheritKind = (a) => a.edgeKind || "coast";
  let r = polygon;
  // Left
  r = clipEdge(r,
    p => p.x >= rect.minX,
    (a, b) => {
      const t = (rect.minX - a.x) / (b.x - a.x || 1e-9);
      return { x: rect.minX, y: a.y + t * (b.y - a.y),
               edgeKind: inheritKind(a), _clipNew: true };
    });
  // Right
  r = clipEdge(r,
    p => p.x <= rect.maxX,
    (a, b) => {
      const t = (rect.maxX - a.x) / (b.x - a.x || 1e-9);
      return { x: rect.maxX, y: a.y + t * (b.y - a.y),
               edgeKind: inheritKind(a), _clipNew: true };
    });
  // Top
  r = clipEdge(r,
    p => p.y >= rect.minY,
    (a, b) => {
      const t = (rect.minY - a.y) / (b.y - a.y || 1e-9);
      return { x: a.x + t * (b.x - a.x), y: rect.minY,
               edgeKind: inheritKind(a), _clipNew: true };
    });
  // Bottom
  r = clipEdge(r,
    p => p.y <= rect.maxY,
    (a, b) => {
      const t = (rect.maxY - a.y) / (b.y - a.y || 1e-9);
      return { x: a.x + t * (b.x - a.x), y: rect.maxY,
               edgeKind: inheritKind(a), _clipNew: true };
    });
  return r;
}

// Label placement: scored grid search over the visible district polygon.
// Each candidate point gets a score that combines:
//   - distance from polygon edges + landmark edges (clear-space term)
//   - distance from the visible centroid (centering term, penalty)
//   - exclusion: skip candidates inside landmarks
// The candidate with the highest score wins. This is more robust than a
// naive PIA + centroid blend because it considers BOTH terms simultaneously
// at every candidate, rather than picking two separate winners and averaging
// them (which can land in a non-optimal middle).
function _labelPosition(polygon, landmarks) {
  const margin = 14;
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

  // Visible mass centroid — the "where you'd expect the label" target.
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

  // Diagonal of the visible bbox — used to normalize the centroid penalty so
  // its magnitude is comparable to edgeDist (in pixels) regardless of size.
  const bboxDiag = Math.max(1, Math.hypot(maxX - minX, maxY - minY));
  // Centroid penalty weight: tuned so that centroid distance and edge distance
  // contribute roughly equally for a typical district. Higher weight = label
  // sticks closer to centroid; lower = label drifts toward "fattest" interior.
  const CENTROID_WEIGHT = 0.55;

  let bestX = centroidX, bestY = centroidY, bestScore = -Infinity;
  const step = 3;
  for (let x = minX; x <= maxX; x += step) {
    for (let y = minY; y <= maxY; y += step) {
      if (!_pointInPolygon({ x, y }, visible)) continue;
      let inLm = false;
      for (const lm of lms) {
        if (_pointInPolygon({ x, y }, lm.polygon)) { inLm = true; break; }
      }
      if (inLm) continue;

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
      // Distance from the visible centroid (for centering).
      const centroidDist = Math.hypot(x - centroidX, y - centroidY);

      // Score: prefer LARGE edgeDist (interior), prefer SMALL centroidDist
      // (visually centered). Both terms in pixel space, second one weighted.
      const score = edgeDist - CENTROID_WEIGHT * centroidDist;
      if (score > bestScore) { bestScore = score; bestX = x; bestY = y; }
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

// Number of play locations based on district VISIBLE area. Continuous (not
// bucketed) so a 12000 px² district gets fewer dots than a 24000 px² one
// instead of both falling into the same coarse bucket. Always returns an
// even number (game requires symmetric pair placement).
//
// AREA_PER_DOT_PAIR controls density: each "pair" of dots takes ~ this much
// visible area. Lower = denser map; higher = sparser. Tune to taste.
const _AREA_PER_DOT_PAIR = 4500;
function _dotCountForArea(area) {
  // Each "pair" of dots = 2 dots. Round to nearest pair count, min 1 pair.
  const pairs = Math.max(1, Math.round(area / (_AREA_PER_DOT_PAIR * 2)));
  return pairs * 2;
}

// Polygon-to-path with curve awareness:
// Runs of consecutive road-edged vertices that include at least one "roadMid"
// (true curve mid-point) are Q-smoothed to match the street rendering exactly.
// Pure straight-cut runs (only "road" endpoints, no mids) use straight L —
// otherwise BSP blocks bounded by 3-4 adjacent cuts would render as pillows.
// Non-road edges (coast, untagged) always use straight L.
function _polygonToPath(polygon) {
  const n = polygon.length;
  if (n === 0) return "";
  const isRoadEdge = (i) => (polygon[i].edgeKind === "road" || polygon[i].edgeKind === "roadMid");
  const isCurveMid = (i) => (polygon[i].edgeKind === "roadMid");

  let d = `M ${polygon[0].x.toFixed(2)} ${polygon[0].y.toFixed(2)}`;
  let i = 0;
  while (i < n) {
    if (isRoadEdge(i)) {
      // Find the road run [i .. j-1] (j = first non-road index after i, or n).
      let j = i + 1;
      let runHasMid = isCurveMid(i);
      while (j < n && isRoadEdge(j)) {
        if (isCurveMid(j)) runHasMid = true;
        j++;
      }
      // CRITICAL: the run's geometric terminator is polygon[j] (or polygon[0]
      // if j wraps), NOT polygon[j-1]. polygon[j] is the cut's other endpoint
      // — it has edgeKind="coast" (its OUTGOING edge is coast) but its INCOMING
      // edge is the curve. Including polygon[j] as the L target ensures the
      // smoothed path lands EXACTLY on the cut endpoint, matching the rendered
      // street geometry. Without this, the outline cut its corner at the
      // last interior mid, producing a visible offset along curved cuts.
      const term = polygon[j % n];
      if (runHasMid) {
        // Build the exact same point sequence the street uses:
        //   [polygon[i], polygon[i+1], ..., polygon[j-1], term]
        // and call _smoothPolylinePath — the SAME function that renders the
        // road. This guarantees the district outline is byte-identical to the
        // street geometry. No duplicated curve math, no risk of divergence.
        // We strip the leading "M x y" because the pen is already at polygon[i].
        const roadPoints = [];
        for (let k = i; k < j; k++) roadPoints.push(polygon[k]);
        roadPoints.push(term);
        const sub = _smoothPolylinePath(roadPoints);
        const stripped = sub.replace(/^M\s+[\d.\-]+\s+[\d.\-]+\s*/, "");
        d += " " + stripped;
      } else {
        // Plain straight cut: L through each interior road vertex, then L term.
        for (let k = i + 1; k < j; k++) {
          d += ` L ${polygon[k].x.toFixed(2)} ${polygon[k].y.toFixed(2)}`;
        }
        d += ` L ${term.x.toFixed(2)} ${term.y.toFixed(2)}`;
      }
      // Resume the outer loop AT the terminator vertex; its outgoing edge is
      // handled normally by the non-road branch.
      i = j;
    } else {
      const next = (i + 1) % n;
      d += ` L ${polygon[next].x.toFixed(2)} ${polygon[next].y.toFixed(2)}`;
      i++;
    }
  }
  d += " Z";
  return d;
}

// Build an OUTLINE-only path that skips edges marked `edgeKind === "road"`.
// Road edges are already drawn by the street rendering pipeline (highway,
// avenue, etc.), so re-stroking them with a district color produces an
// undesirable double-line "seam." This helper emits a path with M/L commands
// over only the non-road edges, leaving gaps on shared road boundaries.
//
// Smart smoothing is preserved for any non-road curved runs (rare today, but
// future-proof for curves on coast etc.).
function _polygonOutlinePathSkipRoads(polygon) {
  const n = polygon.length;
  if (n === 0) return "";
  const isRoad = (i) => (polygon[i].edgeKind === "road" || polygon[i].edgeKind === "roadMid");

  let d = "";
  let penDown = false; // true if the SVG pen is currently at polygon[i]
  for (let i = 0; i < n; i++) {
    if (isRoad(i)) {
      // Skip this edge — break the path here.
      penDown = false;
      continue;
    }
    if (!penDown) {
      d += `M ${polygon[i].x.toFixed(2)} ${polygon[i].y.toFixed(2)}`;
      penDown = true;
    }
    const next = (i + 1) % n;
    d += ` L ${polygon[next].x.toFixed(2)} ${polygon[next].y.toFixed(2)}`;
  }
  return d;
}

// Build a CLOSED district outline that includes EVERY edge of the visible
// shape: road edges, coast edges, and viewport-boundary edges. Used as the
// canonical district outline (same path for hover and non-hover; hover only
// adds a glow filter so the shape doesn't change between states).
//
// Steps:
//   1. Clip polygon to a slightly-inset viewport rect (so strokes sit
//      comfortably inside the visible canvas, not flush with the edge).
//   2. Emit a closed polygon path with straight L's between consecutive
//      vertices — no road-skipping, no smoothing. Streets render ABOVE the
//      outline so road-shared portions are visually covered by the street
//      stroke; coast and viewport portions remain visible.
function _polygonOutlinePathClippedToViewport(polygon, viewportInset = 1) {
  const rect = {
    minX: viewportInset, minY: viewportInset,
    maxX: VIEW_W - viewportInset, maxY: VIEW_H - viewportInset
  };
  const clipped = _clipPolygonToRect(polygon, rect);
  const n = clipped.length;
  if (n < 2) return "";
  let d = `M ${clipped[0].x.toFixed(2)} ${clipped[0].y.toFixed(2)}`;
  for (let i = 1; i < n; i++) {
    d += ` L ${clipped[i].x.toFixed(2)} ${clipped[i].y.toFixed(2)}`;
  }
  d += " Z";
  return d;
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
function _splitPolygonByLine(polygon, L1, L2, polylineMids = null) {
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
  // This distinction prevents straight-BSP-cut blocks (where 3-4 consecutive
  // vertices are all I1/I2 endpoints from adjacent cuts) from being mistakenly
  // smoothed into pillow shapes.

  // half1 = V0..Va + I1 + mids(forward) + I2 + V(b+1)..Vn-1
  const half1 = [];
  for (let i = 0; i <= a; i++) half1.push({ x: polygon[i].x, y: polygon[i].y, edgeKind: polygon[i].edgeKind });
  half1.push({ x: I1.x, y: I1.y, edgeKind: "road" });
  for (const m of mids) half1.push({ x: m.x, y: m.y, edgeKind: "roadMid" });
  half1.push({ x: I2.x, y: I2.y, edgeKind: bKind });
  for (let i = b + 1; i < n; i++) half1.push({ x: polygon[i].x, y: polygon[i].y, edgeKind: polygon[i].edgeKind });

  // half2 = I1 + V(a+1)..Vb + I2 + mids(reverse)
  const half2 = [];
  half2.push({ x: I1.x, y: I1.y, edgeKind: aKind });
  for (let i = a + 1; i <= b; i++) half2.push({ x: polygon[i].x, y: polygon[i].y, edgeKind: polygon[i].edgeKind });
  half2.push({ x: I2.x, y: I2.y, edgeKind: "road" });
  for (let i = mids.length - 1; i >= 0; i--) {
    half2.push({ x: mids[i].x, y: mids[i].y, edgeKind: "roadMid" });
  }

  if (_polygonArea(half1) < 50 || _polygonArea(half2) < 50) return null;

  const polyline = mids.length
    ? [{ x: I1.x, y: I1.y }, ...mids.map(m => ({ x: m.x, y: m.y })), { x: I2.x, y: I2.y }]
    : null;

  return [half1, half2, {
    p1: { x: I1.x, y: I1.y },
    p2: { x: I2.x, y: I2.y },
    polyline
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

// Return the cut as a list of straight segments matching the SVG rendering.
// - Straight cuts: 1 segment (p1, p2).
// - Curved cuts: many small segments sampled along the smoothed Q-bezier path,
//   so bridge detection / road-buffer hit-tests align with the *visible* curve.
function _cutSegments(cut) {
  if (!cut.polyline || cut.polyline.length < 2) return [{ a: cut.p1, b: cut.p2 }];
  return _sampleSmoothPolyline(cut.polyline, 8);
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
        depth: cut.depth
      });
    }
  }
  return out;
}

// Sample the EXACT smoothed-polyline curve into straight segments. Uses the
// same Q-bezier-through-midpoints formulation as `_smoothPolylinePath`, so the
// returned segments precisely overlay the rendered SVG path.
//
// SVG path for `pts` (length k+1, k>=2):
//   M pts[0]
//   Q via pts[1] to mid(1,2)        ← starts at pts[0]
//   Q via pts[i] to mid(i,i+1)      ← starts at mid(i-1,i), for i=2..k-1
//   L pts[k]                        ← from mid(k-1,k) to pts[k]
//
// We mirror that exactly so the sampled polyline is geometrically identical
// (within sub-pixel resolution given the per-segment step count).
function _sampleSmoothPolyline(pts, stepsPerSeg) {
  const samples = [];
  const k = pts.length - 1;
  if (k < 1) {
    if (pts.length === 1) samples.push({ x: pts[0].x, y: pts[0].y });
    return _samplesToSegments(samples);
  }
  if (k === 1) {
    samples.push({ x: pts[0].x, y: pts[0].y });
    samples.push({ x: pts[1].x, y: pts[1].y });
    return _samplesToSegments(samples);
  }

  const steps = stepsPerSeg | 0 || 8;
  samples.push({ x: pts[0].x, y: pts[0].y });
  for (let i = 1; i < k; i++) {
    const c = pts[i];
    const start = (i === 1)
      ? { x: pts[0].x, y: pts[0].y }
      : { x: (pts[i - 1].x + pts[i].x) / 2, y: (pts[i - 1].y + pts[i].y) / 2 };
    const end = { x: (pts[i].x + pts[i + 1].x) / 2, y: (pts[i].y + pts[i + 1].y) / 2 };
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      const mt = 1 - t;
      samples.push({
        x: mt * mt * start.x + 2 * mt * t * c.x + t * t * end.x,
        y: mt * mt * start.y + 2 * mt * t * c.y + t * t * end.y
      });
    }
  }
  samples.push({ x: pts[k].x, y: pts[k].y });
  return _samplesToSegments(samples);
}

function _samplesToSegments(samples) {
  const segs = [];
  for (let i = 0; i < samples.length - 1; i++) {
    segs.push({ a: samples[i], b: samples[i + 1] });
  }
  return segs;
}

// SVG path for a polyline, smoothed via quadratic beziers through midpoints
// (produces C1-continuous smooth curves for 3+ points).
function _smoothPolylinePath(points) {
  if (!points || points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  if (points.length === 2) {
    return `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)} L ${points[1].x.toFixed(2)} ${points[1].y.toFixed(2)}`;
  }
  let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  for (let i = 1; i < points.length - 1; i++) {
    const mx = (points[i].x + points[i + 1].x) / 2;
    const my = (points[i].y + points[i + 1].y) / 2;
    d += ` Q ${points[i].x.toFixed(2)} ${points[i].y.toFixed(2)} ${mx.toFixed(2)} ${my.toFixed(2)}`;
  }
  d += ` L ${points[points.length - 1].x.toFixed(2)} ${points[points.length - 1].y.toFixed(2)}`;
  return d;
}

// ============================================================
// LAND POLYGON
// ============================================================

function _generateLandPolygon(rng) {
  // Two modes:
  //   PENINSULA (75%): standard wide-variation polygon, often extends past
  //     several viewport edges, may show coast on 0-2 sides.
  //   EXPOSED   (25%): center heavily offset toward one corner; the polygon
  //     extends past the FAR sides, but pulls back from the NEAR sides to
  //     reveal coast on 1-3 sides. Land still fills most of the viewport so
  //     ocean isn't excessive.
  const exposedMode = rng() < 0.25;
  const N = 20;
  const phaseA = rng() * Math.PI * 2;
  const phaseB = rng() * Math.PI * 2;
  const phaseC = rng() * Math.PI * 2;

  // Both modes use VIEWPORT-EDGE-RELATIVE radii: each vertex is placed at
  // (factor * distance-to-viewport-edge along that direction). This guarantees
  // the polygon hugs the viewport tightly on most sides — water only appears
  // where the factor dips below 1.0 (a "coastal bite"). No more 80px-wide
  // ocean strips on sides we never intended to expose.
  const distToViewportEdge = (cx, cy, dx, dy) => {
    const tx = dx > 0 ? (VIEW_W - cx) / dx : (dx < 0 ? -cx / dx : 1e9);
    const ty = dy > 0 ? (VIEW_H - cy) / dy : (dy < 0 ? -cy / dy : 1e9);
    return Math.min(Math.abs(tx), Math.abs(ty));
  };

  if (exposedMode) {
    // EXPOSED: one chosen direction shows coast clearly; vertices facing that
    // direction pull inward (factor < 1), vertices on the opposite side push
    // past the viewport (factor > 1). Coast is visible on a wide arc.
    const exposeAngle = rng() * Math.PI * 2;
    const cx = VIEW_W / 2 + (rng() - 0.5) * 25;
    const cy = VIEW_H / 2 + (rng() - 0.5) * 25;
    const verts = [];
    for (let i = 0; i < N; i++) {
      const angle = (i / N) * Math.PI * 2 + (rng() - 0.5) * 0.18;
      const dx = Math.cos(angle), dy = Math.sin(angle);
      const dEdge = distToViewportEdge(cx, cy, dx, dy);
      // Directional bias: +1 (full expose) → 0.82, -1 (opposite) → 1.18.
      const cosToExpose = Math.cos(angle - exposeAngle);
      const directional = 1.0 - 0.18 * cosToExpose;
      const r1 = 0.08 * Math.cos(angle * 1 + phaseA);
      const r2 = 0.05 * Math.cos(angle * 3 + phaseB);
      const r3 = 0.025 * Math.cos(angle * 5 + phaseC);
      const jitter = (rng() - 0.5) * 0.04;
      const k = Math.max(0.55, directional + r1 + r2 + r3 + jitter);
      verts.push({
        x: cx + dx * dEdge * k,
        y: cy + dy * dEdge * k,
        edgeKind: "coast"
      });
    }
    return verts;
  }

  // PENINSULA mode: organic wobble around a base factor of 1.05 (mostly past
  // the viewport edge). Random sectors dip below 1.0 — those are the coastal
  // bites that show water. Variation amplitude tuned so water is always
  // visible somewhere but never wastes more than ~30 px.
  const cx = VIEW_W / 2 + (rng() - 0.5) * 30;
  const cy = VIEW_H / 2 + (rng() - 0.5) * 30;
  const verts = [];
  for (let i = 0; i < N; i++) {
    const angle = (i / N) * Math.PI * 2 + (rng() - 0.5) * 0.18;
    const dx = Math.cos(angle), dy = Math.sin(angle);
    const dEdge = distToViewportEdge(cx, cy, dx, dy);
    const r1 = 0.10 * Math.cos(angle * 1 + phaseA);
    const r2 = 0.06 * Math.cos(angle * 3 + phaseB);
    const r3 = 0.03 * Math.cos(angle * 5 + phaseC);
    const jitter = (rng() - 0.5) * 0.04;
    const k = Math.max(0.55, 1.05 + r1 + r2 + r3 + jitter); // ~0.82..1.28
    verts.push({
      x: cx + dx * dEdge * k,
      y: cy + dy * dEdge * k,
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
  return {
    halfA: result[0], halfB: result[1], cutSeg: result[2], angle: cutAngle,
    cutLineP1: p1, cutLineP2: p2  // retained for later curve-attempt re-split
  };
}

// Split land into 3 macro regions via 2 sequential cuts.
// First cut: split into 2 halves. Second cut: split the LARGER half into 2.
// Result: 3 regions of roughly comparable size.
//
// Highways (depth 0) and avenues (depth 1) are the "curvable" street tiers:
// after finding each best straight cut, we attempt to curve it. If the curve
// escapes the polygon, we silently fall back to the straight cut.
function _macroDivide3(landPolygon, gridAngle, rng) {
  const totalArea = _polygonArea(landPolygon);
  const target1 = totalArea / 3; // smaller half should be ~1/3 of total

  // Probability of curving at each macro tier.
  // TEMPORARILY DISABLED — curved cuts are being debugged for district-outline
  // alignment. Set both to 0 so all macro cuts are guaranteed straight; this
  // isolates whether remaining outline issues are curve-specific or general.
  const CURVE_P_HIGHWAY = 0.0;
  const CURVE_P_AVENUE  = 0.0;

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
  // The third arg is the min-min-dimension (px) of the visible bbox.
  let best1 = findFirstCut(0.22, 4500, 55);
  if (!best1) best1 = findFirstCut(0.15, 3500, 45);
  if (!best1) best1 = findFirstCut(0.0, 2500, 30);
  if (!best1) best1 = findFirstCut(0.0, 2500, 0); // last resort
  if (!best1) return { regions: [landPolygon], macroCuts: [] };

  // HIGHWAY curve attempt
  if (rng() < CURVE_P_HIGHWAY) {
    const straightResult = [best1.halfA, best1.halfB, best1.cutSeg];
    const curved = _tryCurveCut(landPolygon, straightResult, best1.cutLineP1, best1.cutLineP2, rng);
    if (curved) {
      best1.halfA = curved[0];
      best1.halfB = curved[1];
      best1.cutSeg = curved[2];
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
    for (let attempt = 0; attempt < 18; attempt++) {
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
      // Prefer balanced halves
      const ratio = Math.max(xA, xB) / Math.max(1, Math.min(xA, xB));
      if (ratio < bstScore) { bst = r; bstScore = ratio; }
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
      macroCuts: [{
        p1: best1.cutSeg.p1, p2: best1.cutSeg.p2,
        polyline: best1.cutSeg.polyline || null,
        depth: 0, angle: best1.angle
      }]
    };
  }

  // AVENUE curve attempt — but if the highway already curved, drastically
  // reduce the probability of curving the avenue too. Two curves stacked tend
  // to look chaotic; one feature curve per map reads cleaner.
  const highwayCurved = !!(best1.cutSeg && best1.cutSeg.polyline);
  const effAvenueP = highwayCurved ? CURVE_P_AVENUE * 0.4 : CURVE_P_AVENUE;
  if (rng() < effAvenueP) {
    const straightResult = [best2.halfA, best2.halfB, best2.cutSeg];
    const curved = _tryCurveCut(larger, straightResult, best2.cutLineP1, best2.cutLineP2, rng);
    if (curved) {
      best2.halfA = curved[0];
      best2.halfB = curved[1];
      best2.cutSeg = curved[2];
    }
  }

  return {
    regions: [smaller, best2.halfA, best2.halfB],
    macroCuts: [
      {
        p1: best1.cutSeg.p1, p2: best1.cutSeg.p2,
        polyline: best1.cutSeg.polyline || null,
        depth: 0, angle: best1.angle
      },
      {
        p1: best2.cutSeg.p1, p2: best2.cutSeg.p2,
        polyline: best2.cutSeg.polyline || null,
        depth: 1, angle: best2.angle
      }
    ]
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
  const minArea = 90 + rng() * 140;            // ~90..230 px²  (was 320..800)
  const maxDepth = 9 + Math.floor(rng() * 3);  // 9..11         (was 6..8)

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
    if (v.edgeKind === "roadMid") hasCurvedBoundary = true;
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
    if (r > 4.5 && !centerNearRiver) {
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
    ? (4.5 + rng() * 2.0)    // ~4.5-6.5 px (small, fits curves/coast)
    : (5.5 + rng() * 2.5);   // ~5.5-8 px (dense regular blocks)
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
    const corners = [
      { u: u1, v: v1 }, { u: u2, v: v1 },
      { u: u2, v: v2 }, { u: u1, v: v2 }
    ].map(p => ({
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

  // The minimum distance from any polygon edge (= a road or coast). Dots
  // closer than this to ANY edge would feel like they're sitting on the road
  // boundary — bad for gameplay readability. Tuned so even small districts
  // keep dots clearly inside.
  const HARD_MIN_EDGE = Math.min(idealSpacing * 0.40, 9);

  // ----- Phase 2: spring relaxation for even spread + edge avoidance -----
  const ITERATIONS = 22;          // more iterations → better convergence
  const stepScale = 0.45;
  const EDGE_BUFFER = Math.max(idealSpacing * 0.55, HARD_MIN_EDGE + 2);
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
          const f = (EDGE_BUFFER - d) / EDGE_BUFFER * 1.8;
          fx += (dx / d) * f;
          fy += (dy / d) * f;
        }
      }
      // Apply force, clamp to polygon
      const newX = placed[i].x + fx * stepScale;
      const newY = placed[i].y + fy * stepScale;
      if (_pointInPolygon({ x: newX, y: newY }, polygon)) {
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
        if (_pointInPolygon({ x: nx, y: ny }, polygon)) {
          let inLm = false;
          for (const lb of leafBlocksToAvoid) {
            if (_pointInPolygon({ x: nx, y: ny }, lb.polygon)) { inLm = true; break; }
          }
          if (!inLm) {
            placed[i].x = nx;
            placed[i].y = ny;
            allClear = false;
          }
        }
      }
    }
    if (allClear) break;
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
      // Also keep the moved dot off the boundary
      let onEdge = false;
      for (let k = 0; k < polygon.length; k++) {
        const a = polygon[k];
        const b = polygon[(k + 1) % polygon.length];
        if (_pointToSegmentDist(newX, newY, a, b) < HARD_MIN_EDGE) { onEdge = true; break; }
      }
      if (!inLandmark && !onEdge) { placed[j].x = newX; placed[j].y = newY; }
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
  // TEMPORARILY LOCKED to 0 (grid axis-aligned to viewport) so big anchor
  // streets read horizontal/vertical and we can debug district geometry
  // without the visual confusion of a tilted grid. Original was
  // `(rng() - 0.5) * 0.5` (±~14°). Restore that for natural tilt later.
  const cityGridAngle = 0;

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
    // Always seed 4-7 additional small parks/plazas/strip-malls per district.
    // Real cities have *many* small green & civic spaces. Smaller blocks
    // dramatically prefer "park", since tiny green pocket parks are extremely
    // common in dense urban grids.
    const numSmallExtra = 4 + Math.floor(rng() * 4); // 4..7
    {
      const sortedSmall = small
        .map(lb => ({ lb, area: _polygonArea(lb.polygon) }))
        // Allow tinier candidates so pocket parks slot into the dense grid.
        .filter(x => x.area > 90 && x.area < 1800)
        .filter(x => !picks.some(p => p.lb === x.lb))
        // Mostly biggest-first, with mild jitter so it isn't deterministic.
        .sort((a, b) => (b.area + (rng() - 0.5) * 400) - (a.area + (rng() - 0.5) * 400));
      for (let k = 0; k < numSmallExtra && k < sortedSmall.length; k++) {
        picks.push({ lb: sortedSmall[k].lb, big: false, area: sortedSmall[k].area });
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
        //   tiny block (≤300 px²): 90% park, 8% plaza, 2% mall
        //   small      (≤700)   :  70% park, 22% plaza, 8% mall
        //   medium    (≤1800)   :  50% park, 32% plaza, 18% mall
        // Smaller block ⇒ much more likely to be a pocket park.
        const area = p.area != null ? p.area : _polygonArea(lb.polygon);
        let parkP, plazaP;
        if      (area <= 300)  { parkP = 0.90; plazaP = 0.08; }
        else if (area <= 700)  { parkP = 0.70; plazaP = 0.22; }
        else                    { parkP = 0.50; plazaP = 0.32; }
        const r = rng();
        if (r < parkP)              type = "park";
        else if (r < parkP + plazaP) type = "plaza";
        else                         type = "mall"; // small "strip mall"
      }
      d.landmarks.push({
        polygon: lb.polygon,
        path: _polygonToPath(lb.polygon),
        type
      });
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

  // 7. Dot placement — every district gets exactly 4, 6, or 8 spots.
  // Counts are assigned by RANK of visible area: smallest district = 4,
  // middle = 6, largest = 8. Placement uses spring relaxation as before.
  const districtsByArea = districts
    .map(d => ({ d, vis: _viewportVisibleArea(d.polygon) }))
    .sort((a, b) => a.vis - b.vis);
  const dotCounts = [4, 6, 8];
  for (let r = 0; r < districtsByArea.length; r++) {
    districtsByArea[r].d._dotTarget = dotCounts[Math.min(r, dotCounts.length - 1)];
  }
  for (const d of districts) {
    const visArea = _viewportVisibleArea(d.polygon);
    const target = d._dotTarget != null ? d._dotTarget : 6;
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
  // 60% chance of a primary river. If we get one, 50% chance of a secondary
  // river too (so ~30% of maps have two). Both get merged into a single
  // `river` object (paths concatenated, segments arrays concatenated). The
  // SVG renderer treats multi-subpath `d` strings normally.
  const river1 = rng() < 0.6 ? _generateRiver(landPolygon, rng) : null;
  const river2 = (river1 && rng() < 0.5) ? _generateRiver(landPolygon, rng) : null;
  let river = null;
  if (river1 && river2) {
    river = {
      path: river1.path + " " + river2.path,
      segments: [...river1.segments, ...river2.segments],
      pts: river1.pts,
      widthScale: river1.widthScale,
      // Use the first river's stroke widths so both render at a single,
      // consistent thickness. (Per-river widths would require splitting the
      // render into two paths — keeping things simple for now.)
      outerWidth: river1.outerWidth,
      innerWidth: river1.innerWidth,
      buildingBuffer: Math.max(river1.buildingBuffer, river2.buildingBuffer)
    };
  } else if (river1) {
    river = river1;
  }
  const riverSegments = river ? river.segments : null;

  // 9b. Road hazards — every cut becomes one or more line segments with a
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
  const coastRoadPath = _polygonToPath(coastRoadPolygon);

  // 12. Bridges — placed where BIG and MID streets (highway / avenue / main
  // street) and the coast road cross the river. Rules:
  //   - Cuts with depth <= 2 are eligible (highways, avenues, main streets).
  //     Local streets (depth >= 3) still dead-end at the bank in step 12b.
  //   - Sort cuts by depth (highways first) so bigger streets get priority.
  //     If two streets cross the river too close together, only the bigger
  //     one (or earliest in iteration) gets a bridge.
  //   - Enforce a MIN_BRIDGE_DIST so bridges aren't piled on top of each other.
  //   - The coast road also gets bridges where the river meets the coast.
  const bridges = [];
  const MIN_BRIDGE_DIST = 18; // px between bridge centers
  if (riverSegments) {
    // (a) Street bridges — every depth-0/1/2 cut crossing the river.
    const cutsByPriority = [...allCuts]
      .filter(c => c.depth <= 2)
      .sort((a, b) => a.depth - b.depth);
    for (const cut of cutsByPriority) {
      const cutSegs = _cutSegments(cut);
      let placed = false;
      for (const cs of cutSegs) {
        for (const rs of riverSegments) {
          const hit = _segIntersect(cs.a, cs.b, rs.a, rs.b);
          if (!hit) continue;
          let tooClose = false;
          for (const b of bridges) {
            if (Math.hypot(b.x - hit.x, b.y - hit.y) < MIN_BRIDGE_DIST) { tooClose = true; break; }
          }
          if (tooClose) { placed = true; break; }
          const segAngle = Math.atan2(cs.b.y - cs.a.y, cs.b.x - cs.a.x);
          bridges.push({ x: hit.x, y: hit.y, angle: segAngle, depth: cut.depth });
          placed = true;
          break;
        }
        if (placed) break;
      }
    }

    // (b) Coast-road bridges — at every river-mouth (where the river crosses
    // the inset coast-road polygon). Treated as avenue-tier (depth=1).
    const NCR = coastRoadPolygon.length;
    for (let i = 0; i < NCR; i++) {
      const a = coastRoadPolygon[i];
      const b = coastRoadPolygon[(i + 1) % NCR];
      let crHit = null;
      for (const rs of riverSegments) {
        const hit = _segIntersect(a, b, rs.a, rs.b);
        if (hit) { crHit = hit; break; }
      }
      if (!crHit) continue;
      let tooClose = false;
      for (const br of bridges) {
        if (Math.hypot(br.x - crHit.x, br.y - crHit.y) < MIN_BRIDGE_DIST) { tooClose = true; break; }
      }
      if (tooClose) continue;
      const segAngle = Math.atan2(b.y - a.y, b.x - a.x);
      bridges.push({ x: crHit.x, y: crHit.y, angle: segAngle, depth: 1 });
    }
  }

  // 12c. Offshore bridges — decorative bridge sprites floating just off the
  // coast, suggesting connections to off-map territory (à la NY/SF/Tokyo
  // bay bridges). 70% of maps get 1-3 of them. Each is placed at a random
  // coast edge midpoint, oriented along the outward normal so the bridge's
  // long axis points "out to sea". Skips river-mouth zones to keep the
  // existing river bridges visually distinct.
  if (rng() < 0.7) {
    const numOffshore = 1 + Math.floor(rng() * 3);   // 1..3
    const Nlp = landPolygon.length;
    let placedCount = 0;
    for (let attempt = 0; attempt < numOffshore * 8 && placedCount < numOffshore; attempt++) {
      const i = Math.floor(rng() * Nlp);
      const a = landPolygon[i];
      const b = landPolygon[(i + 1) % Nlp];
      const ex = b.x - a.x, ey = b.y - a.y;
      const elen = Math.hypot(ex, ey) || 1;
      const t = 0.3 + rng() * 0.4;
      const px = a.x + ex * t, py = a.y + ey * t;
      // Skip points near a river mouth.
      if (riverSegments && _distToRiver(px, py, riverSegments) < 25) continue;
      // Outward normal: perpendicular to coast edge, pointing OUT of land.
      let nx = -ey / elen, ny = ex / elen;
      if (!_pointInPolygon({ x: px - nx * 1.2, y: py - ny * 1.2 }, landPolygon)) {
        nx = -nx; ny = -ny;
      }
      const offset = 7 + rng() * 6;                  // 7..13 px offshore
      const bx = px + nx * offset;
      const by = py + ny * offset;
      // Keep within viewport with a small margin.
      if (bx < 4 || bx > VIEW_W - 4 || by < 4 || by > VIEW_H - 4) continue;
      // Avoid stacking onto an existing bridge.
      let tooClose = false;
      for (const br of bridges) {
        if (Math.hypot(br.x - bx, br.y - by) < MIN_BRIDGE_DIST) { tooClose = true; break; }
      }
      if (tooClose) continue;
      // Bridge angle = outward normal so the bridge's long edge points to sea.
      const angle = Math.atan2(ny, nx);
      bridges.push({ x: bx, y: by, angle, depth: 1, offshore: true });
      placedCount++;
    }
  }

  // 12b. Truncate small streets that cross the river without a bridge.
  // For depth >= 2 cuts (main streets + locals), any river crossing splits
  // the cut into dead-end halves that retreat from each bank by `riverGap`.
  // For depth 0/1 cuts that DID get a bridge, leave them intact (the bridge
  // sprite covers the river crossing visually).
  // For depth 0/1 cuts that DIDN'T get a bridge (e.g. close to another big
  // bridge), also truncate so they don't appear to swim across the water.
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
      if (cut.depth <= 2 && hasBridgeNear(cut)) {
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

  return {
    landPolygon,
    landPath: _polygonToPath(landPolygon),
    coastRoadPath,
    districts,
    cuts: renderedCuts,
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
  enemyScore = null
}) {
  const W = width || VIEW_W;
  const H = height || VIEW_H;
  const data = _useMemoCM(() => buildCityV3(seed || 1), [seed]);
  const idBase = `cv3-${seed || 1}`;

  // Track which district (if any) the mouse is hovering over, for outline glow.
  const [hoveredDistrict, setHoveredDistrict] = React.useState(null);

  // Sort non-highway cuts by depth (deepest=thinnest first); highways drawn separately on top
  const sortedCuts = data.cuts.filter(c => c.depth > 0).sort((a, b) => b.depth - a.depth);
  const hwyCuts = data.cuts.filter(c => c.depth === 0);

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
      </defs>

      {/* WATER — single flat-color ocean. */}
      <rect x={0} y={0} width={VIEW_W} height={VIEW_H} fill={PAL.water} />

      {/* LAND base */}
      <path d={data.landPath} fill={PAL.land} />
      {/* Score-driven win/lose tint over land (no-op if scores not provided) */}
      {scoreTint && (
        <path d={data.landPath} fill={scoreTint.color} opacity={scoreTint.opacity}
          style={{ pointerEvents: "none", mixBlendMode: "multiply" }} />
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

      {/* STREETS — render in order: deepest (local) first, then thicker.
          Curved cuts (highways/avenues) render as smoothed paths; straight cuts
          stay as <line> for crisp rendering. */}
      {showStreets && (
        <g>
          {sortedCuts.map((cut, i) => {
            const style = _streetStyle(cut.depth);
            if (cut.polyline) {
              return (
                <path
                  key={`s-${i}`}
                  d={_smoothPolylinePath(cut.polyline)}
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
          {hwyCuts.map((cut, i) => cut.polyline ? (
            <path
              key={`hwy-glow-${i}`}
              d={_smoothPolylinePath(cut.polyline)}
              fill="none"
              stroke={PAL.hwyOuter}
              strokeWidth={4.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.55}
              vectorEffect="non-scaling-stroke"
            />
          ) : (
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
          {hwyCuts.map((cut, i) => cut.polyline ? (
            <path
              key={`hwy-inner-${i}`}
              d={_smoothPolylinePath(cut.polyline)}
              fill="none"
              stroke={PAL.hwyInner}
              strokeWidth={2.0}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          ) : (
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
                  stroke="rgba(255,255,255,0.65)"
                  strokeWidth={0.8}
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
                  fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth={2.4}
                  vectorEffect="non-scaling-stroke"
                />
                <circle
                  cx={b.cx} cy={b.cy} r={ring}
                  fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth={1.0}
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
          opacity={0.85}
          vectorEffect="non-scaling-stroke"
        />
      )}

      {/* RIVER — drawn AFTER all roads (streets + highway + roundabouts +
          coast road) so the water visibly covers any small-street stub that
          would otherwise poke into the river. Bridges render right after
          the river so they sit on top and read as crossings. Single flat
          stroke uses the same `water` color as the ocean. */}
      {data.river && (
        <g clipPath={`url(#${idBase}-land)`}>
          <path
            d={data.river.path}
            fill="none"
            stroke={PAL.water}
            strokeWidth={data.river.outerWidth}
            strokeLinecap="round"
          />
        </g>
      )}

      {/* BRIDGES — render where big streets and the coast road cross the
          river. Drawn AFTER the river so the bridge deck sits cleanly over
          the water. Width-along-road spans the river (with overhang);
          thickness-across-road is sized by street depth. */}
      {showStreets && data.bridges && data.bridges.map((b, i) => {
        const baseW = b.depth === 0 ? 11 : (b.depth === 1 ? 9 : (b.depth === 2 ? 7 : 5.5));
        const riverW = data.river ? data.river.outerWidth : 0;
        const w = Math.max(baseW, riverW + 3); // ensure bridge spans river
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

      {/* DISTRICT OUTLINES — full closed outline of every district's visible
          shape (clipped to the viewport). Rendered AFTER streets so they appear
          on top of interior streets, making them clearly visible. On coast and
          viewport-edge boundaries the outline is fully visible.
          Hover state uses the EXACT SAME path; only stroke width, opacity,
          and a drop-shadow glow filter change. The shape itself never
          changes between states. */}
      <g>
        {data.districts.map(d => {
          const isHovered = hoveredDistrict === d.idx;
          // The path is IDENTICAL in both states — only the glow filter and
          // brightness change. This guarantees hover never reshapes anything,
          // it just lights up the same outline.
          return (
            <path
              key={`outline-${d.idx}`}
              d={d.outlinePath}
              fill="none"
              stroke={d.color}
              strokeWidth={isHovered ? 2.2 : 1.6}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={isHovered ? 1.0 : 0.85}
              vectorEffect="non-scaling-stroke"
              style={{
                filter: isHovered
                  ? `drop-shadow(0 0 3px ${d.color}) drop-shadow(0 0 7px ${d.color}) drop-shadow(0 0 14px ${d.color})`
                  : "none",
                transition: "stroke-width 0.15s ease, opacity 0.15s ease, filter 0.15s ease",
                pointerEvents: "none"
              }}
            />
          );
        })}
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
