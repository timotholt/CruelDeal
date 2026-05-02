(function () {
  "use strict";

  const { VIEW_W, VIEW_H } = window.CityMapConfigV3;
  const { clipPolygonToRect } = window.CityMapGeometryV3;

  function straightPolylinePath(points) {
    if (!points || points.length === 0) return "";
    let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
    for (let i = 1; i < points.length; i++) {
      d += ` L ${points[i].x.toFixed(2)} ${points[i].y.toFixed(2)}`;
    }
    return d;
  }

  function smoothPolylinePath(points) {
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

  function smoothClosedPath(points) {
    if (!points || points.length === 0) return "";
    if (points.length < 3) return straightPolylinePath(points);
    const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    const n = points.length;
    const start = mid(points[n - 1], points[0]);
    let d = `M ${start.x.toFixed(2)} ${start.y.toFixed(2)}`;
    for (let i = 0; i < n; i++) {
      const p = points[i];
      const next = points[(i + 1) % n];
      const m = mid(p, next);
      d += ` Q ${p.x.toFixed(2)} ${p.y.toFixed(2)} ${m.x.toFixed(2)} ${m.y.toFixed(2)}`;
    }
    return d + " Z";
  }

  function samplesToSegments(samples) {
    const segs = [];
    for (let i = 0; i < samples.length - 1; i++) {
      segs.push({ a: samples[i], b: samples[i + 1] });
    }
    return segs;
  }

  function sampleSmoothPolyline(pts, stepsPerSeg) {
    const samples = [];
    const k = pts.length - 1;
    if (k < 1) {
      if (pts.length === 1) samples.push({ x: pts[0].x, y: pts[0].y });
      return samplesToSegments(samples);
    }
    if (k === 1) {
      samples.push({ x: pts[0].x, y: pts[0].y });
      samples.push({ x: pts[1].x, y: pts[1].y });
      return samplesToSegments(samples);
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
    return samplesToSegments(samples);
  }

  function cutSegments(cut) {
    if (!cut.polyline || cut.polyline.length < 2) return [{ a: cut.p1, b: cut.p2 }];
    if (cut.polylineMode === "jog") return samplesToSegments(cut.polyline);
    return sampleSmoothPolyline(cut.polyline, 8);
  }

  function cutPath(cut) {
    if (!cut.polyline) return "";
    return cut.polylineMode === "jog"
      ? straightPolylinePath(cut.polyline)
      : smoothPolylinePath(cut.polyline);
  }

  function cutPoints(cut) {
    return cut.polyline && cut.polyline.length >= 2
      ? cut.polyline
      : [cut.p1, cut.p2];
  }

  function offsetPolyline(points, dist) {
    if (!points || points.length < 2) return points || [];
    const normals = [];
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i], b = points[i + 1];
      const dx = b.x - a.x, dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      normals.push({ x: -dy / len, y: dx / len });
    }
    return points.map((p, i) => {
      const n1 = normals[Math.max(0, i - 1)];
      const n2 = normals[Math.min(normals.length - 1, i)];
      const nx = n1.x + n2.x, ny = n1.y + n2.y;
      const nLen = Math.hypot(nx, ny) || 1;
      return { x: p.x + (nx / nLen) * dist, y: p.y + (ny / nLen) * dist };
    });
  }

  function polygonToPath(polygon) {
    const n = polygon.length;
    if (n === 0) return "";
    const isRoadEdge = (i) => (
      polygon[i].edgeKind === "road" ||
      polygon[i].edgeKind === "roadMid" ||
      polygon[i].edgeKind === "roadBend"
    );
    const isCurveMid = (i) => (polygon[i].edgeKind === "roadMid");

    let d = `M ${polygon[0].x.toFixed(2)} ${polygon[0].y.toFixed(2)}`;
    let i = 0;
    while (i < n) {
      if (isRoadEdge(i)) {
        let j = i + 1;
        let runHasMid = isCurveMid(i);
        while (j < n && isRoadEdge(j)) {
          if (isCurveMid(j)) runHasMid = true;
          j++;
        }
        const term = polygon[j % n];
        if (runHasMid) {
          const roadPoints = [];
          for (let k = i; k < j; k++) roadPoints.push(polygon[k]);
          roadPoints.push(term);
          const sub = smoothPolylinePath(roadPoints);
          d += " " + sub.replace(/^M\s+[\d.\-]+\s+[\d.\-]+\s*/, "");
        } else {
          for (let k = i + 1; k < j; k++) {
            d += ` L ${polygon[k].x.toFixed(2)} ${polygon[k].y.toFixed(2)}`;
          }
          d += ` L ${term.x.toFixed(2)} ${term.y.toFixed(2)}`;
        }
        i = j;
      } else {
        const next = (i + 1) % n;
        d += ` L ${polygon[next].x.toFixed(2)} ${polygon[next].y.toFixed(2)}`;
        i++;
      }
    }
    return d + " Z";
  }

  function polygonOutlinePathSkipRoads(polygon) {
    const n = polygon.length;
    if (n === 0) return "";
    const isRoad = (i) => (
      polygon[i].edgeKind === "road" ||
      polygon[i].edgeKind === "roadMid" ||
      polygon[i].edgeKind === "roadBend"
    );

    let d = "";
    let penDown = false;
    for (let i = 0; i < n; i++) {
      if (isRoad(i)) {
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

  function polygonOutlinePathClippedToViewport(polygon, viewportInset = 1) {
    const rect = {
      minX: viewportInset, minY: viewportInset,
      maxX: VIEW_W - viewportInset, maxY: VIEW_H - viewportInset
    };
    const clipped = clipPolygonToRect(polygon, rect);
    const n = clipped.length;
    if (n < 2) return "";
    let d = `M ${clipped[0].x.toFixed(2)} ${clipped[0].y.toFixed(2)}`;
    for (let i = 1; i < n; i++) {
      d += ` L ${clipped[i].x.toFixed(2)} ${clipped[i].y.toFixed(2)}`;
    }
    return d + " Z";
  }

  function rectPolygon(cx, cy, w, h, angle) {
    const ca = Math.cos(angle), sa = Math.sin(angle);
    return [
      { x: -w / 2, y: -h / 2 },
      { x:  w / 2, y: -h / 2 },
      { x:  w / 2, y:  h / 2 },
      { x: -w / 2, y:  h / 2 }
    ].map(p => ({
      x: cx + p.x * ca - p.y * sa,
      y: cy + p.x * sa + p.y * ca
    }));
  }

  function rectPath(cx, cy, w, h, angle) {
    return polygonToPath(rectPolygon(cx, cy, w, h, angle));
  }

  window.CityMapPathsV3 = {
    polygonToPath,
    polygonOutlinePathSkipRoads,
    polygonOutlinePathClippedToViewport,
    cutSegments,
    sampleSmoothPolyline,
    samplesToSegments,
    smoothPolylinePath,
    smoothClosedPath,
    straightPolylinePath,
    cutPath,
    cutPoints,
    offsetPolyline,
    rectPolygon,
    rectPath
  };
})();
