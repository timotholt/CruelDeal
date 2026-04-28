(function () {
  "use strict";

  const {
    VIEW_W,
    VIEW_H,
    MAP_SLOT_HALF_W,
    MAP_SLOT_HALF_H,
    MAP_SLOT_EDGE_PAD,
    DISTRICT_SHORT_NAMES
  } = window.CityMapConfigV3;

  const {
    pointInPolygon,
    polygonCentroid,
    pointToSegmentDist,
    clipPolygonToRect,
    polylabel
  } = window.CityMapGeometryV3;

  function labelMetrics(text) {
    return {
      halfW: Math.min(62, Math.max(24, text.length * 4.9)),
      halfH: 8
    };
  }

  function labelPosition(polygon, landmarks, labelText = "", dots = []) {
    const margin = 24;
    const visible = clipPolygonToRect(polygon, {
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

    let cnt = 0, cSumX = 0, cSumY = 0;
    for (let x = minX; x <= maxX; x += 4) {
      for (let y = minY; y <= maxY; y += 4) {
        if (!pointInPolygon({ x, y }, visible)) continue;
        let inLm = false;
        for (const lm of lms) {
          if (pointInPolygon({ x, y }, lm.polygon)) { inLm = true; break; }
        }
        if (inLm) continue;
        cSumX += x; cSumY += y; cnt++;
      }
    }
    const centroidX = cnt > 0 ? cSumX / cnt : (minX + maxX) / 2;
    const centroidY = cnt > 0 ? cSumY / cnt : (minY + maxY) / 2;
    const visualCenter = polylabel(visible, 1.2, { x: VIEW_W / 2, y: VIEW_H / 2 });
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
        if (!pointInPolygon(p, visible)) return false;
        for (const lm of lms) {
          if (pointInPolygon(p, lm.polygon)) return false;
        }
      }
      return true;
    };

    const shortText = DISTRICT_SHORT_NAMES[labelText] || labelText.slice(0, Math.min(4, labelText.length));
    const textOptions = [labelText, shortText].filter((t, i, a) => t && a.indexOf(t) === i);
    let globalBest = null;

    for (const text of textOptions) {
      const { halfW: labelHalfW, halfH: labelHalfH } = labelMetrics(text);
      if (labelBoxFits(targetX, targetY, labelHalfW, labelHalfH)) {
        return { x: targetX, y: targetY, text, score: Infinity, hardFit: true, halfW: labelHalfW, halfH: labelHalfH };
      }
      let best = null;
      const step = 3;
      for (let x = minX; x <= maxX; x += step) {
        for (let y = minY; y <= maxY; y += step) {
          if (!pointInPolygon({ x, y }, visible)) continue;
          let inLm = false;
          for (const lm of lms) {
            if (pointInPolygon({ x, y }, lm.polygon)) { inLm = true; break; }
          }
          if (inLm) continue;
          const boxFits = labelBoxFits(x, y, labelHalfW, labelHalfH);

          let edgeDist = Infinity;
          for (let i = 0; i < visible.length; i++) {
            const a = visible[i];
            const b = visible[(i + 1) % visible.length];
            const d = pointToSegmentDist(x, y, a, b);
            if (d < edgeDist) edgeDist = d;
          }
          for (const lm of lms) {
            for (let i = 0; i < lm.polygon.length; i++) {
              const a = lm.polygon[i];
              const b = lm.polygon[(i + 1) % lm.polygon.length];
              const d = pointToSegmentDist(x, y, a, b);
              if (d < edgeDist) edgeDist = d;
            }
          }

          let dotDist = Infinity;
          for (const dot of dots || []) {
            dotDist = Math.min(dotDist, rectDotDistance(x, y, labelHalfW + 10, labelHalfH + 10, dot));
          }
          const dotsClear = dotDist > 24;
          const centroidDist = Math.hypot(x - targetX, y - targetY);
          const bboxCenterDist = Math.hypot(x - bboxCenterX, y - bboxCenterY);

          const boxPenalty = boxFits ? 0 : 48;
          const dotPenalty = dotsClear ? 0 : (24 - dotDist) * 2.6 + 32;
          const clearanceScore = Math.min(edgeDist, 30);
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
    return globalBest || { x: targetX, y: targetY, text: labelText, ...labelMetrics(labelText || "") };
  }

  function viewportVisibleArea(polygon) {
    const step = 6;
    let count = 0;
    for (let x = step / 2; x < VIEW_W; x += step) {
      for (let y = step / 2; y < VIEW_H; y += step) {
        if (pointInPolygon({ x, y }, polygon)) count++;
      }
    }
    return count * step * step;
  }

  function slotCountsByRank(visAreas, rng) {
    const indexed = visAreas.map((a, i) => ({ a, i }));
    indexed.sort((x, y) => x.a - y.a);
    const midPairs = rng() < 0.5 ? 3 : 4;
    const pairsByRank = [2, midPairs, 5];
    const result = new Array(visAreas.length);
    indexed.forEach((item, rank) => { result[item.i] = pairsByRank[rank] * 2; });
    return result;
  }

  function placeDotsInPolygon(polygon, rng, leafBlocksToAvoid, target, visibleArea, labelAvoid = null) {
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

    const area = Math.max(1, visibleArea || ((maxX - minX) * (maxY - minY)));
    const idealSpacing = Math.sqrt(area / Math.max(1, target)) * 0.92;

    const insideBlocked = (x, y) => {
      if (!pointInPolygon({ x, y }, polygon)) return true;
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
        if (pointInPolygon({ x, y }, lb.polygon)) return true;
      }
      return false;
    };
    const edgeDistance = (x, y) => {
      let best = Math.min(x, y, VIEW_W - x, VIEW_H - y);
      for (let k = 0; k < polygon.length; k++) {
        const a = polygon[k];
        const b = polygon[(k + 1) % polygon.length];
        best = Math.min(best, pointToSegmentDist(x, y, a, b));
      }
      return best;
    };

    const centroid = polygonCentroid(polygon);
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

    if (placed.length < 2) return placed;

    const HARD_MIN_EDGE = PLACEMENT_RING_SAFE_EDGE;
    const ITERATIONS = 10;
    const stepScale = 0.28;
    const EDGE_BUFFER = HARD_MIN_EDGE + 8;
    const DOT_REPEL_SPACING = idealSpacing * 0.58;
    for (let iter = 0; iter < ITERATIONS; iter++) {
      for (let i = 0; i < placed.length; i++) {
        let fx = 0, fy = 0;
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
            const f = (EDGE_BUFFER - d) / EDGE_BUFFER * 1.75;
            fx += (dx / d) * f;
            fy += (dy / d) * f;
          }
        }
        const newX = placed[i].x + fx * stepScale;
        const newY = placed[i].y + fy * stepScale;
        if (!insideBlocked(newX, newY) && edgeDistance(newX, newY) >= HARD_MIN_EDGE) {
          placed[i].x = Math.max(minX, Math.min(maxX, newX));
          placed[i].y = Math.max(minY, Math.min(maxY, newY));
        }
      }
    }

    const FIXUP_PASSES = 4;
    for (let pass = 0; pass < FIXUP_PASSES; pass++) {
      let allClear = true;
      for (let i = 0; i < placed.length; i++) {
        let nearestD = Infinity;
        let nearestNX = 0, nearestNY = 0;
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

  window.CityMapPlacementV3 = {
    labelMetrics,
    labelPosition,
    viewportVisibleArea,
    slotCountsByRank,
    placeDotsInPolygon
  };
})();
