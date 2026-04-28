(function () {
  "use strict";

  const EPS = 1e-9;

  function segIntersect(a, b, c, d) {
    const dx1 = b.x - a.x, dy1 = b.y - a.y;
    const dx2 = d.x - c.x, dy2 = d.y - c.y;
    const denom = dx1 * dy2 - dy1 * dx2;
    if (Math.abs(denom) < EPS) return null;
    const t = ((c.x - a.x) * dy2 - (c.y - a.y) * dx2) / denom;
    const u = ((c.x - a.x) * dy1 - (c.y - a.y) * dx1) / denom;
    if (t < -EPS || t > 1 + EPS || u < -EPS || u > 1 + EPS) return null;
    return { x: a.x + t * dx1, y: a.y + t * dy1, t, u };
  }

  function pointInPolygon(p, polygon) {
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

  function polygonArea(polygon) {
    let a = 0;
    const n = polygon.length;
    for (let i = 0; i < n; i++) {
      const p = polygon[i];
      const q = polygon[(i + 1) % n];
      a += p.x * q.y - q.x * p.y;
    }
    return Math.abs(a) / 2;
  }

  function polygonCentroid(polygon) {
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

  function pointToSegmentDist(px, py, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const len2 = dx * dx + dy * dy || 1e-9;
    const t = Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / len2));
    const cx = a.x + t * dx, cy = a.y + t * dy;
    return Math.hypot(px - cx, py - cy);
  }

  function pointToPolygonSignedDist(point, polygon) {
    const edgeDist = polygon.reduce((best, p, i) => {
      const q = polygon[(i + 1) % polygon.length];
      return Math.min(best, pointToSegmentDist(point.x, point.y, p, q));
    }, Infinity);
    return pointInPolygon(point, polygon) ? edgeDist : -edgeDist;
  }

  function polylabel(polygon, precision = 1.5, fallback = { x: 0, y: 0 }) {
    if (!polygon || polygon.length < 3) return { x: fallback.x, y: fallback.y, d: 0 };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of polygon) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    const width = maxX - minX;
    const height = maxY - minY;
    const cellSize = Math.min(width, height);
    if (cellSize <= 0) return { x: minX, y: minY, d: 0 };
    const makeCell = (x, y, h) => {
      const d = pointToPolygonSignedDist({ x, y }, polygon);
      return { x, y, h, d, max: d + h * Math.SQRT2 };
    };
    let best = makeCell((minX + maxX) / 2, (minY + maxY) / 2, 0);
    const centroid = polygonCentroid(polygon);
    const centroidCell = makeCell(centroid.x, centroid.y, 0);
    if (centroidCell.d > best.d) best = centroidCell;
    const cells = [];
    for (let x = minX; x < maxX; x += cellSize) {
      for (let y = minY; y < maxY; y += cellSize) {
        cells.push(makeCell(x + cellSize / 2, y + cellSize / 2, cellSize / 2));
      }
    }
    while (cells.length) {
      cells.sort((a, b) => b.max - a.max);
      const cell = cells.shift();
      if (cell.d > best.d) best = cell;
      if (cell.max - best.d <= precision) continue;
      const h = cell.h / 2;
      cells.push(
        makeCell(cell.x - h, cell.y - h, h),
        makeCell(cell.x + h, cell.y - h, h),
        makeCell(cell.x - h, cell.y + h, h),
        makeCell(cell.x + h, cell.y + h, h)
      );
    }
    return best;
  }

  function segmentToSegmentDist(a, b, c, d) {
    if (segIntersect(a, b, c, d)) return 0;
    return Math.min(
      pointToSegmentDist(a.x, a.y, c, d),
      pointToSegmentDist(b.x, b.y, c, d),
      pointToSegmentDist(c.x, c.y, a, b),
      pointToSegmentDist(d.x, d.y, a, b)
    );
  }

  function polygonToPolygonDist(polyA, polyB) {
    if (!polyA || !polyB || polyA.length < 3 || polyB.length < 3) return Infinity;
    for (const p of polyA) if (pointInPolygon(p, polyB)) return 0;
    for (const p of polyB) if (pointInPolygon(p, polyA)) return 0;
    let best = Infinity;
    for (let i = 0; i < polyA.length; i++) {
      const a1 = polyA[i];
      const a2 = polyA[(i + 1) % polyA.length];
      for (let j = 0; j < polyB.length; j++) {
        const b1 = polyB[j];
        const b2 = polyB[(j + 1) % polyB.length];
        best = Math.min(best, segmentToSegmentDist(a1, a2, b1, b2));
        if (best <= 0) return 0;
      }
    }
    return best;
  }

  // Sutherland-Hodgman polygon clipping against an axis-aligned rectangle.
  function clipPolygonToRect(polygon, rect) {
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
    const inheritKind = (a) => a.edgeKind || "coast";
    let r = polygon;
    r = clipEdge(r,
      p => p.x >= rect.minX,
      (a, b) => {
        const t = (rect.minX - a.x) / (b.x - a.x || 1e-9);
        return { x: rect.minX, y: a.y + t * (b.y - a.y),
                 edgeKind: inheritKind(a), _clipNew: true };
      });
    r = clipEdge(r,
      p => p.x <= rect.maxX,
      (a, b) => {
        const t = (rect.maxX - a.x) / (b.x - a.x || 1e-9);
        return { x: rect.maxX, y: a.y + t * (b.y - a.y),
                 edgeKind: inheritKind(a), _clipNew: true };
      });
    r = clipEdge(r,
      p => p.y >= rect.minY,
      (a, b) => {
        const t = (rect.minY - a.y) / (b.y - a.y || 1e-9);
        return { x: a.x + t * (b.x - a.x), y: rect.minY,
                 edgeKind: inheritKind(a), _clipNew: true };
      });
    r = clipEdge(r,
      p => p.y <= rect.maxY,
      (a, b) => {
        const t = (rect.maxY - a.y) / (b.y - a.y || 1e-9);
        return { x: a.x + t * (b.x - a.x), y: rect.maxY,
                 edgeKind: inheritKind(a), _clipNew: true };
      });
    return r;
  }

  function insetPolygon(polygon, dist) {
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
      if (bLen < 1e-6) {
        out.push({ x: cur.x + n1x * dist, y: cur.y + n1y * dist });
        continue;
      }
      const moveDist = dist / (bLen / 2);
      out.push({ x: cur.x + (bx / bLen) * moveDist, y: cur.y + (by / bLen) * moveDist });
    }
    return out;
  }

  function polygonBBox(polygon) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of polygon) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    return { minX, maxX, minY, maxY, w: maxX - minX, h: maxY - minY };
  }

  function closestPointOnPolygon(px, py, polygon) {
    let best = Infinity, bx = px, by = py;
    const n = polygon.length;
    for (let i = 0; i < n; i++) {
      const a = polygon[i], b = polygon[(i + 1) % n];
      const dx = b.x - a.x, dy = b.y - a.y;
      const len2 = dx * dx + dy * dy || 1e-9;
      const t = Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / len2));
      const cx = a.x + dx * t, cy = a.y + dy * t;
      const d = Math.hypot(px - cx, py - cy);
      if (d < best) { best = d; bx = cx; by = cy; }
    }
    return { x: bx, y: by, dist: best };
  }

  function distToRiver(x, y, riverSegments) {
    if (!riverSegments || !riverSegments.length) return Infinity;
    let best = Infinity;
    for (const s of riverSegments) {
      const d = pointToSegmentDist(x, y, s.a, s.b);
      if (d < best) best = d;
    }
    return best;
  }

  function riverToRiverDistance(a, b) {
    if (!a || !b || !a.segments || !b.segments) return Infinity;
    let best = Infinity;
    for (const sa of a.segments) {
      for (const sb of b.segments) {
        best = Math.min(best, segmentToSegmentDist(sa.a, sa.b, sb.a, sb.b));
      }
    }
    return best;
  }

  window.CityMapGeometryV3 = {
    EPS,
    segIntersect,
    pointInPolygon,
    polygonArea,
    polygonCentroid,
    pointToSegmentDist,
    pointToPolygonSignedDist,
    polylabel,
    segmentToSegmentDist,
    polygonToPolygonDist,
    clipPolygonToRect,
    insetPolygon,
    polygonBBox,
    closestPointOnPolygon,
    distToRiver,
    riverToRiverDistance
  };
})();
