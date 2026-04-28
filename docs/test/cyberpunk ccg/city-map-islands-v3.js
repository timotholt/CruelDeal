(function () {
  "use strict";

  const { VIEW_W, VIEW_H } = window.CityMapConfigV3;
  const {
    pointInPolygon: _pointInPolygon,
    polygonArea: _polygonArea,
    pointToSegmentDist: _pointToSegmentDist,
    polygonToPolygonDist: _polygonToPolygonDist,
    closestPointOnPolygon: _closestPointOnPolygon
  } = window.CityMapGeometryV3;
  const {
    smoothClosedPath: _smoothClosedPath
  } = window.CityMapPathsV3;
  const {
    viewportVisibleArea: _viewportVisibleArea
  } = window.CityMapPlacementV3;
  const {
    tryGridCut: _tryGridCut
  } = window.CityMapPartitionV3;
  const {
    generateBlockBuildings: _generateBlockBuildings
  } = window.CityMapBuildingsV3;
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


  window.CityMapIslandsV3 = {
    generateIslands: _generateIslands
  };
})();
