(function () {
  "use strict";

  const { VIEW_W, VIEW_H } = window.CityMapConfigV3;
  const { pointInPolygon, polygonCentroid, polygonBBox, pointToSegmentDist } = window.CityMapGeometryV3;
  const { rectPolygon, polygonToPath } = window.CityMapPathsV3;

  function generateLandPolygon(rng) {
    const modeRoll = rng();
    const exposedMode = modeRoll < 0.35;
    const fjordMode = !exposedMode && modeRoll < 0.60;

    const N = 40;
    const phaseA = rng() * Math.PI * 2;
    const phaseB = rng() * Math.PI * 2;
    const phaseC = rng() * Math.PI * 2;
    const phaseD = rng() * Math.PI * 2;

    const biteCount = 2 + Math.floor(rng() * 3);
    const biteAngles = [];
    for (let b = 0; b < biteCount; b++) biteAngles.push(rng() * Math.PI * 2);
    const biteDepths = biteAngles.map(() => 0.08 + rng() * 0.12);
    const biteWidths = biteAngles.map(() => 0.9 + rng() * 0.8);

    const fjordAngle = rng() * Math.PI * 2;
    const fjordDepth = 0.28 + rng() * 0.18;
    const fjordWidth = 0.55 + rng() * 0.30;

    const distToViewportEdge = (cx, cy, dx, dy) => {
      const tx = dx > 0 ? (VIEW_W - cx) / dx : (dx < 0 ? -cx / dx : 1e9);
      const ty = dy > 0 ? (VIEW_H - cy) / dy : (dy < 0 ? -cy / dy : 1e9);
      return Math.min(Math.abs(tx), Math.abs(ty));
    };

    const harborBiteTotal = (angle) => {
      let sum = 0;
      for (let b = 0; b < biteCount; b++) {
        const c = Math.cos(angle - biteAngles[b]);
        sum -= biteDepths[b] * Math.max(0, Math.pow(Math.max(0, c), biteWidths[b]));
      }
      if (fjordMode) {
        const fc = Math.cos(angle - fjordAngle);
        sum -= fjordDepth * Math.max(0, Math.pow(Math.max(0, fc), fjordWidth * 2.5));
      }
      return sum;
    };

    if (exposedMode) {
      const exposeAngle = rng() * Math.PI * 2;
      const cx = VIEW_W / 2 + (rng() - 0.5) * 30;
      const cy = VIEW_H / 2 + (rng() - 0.5) * 30;
      const verts = [];
      for (let i = 0; i < N; i++) {
        const angle = (i / N) * Math.PI * 2 + (rng() - 0.5) * 0.22;
        const dx = Math.cos(angle), dy = Math.sin(angle);
        const dEdge = distToViewportEdge(cx, cy, dx, dy);
        const cosToExpose = Math.cos(angle - exposeAngle);
        const directional = 1.0 - 0.28 * cosToExpose;
        const bites = harborBiteTotal(angle);
        const r1 = 0.10 * Math.cos(angle * 1 + phaseA);
        const r2 = 0.07 * Math.cos(angle * 3 + phaseB);
        const r3 = 0.04 * Math.cos(angle * 6 + phaseC);
        const r4 = 0.022 * Math.cos(angle * 11 + phaseD);
        const jitter = (rng() - 0.5) * 0.10;
        const k = Math.max(0.42, directional + bites + r1 + r2 + r3 + r4 + jitter);
        verts.push({ x: cx + dx * dEdge * k, y: cy + dy * dEdge * k, edgeKind: "coast" });
      }
      return verts;
    }

    const cx = VIEW_W / 2 + (rng() - 0.5) * 35;
    const cy = VIEW_H / 2 + (rng() - 0.5) * 35;
    const verts = [];
    for (let i = 0; i < N; i++) {
      const angle = (i / N) * Math.PI * 2 + (rng() - 0.5) * 0.22;
      const dx = Math.cos(angle), dy = Math.sin(angle);
      const dEdge = distToViewportEdge(cx, cy, dx, dy);
      const bites = harborBiteTotal(angle);
      const r1 = 0.12 * Math.cos(angle * 1 + phaseA);
      const r2 = 0.08 * Math.cos(angle * 3 + phaseB);
      const r3 = 0.045 * Math.cos(angle * 6 + phaseC);
      const r4 = 0.024 * Math.cos(angle * 11 + phaseD);
      const jitter = (rng() - 0.5) * 0.10;
      const k = Math.max(0.42, 1.02 + bites + r1 + r2 + r3 + r4 + jitter);
      verts.push({
        x: cx + dx * dEdge * k,
        y: cy + dy * dEdge * k,
        edgeKind: "coast"
      });
    }
    return verts;
  }

  function generateCoastDocks(landPolygon, rng, riverSegments = []) {
    const docks = [];
    const dockBBoxes = [];
    const centroid = polygonCentroid(landPolygon);
    const n = landPolygon.length;
    const overlapsDock = (box) => dockBBoxes.some(b =>
      box.maxX + 1.2 > b.minX && box.minX - 1.2 < b.maxX &&
      box.maxY + 1.2 > b.minY && box.minY - 1.2 < b.maxY
    );
    for (let i = 0; i < n; i++) {
      const a = landPolygon[i];
      const b = landPolygon[(i + 1) % n];
      const dx = b.x - a.x, dy = b.y - a.y;
      const segLen = Math.hypot(dx, dy);
      if (segLen < 28) continue;
      const tx = dx / segLen, ty = dy / segLen;
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      if (mx < -8 || mx > VIEW_W + 8 || my < -8 || my > VIEW_H + 8) continue;

      const p1x = -ty, p1y = tx;
      const awayX = mx - centroid.x, awayY = my - centroid.y;
      const outward = (p1x * awayX + p1y * awayY) > 0
        ? { x: p1x, y: p1y }
        : { x: -p1x, y: -p1y };

      const oceanProbe = {
        x: mx + outward.x * 8,
        y: my + outward.y * 8
      };
      if (pointInPolygon(oceanProbe, landPolygon)) continue;

      const clusterCount = rng() < 0.58 ? 1 : 2;
      for (let cluster = 0; cluster < clusterCount; cluster++) {
        if (rng() < 0.30) continue;
        const clusterT = 0.18 + rng() * 0.64;
        const longTwin = rng() < 0.18 && segLen > 36;
        const dockCount = longTwin ? 2 : 3 + Math.floor(rng() * 3);
        const pierW = longTwin ? 2.4 : 3.4;
        const pierLen = longTwin ? 17.5 : 11.4;
        const spacing = longTwin ? 4.7 : 5.4;
        const clusterWidth = spacing * (dockCount - 1);
        const angle = Math.atan2(outward.y, outward.x) + Math.PI / 2;
        const candidate = [];
        const pierHitsRiver = (poly) => riverSegments.some(seg =>
          poly.some(p => pointToSegmentDist(p.x, p.y, seg.a, seg.b) < 13)
        );
        for (let k = 0; k < dockCount; k++) {
          const along = (k - (dockCount - 1) / 2) * spacing;
          const t = clusterT + along / segLen;
          if (t < 0.08 || t > 0.92) continue;
          const baseX = a.x + dx * t;
          const baseY = a.y + dy * t;
          if (clusterWidth > segLen * 0.55) continue;
          const cx = baseX + outward.x * (pierLen / 2 - 2.4);
          const cy = baseY + outward.y * (pierLen / 2 - 2.4);
          if (cx < -4 || cx > VIEW_W + 4 || cy < -4 || cy > VIEW_H + 4) continue;
          const poly = rectPolygon(cx, cy, pierW, pierLen, angle);
          if (pierHitsRiver(poly)) continue;
          const box = polygonBBox(poly);
          if (overlapsDock(box)) continue;
          candidate.push({ path: polygonToPath(poly), polygon: poly, box });
        }
        if (candidate.length < 2) continue;
        for (const dock of candidate) {
          docks.push({ path: dock.path, polygon: dock.polygon });
          dockBBoxes.push(dock.box);
        }
      }
    }
    return docks;
  }

  window.CityMapLandV3 = {
    generateLandPolygon,
    generateCoastDocks
  };
})();
