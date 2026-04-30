(function () {
  "use strict";

  const { VIEW_W, VIEW_H } = window.CityMapConfigV3;
  const {
    segIntersect: _segIntersect,
    pointInPolygon: _pointInPolygon,
    distToRiver: _distToRiver
  } = window.CityMapGeometryV3;
  const {
    cutSegments: _cutSegments
  } = window.CityMapPathsV3;
  const {
    truncateCutAtRiver: _truncateCutAtRiver
  } = window.CityMapPartitionV3;

  function generateBridges({ allCuts, river, riverSegments, coastRoadPolygon, landPolygon }) {
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
    bridges.push({
      x: crHit.x,
      y: crHit.y,
      angle: segAngle,
      roadAngle: segAngle,
      depth: 1,
      riverMouth: true
    });
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


    return { bridges, renderedCuts };
  }

  window.CityMapBridgesV3 = {
    generateBridges
  };
})();
