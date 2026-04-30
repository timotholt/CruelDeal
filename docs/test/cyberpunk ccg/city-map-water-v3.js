(function () {
  "use strict";

  const {
    pointInPolygon,
    riverToRiverDistance
  } = window.CityMapGeometryV3;

  const {
    sampleSmoothPolyline,
    smoothPolylinePath,
    offsetPolyline
  } = window.CityMapPathsV3;

  function generateRiver(landPolygon, rng) {
    const n = landPolygon.length;
    const i1 = Math.floor(rng() * n);
    const offset = Math.floor(n * 0.4 + rng() * n * 0.2);
    const i2 = (i1 + offset) % n;

    const segIdx = (idx) => {
      const a = landPolygon[idx];
      const b = landPolygon[(idx + 1) % n];
      const t = 0.2 + rng() * 0.6;
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    };
    const start = segIdx(i1);
    const end = segIdx(i2);

    const numCtrlSegs = 6;
    const dx = end.x - start.x, dy = end.y - start.y;
    const len = Math.hypot(dx, dy) || 1;
    const perpX = -dy / len, perpY = dx / len;

    const pts = [start];
    for (let i = 1; i < numCtrlSegs; i++) {
      const t = i / numCtrlSegs;
      const baseX = start.x + dx * t;
      const baseY = start.y + dy * t;
      const taper = Math.sin(t * Math.PI);
      const meander = (rng() - 0.5) * len * 0.22 * taper;
      pts.push({ x: baseX + perpX * meander, y: baseY + perpY * meander });
    }
    pts.push(end);

    const segments = sampleSmoothPolyline(pts, 10);
    const widthScale = 0.55 + rng() * 1.05;
    const outerWidth = 7 * widthScale;
    const innerWidth = 3.5 * widthScale;
    const buildingBuffer = 7 * widthScale;

    return {
      path: smoothPolylinePath(pts),
      segments,
      pts,
      widthScale,
      outerWidth,
      innerWidth,
      buildingBuffer
    };
  }

  function makeRiverBankRoads(river, landPolygon) {
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
      const pts = offsetPolyline(basePts, side * offset);
      let run = [];
      for (const p of pts) {
        if (pointInPolygon(p, landPolygon)) {
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

  function makeLakeBankRoads(lake, landPolygon) {
    if (!lake || !lake.polygon || lake.polygon.length < 3) return [];
    const centroid = lake.centroid || lake.polygon.reduce((sum, p) => ({
      x: sum.x + p.x / lake.polygon.length,
      y: sum.y + p.y / lake.polygon.length
    }), { x: 0, y: 0 });
    const offset = 4.2;
    const pts = lake.polygon.map(p => {
      const dx = p.x - centroid.x;
      const dy = p.y - centroid.y;
      const len = Math.hypot(dx, dy) || 1;
      return { x: p.x + (dx / len) * offset, y: p.y + (dy / len) * offset };
    });
    if (pts.some(p => !pointInPolygon(p, landPolygon))) return [];
    return [{
      p1: pts[0],
      p2: pts[0],
      polyline: [...pts, pts[0]],
      polylineMode: "lake-bank",
      depth: 3,
      angle: 0,
      riverBank: true,
      lakeBank: true
    }];
  }

  function generateRivers(landPolygon, rng) {
    const river1 = rng() < 0.6 ? generateRiver(landPolygon, rng) : null;
    let river2 = null;
    if (river1 && rng() < 0.5) {
      let bestRiver = null;
      let bestDist = -Infinity;
      for (let attempt = 0; attempt < 8; attempt++) {
        const candidate = generateRiver(landPolygon, rng);
        const d = riverToRiverDistance(river1, candidate);
        if (d > bestDist) { bestDist = d; bestRiver = candidate; }
        if (d > 46) break;
      }
      river2 = bestDist > 28 ? bestRiver : null;
    }
    if (river1 && river2) {
      return {
        path: river1.path + " " + river2.path,
        segments: [...river1.segments, ...river2.segments],
        pts: river1.pts,
        widthScale: river1.widthScale,
        outerWidth: river1.outerWidth,
        innerWidth: river1.innerWidth,
        buildingBuffer: Math.max(river1.buildingBuffer, river2.buildingBuffer)
      };
    }
    return river1;
  }

  window.CityMapWaterV3 = {
    generateRiver,
    makeRiverBankRoads,
    makeLakeBankRoads,
    generateRivers
  };
})();
