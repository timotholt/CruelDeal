(function () {
  "use strict";

  const {
    VIEW_W,
    VIEW_H,
    DISTRICT_NAMES,
    DISTRICT_COLORS,
    MAP_SLOT_HALF_W,
    MAP_SLOT_HALF_H
  } = window.CityMapConfigV3;
  const {
    polygonArea,
    polygonCentroid,
    polygonBBox,
    pointInPolygon,
    pointToSegmentDist,
    polylabel,
    closestPointOnPolygon,
    distToRiver,
    segIntersect
  } = window.CityMapGeometryV3;
  const {
    polygonToPath,
    polygonOutlinePathClippedToViewport,
    smoothClosedPath,
    cutPath,
    rectPolygon
  } = window.CityMapPathsV3;
  const {
    macroDivide3,
    splitPolygonByLine,
    tryGridCut,
    bspSubdivide,
    collectAllCuts,
    leavesUnder,
    truncateCutAtRiver
  } = window.CityMapPartitionV3;

  const CACHE_LIMIT = 12;
  const cache = new Map();

  // ── Utilities ────────────────────────────────────────────────

  function normalizeSeed(seed) {
    return Number.isFinite(seed) ? (seed >>> 0) || 1 : 1;
  }

  function remember(key, value) {
    if (cache.has(key)) cache.delete(key);
    cache.set(key, value);
    while (cache.size > CACHE_LIMIT) {
      const oldest = cache.keys().next().value;
      cache.delete(oldest);
    }
    return value;
  }

  function shuffle(items, rng) {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  // ── Water helpers ────────────────────────────────────────────

  function waterBodiesOfKind(terrain, kind) {
    return (terrain.waterBodies || []).filter(body => body.kind === kind);
  }

  // All water boundary segments for road truncation: river segments + lake polygon edges.
  function allWaterSegments(terrain) {
    const segs = [];
    for (const body of terrain.waterBodies || []) {
      if (body.kind === "river" && body.segments) {
        for (const s of body.segments) segs.push(s);
      } else if (body.kind === "lake" && body.polygon) {
        const poly = body.polygon;
        for (let i = 0; i < poly.length; i++) {
          segs.push({ a: poly[i], b: poly[(i + 1) % poly.length] });
        }
      }
    }
    return segs;
  }

  // ── Spine system ─────────────────────────────────────────────
  // A "spine" is a major linear feature — either a terrain river or a generated
  // highway — that divides land into regions and anchors each region's street
  // grid orientation. This is how real cities form: SF's grid follows the bay
  // shore and Market Street; Chicago's grid follows the lake and the river.

  function toSegments(points) {
    const segs = [];
    for (let i = 0; i + 1 < points.length; i++) segs.push({ a: points[i], b: points[i + 1] });
    return segs;
  }

  // Find all intersections of the extended line through (p1, p2) with polygon edges.
  // p1 and p2 must be far from the polygon (use HUGE=4000 offsets) so that t∈[0,1]
  // for all polygon crossings. Returns hits sorted by t (position along p1→p2).
  function linePolygonHits(p1, p2, polygon) {
    const hits = [];
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i], b = polygon[(i + 1) % polygon.length];
      const hit = segIntersect(p1, p2, a, b);
      if (hit) hits.push({ x: hit.x, y: hit.y, t: hit.t, u: hit.u, edgeIdx: i });
    }
    hits.sort((a, b) => a.t - b.t);
    return hits;
  }

  // Build a river spine from terrain. River pts[0] and pts[last] are already
  // on the land polygon boundary (placed there by the river generator).
  function riverSpineFromTerrain(terrain, landPolygon) {
    const rivers = waterBodiesOfKind(terrain, "river");
    if (!rivers.length) return null;
    const river = rivers[0];
    const pts = river.pts;
    if (!pts || pts.length < 2) return null;

    const entry = pts[0];
    const exit = pts[pts.length - 1];
    const dominantAngle = Math.atan2(exit.y - entry.y, exit.x - entry.x);
    // Only keep interior mids that are actually inside the land polygon
    const interiorMids = pts.slice(1, -1).filter(p => pointInPolygon(p, landPolygon));
    const polyline = [entry, ...interiorMids, exit];

    return {
      kind: "river",
      entry, exit, interiorMids, polyline,
      segments: toSegments(polyline),
      dominantAngle
    };
  }

  // True segment-segment intersection check (not infinite-line).
  // Returns true if segment a→b crosses any edge of any lake polygon,
  // or if either endpoint is inside a lake.
  function segHitsLake(a, b, lakes) {
    for (const lake of lakes) {
      if (!lake.polygon) continue;
      if (pointInPolygon(a, lake.polygon) || pointInPolygon(b, lake.polygon)) return true;
      const poly = lake.polygon;
      for (let i = 0; i < poly.length; i++) {
        if (segIntersect(a, b, poly[i], poly[(i + 1) % poly.length])) return true;
      }
    }
    return false;
  }

  // Generate a highway spine — a major road crossing land at a distinctive angle,
  // optionally with one bend (like Market Street through SF).
  // Primary spine (no existing spines) is biased near-horizontal so the map feels
  // oriented. Secondary spines are noticeably diagonal for visual contrast.
  function generateHighwaySpine(landPolygon, existingSpines, rng, lakes = []) {
    const bbox = polygonBBox(landPolygon);
    const HUGE = 4000;

    for (let attempt = 0; attempt < 60; attempt++) {
      let angle;
      if (existingSpines.length > 0) {
        // Secondary spine: meaningfully diagonal vs the first (25–65° offset)
        const base = existingSpines[0].dominantAngle;
        const off = Math.PI / 7.2 + rng() * (Math.PI / 2.8 - Math.PI / 7.2);
        angle = base + (rng() < 0.5 ? off : -off);
      } else {
        // Primary spine: biased near-horizontal (±25°) so humans can orient the map.
        // A slight tilt reads as a "civic diagonal" rather than a boring grid line.
        angle = (rng() - 0.5) * (Math.PI / 3.6); // ±25° centered on 0°
      }

      const ox = bbox.minX + bbox.w * (0.2 + rng() * 0.6);
      const oy = bbox.minY + bbox.h * (0.2 + rng() * 0.6);
      if (!pointInPolygon({ x: ox, y: oy }, landPolygon)) continue;

      const dx = Math.cos(angle), dy = Math.sin(angle);
      const p1 = { x: ox - dx * HUGE, y: oy - dy * HUGE };
      const p2 = { x: ox + dx * HUGE, y: oy + dy * HUGE };
      const hits = linePolygonHits(p1, p2, landPolygon).filter(h => h.u > 0.02 && h.u < 0.98);
      if (hits.length < 2) continue;

      const entry = hits[0], exit = hits[hits.length - 1];
      const spineLen = Math.hypot(exit.x - entry.x, exit.y - entry.y);
      if (spineLen < Math.min(bbox.w, bbox.h) * 0.38) continue;

      // Reject if the straight entry→exit line passes through a lake
      if (segHitsLake(entry, exit, lakes)) continue;

      // Optional bend (~72% of maps)
      let interiorMids = [];
      if (rng() < 0.72 && spineLen > 90) {
        const t = 0.28 + rng() * 0.44;
        const bx = entry.x + (exit.x - entry.x) * t;
        const by = entry.y + (exit.y - entry.y) * t;
        const amp = Math.min(58, spineLen * (0.09 + rng() * 0.16));
        const side = rng() < 0.5 ? 1 : -1;
        const bend = { x: bx + (-dy) * amp * side, y: by + dx * amp * side };
        // Bend must be in land AND not in a lake
        if (pointInPolygon(bend, landPolygon) &&
            !segHitsLake(entry, bend, lakes) &&
            !segHitsLake(bend, exit, lakes)) {
          interiorMids = [bend];
        }
      }

      const polyline = [entry, ...interiorMids, exit];
      return {
        kind: "highway",
        entry, exit, interiorMids, polyline,
        segments: toSegments(polyline),
        dominantAngle: angle
      };
    }
    return null;
  }

  // Build all spines for a map: river (if present) + at least one highway.
  function generateSpines(terrain, landPolygon, rng) {
    const spines = [];
    const lakes = waterBodiesOfKind(terrain, "lake");

    const rs = riverSpineFromTerrain(terrain, landPolygon);
    if (rs) spines.push(rs);

    const hw1 = generateHighwaySpine(landPolygon, spines, rng, lakes);
    if (hw1) spines.push(hw1);

    // Extra spine: likely on no-river maps, occasional on river maps
    const wantMore = (!rs && rng() < 0.55) || (rs && rng() < 0.22);
    if (wantMore && spines.length < 3) {
      const hw2 = generateHighwaySpine(landPolygon, spines, rng, lakes);
      if (hw2) spines.push(hw2);
    }

    return spines;
  }

  // Split a polygon along a spine. Uses the entry→exit direction (extended HUGE)
  // as the split line; interior mids shape the cut boundary.
  // Each half gets a grid angle: one parallel to spine, one 45° offset.
  // That angle difference is what produces SF-style triangular blocks at the boundary.
  function splitBySpine(polygon, spine, rng) {
    const dx = spine.exit.x - spine.entry.x;
    const dy = spine.exit.y - spine.entry.y;
    const len = Math.hypot(dx, dy) || 1;
    const HUGE = 4000;
    const L1 = { x: spine.entry.x - (dx / len) * HUGE, y: spine.entry.y - (dy / len) * HUGE };
    const L2 = { x: spine.exit.x + (dx / len) * HUGE, y: spine.exit.y + (dy / len) * HUGE };

    const mids = spine.interiorMids.length ? spine.interiorMids : null;
    // Rivers get smooth curves; highway bends get angular jogs
    const mode = spine.kind === "river" ? null : "jog";
    const result = splitPolygonByLine(polygon, L1, L2, mids, mode);
    if (!result) return null;

    const [half1, half2, cutSeg] = result;
    const base = spine.dominantAngle;
    const w = () => (rng() - 0.5) * 0.07;
    // 45° offset between halves → grids meet at an angle at the spine boundary
    const angle1 = base + w();
    const angle2 = base + Math.PI / 4 + w();

    return {
      half1, half2, angle1, angle2,
      cutSeg: {
        p1: spine.entry,
        p2: spine.exit,
        polyline: spine.polyline,
        polylineMode: mode,
        depth: 0,
        angle: spine.dominantAngle
      }
    };
  }

  // Divide land polygon by all spines. Each spine splits one region into two halves;
  // each half inherits a grid angle from the spine. Result: 2–3 regions with
  // distinct street orientations, naturally divided by terrain and infrastructure.
  function spineBasedDivide(landPolygon, spines, rng) {
    if (!spines.length) {
      return { regions: [landPolygon], regionAngles: [(rng() - 0.5) * 0.12], spineCuts: [] };
    }

    let pool = [{ polygon: landPolygon, angle: null }];
    const spineCuts = [];

    for (const spine of spines) {
      let splitIdx = -1, split = null;
      const mid = { x: (spine.entry.x + spine.exit.x) / 2, y: (spine.entry.y + spine.exit.y) / 2 };

      // Prefer the region that contains the spine's midpoint or entry
      for (let i = 0; i < pool.length && !split; i++) {
        if (pointInPolygon(mid, pool[i].polygon) || pointInPolygon(spine.entry, pool[i].polygon)) {
          split = splitBySpine(pool[i].polygon, spine, rng);
          if (split) splitIdx = i;
        }
      }
      // Fallback: try every region
      for (let i = 0; i < pool.length && !split; i++) {
        split = splitBySpine(pool[i].polygon, spine, rng);
        if (split) splitIdx = i;
      }

      if (!split) continue;
      pool.splice(splitIdx, 1,
        { polygon: split.half1, angle: split.angle1 },
        { polygon: split.half2, angle: split.angle2 }
      );
      spineCuts.push(split.cutSeg);
    }

    // Drop slivers; allow all regions through (enforceThreeDistricts will merge/split)
    pool = pool.filter(r => polygonArea(r.polygon) > 1800);
    pool.sort((a, b) => polygonArea(b.polygon) - polygonArea(a.polygon));
    if (!pool.length) return { regions: [landPolygon], regionAngles: [0], spineCuts: [] };

    return {
      regions: pool.map(r => r.polygon),
      regionAngles: pool.map(r => r.angle ?? 0),
      spineCuts
    };
  }

  // ── Enforce exactly 3 districts ─────────────────────────────
  // Golden Rule 1: always exactly 3 districts.
  //   • N > 3 → iteratively merge smallest into its nearest neighbor.
  //     Produces concave, irregular shapes (like real borough boundaries).
  //   • N < 3 → split the largest region until we reach 3.
  // Golden Rule 2: after settling at 3, sort by area and force the LARGEST
  //   district to an axis-aligned (0°) street grid — the Manhattan Rule.
  //   Players orient the map by the big rectilinear anchor; the smaller
  //   districts' diagonal/organic grids feel weird-and-interesting by contrast.

  // True if any vertex of polyA is within epsilon of any vertex of polyB.
  // Planar-subdivision regions that share a cut edge will always pass this.
  function regionsShareBoundary(polyA, polyB) {
    const EPS = 3;
    for (const a of polyA)
      for (const b of polyB)
        if (Math.hypot(a.x - b.x, a.y - b.y) < EPS) return true;
    return false;
  }

  // Merge two region entries. The larger polygon stays primary (drives the BSP
  // grid angle). The smaller polygon is stored in subPolygons so its area and
  // blocks are still generated — giving the merged district an L-shape or notch.
  function mergeTwo(rA, rB) {
    const aA = polygonArea(rA.polygon), aB = polygonArea(rB.polygon);
    const primary = aA >= aB ? rA : rB;
    const secondary = aA >= aB ? rB : rA;
    return {
      polygon:     primary.polygon,
      angle:       primary.angle,
      subPolygons: [
        ...(primary.subPolygons   || []),
        ...(secondary.subPolygons || [secondary.polygon])
      ]
    };
  }

  function enforceThreeDistricts(divided, rng, lakes = []) {
    const pool = divided.regions.map((polygon, i) => ({
      polygon,
      angle: divided.regionAngles[i] ?? 0,
      subPolygons: []
    }));
    const cuts = [...divided.spineCuts];

    // Total area of a pool entry (primary + any merged secondaries)
    const totalArea = r => polygonArea(r.polygon) +
      r.subPolygons.reduce((s, p) => s + polygonArea(p), 0);

    // ── Phase 1: merge-down ───────────────────────────────────
    while (pool.length > 3) {
      pool.sort((a, b) => totalArea(a) - totalArea(b));
      const smallest = pool[0];
      const sc = polygonCentroid(smallest.polygon);

      // Prefer a neighbor that actually shares a cut boundary, then nearest centroid
      let bestIdx = -1, bestScore = Infinity;
      for (let i = 1; i < pool.length; i++) {
        const c = polygonCentroid(pool[i].polygon);
        const dist = Math.hypot(c.x - sc.x, c.y - sc.y);
        const adj  = regionsShareBoundary(smallest.polygon, pool[i].polygon);
        const score = adj ? dist * 0.4 : dist;
        if (score < bestScore) { bestScore = score; bestIdx = i; }
      }
      if (bestIdx === -1) bestIdx = 1;

      const merged = mergeTwo(smallest, pool[bestIdx]);
      pool.splice(bestIdx, 1);
      pool.splice(0, 1);
      pool.push(merged);
    }

    // ── Phase 2: split-up ─────────────────────────────────────
    let safety = 0;
    while (pool.length < 3 && safety++ < 8) {
      pool.sort((a, b) => polygonArea(b.polygon) - polygonArea(a.polygon));
      const target = pool[0];

      const spine = generateHighwaySpine(target.polygon, [], rng, lakes);
      if (spine) {
        const split = splitBySpine(target.polygon, spine, rng);
        if (split) {
          pool.splice(0, 1,
            { polygon: split.half1, angle: split.angle1, subPolygons: [] },
            { polygon: split.half2, angle: split.angle2, subPolygons: [] }
          );
          cuts.push(split.cutSeg);
          continue;
        }
      }
      const fallback =
        tryGridCut(target.polygon, 0, false, 70, rng) ||
        tryGridCut(target.polygon, 0, true,  70, rng);
      if (fallback) {
        pool.splice(0, 1,
          { polygon: fallback.halfA, angle: (rng() - 0.5) * 0.08, subPolygons: [] },
          { polygon: fallback.halfB, angle: Math.PI / 4 + (rng() - 0.5) * 0.08, subPolygons: [] }
        );
        cuts.push({ ...fallback.cutSeg, depth: 1 });
        continue;
      }
      break;
    }

    // ── Phase 3: Manhattan Rule ───────────────────────────────
    // Sort largest-first, then snap the biggest district to axis-aligned.
    // A ±2° wobble keeps it from looking digitally perfect.
    pool.sort((a, b) => totalArea(b) - totalArea(a));
    pool[0].angle = 0; // perfectly horizontal/vertical — the civic anchor

    return {
      regions:           pool.map(r => r.polygon),
      regionAngles:      pool.map(r => r.angle),
      regionSubPolygons: pool.map(r => r.subPolygons),
      spineCuts:         cuts
    };
  }

  // ── City grammar ─────────────────────────────────────────────

  function pointInWater(point, terrain) {
    for (const body of terrain.waterBodies || []) {
      if (body.kind === "lake" && body.polygon && pointInPolygon(point, body.polygon)) return true;
      if (body.kind === "river" && body.segments &&
          distToRiver(point.x, point.y, body.segments) < (body.outerWidth || 8) * 0.5 + 3) return true;
    }
    return false;
  }

  function dryInteriorAnchor(polygon, terrain) {
    const centroid = polygonCentroid(polygon);
    const box = polygonBBox(polygon);
    const label = polylabel(polygon, 1.0, centroid);
    const candidates = [
      label,
      centroid,
      { x: box.minX + box.w * 0.24, y: box.minY + box.h * 0.24 },
      { x: box.minX + box.w * 0.76, y: box.minY + box.h * 0.24 },
      { x: box.minX + box.w * 0.24, y: box.minY + box.h * 0.76 },
      { x: box.minX + box.w * 0.76, y: box.minY + box.h * 0.76 },
      ...polygon.map(p => ({
        x: p.x + (centroid.x - p.x) * 0.22,
        y: p.y + (centroid.y - p.y) * 0.22
      }))
    ];
    let best = null;
    for (const point of candidates) {
      if (!pointInPolygon(point, polygon)) continue;
      if (pointInWater(point, terrain)) continue;
      const edge = polygonEdgeDistance(point, polygon);
      if (edge < 2.4) continue;
      const score = edge - Math.hypot(point.x - label.x, point.y - label.y) * 0.08;
      if (!best || score > best.score) best = { point, score };
    }
    return best ? best.point : null;
  }

  function pointToPolygonEdgeDistance(point, polygon) {
    let best = Infinity;
    for (let i = 0; i < polygon.length; i++) {
      best = Math.min(best, pointToSegmentDist(
        point.x, point.y,
        polygon[i], polygon[(i + 1) % polygon.length]
      ));
    }
    return best;
  }

  function polygonIntersectsPolygonEdges(aPoly, bPoly) {
    for (let i = 0; i < aPoly.length; i++) {
      const a1 = aPoly[i], a2 = aPoly[(i + 1) % aPoly.length];
      for (let j = 0; j < bPoly.length; j++) {
        if (segIntersect(a1, a2, bPoly[j], bPoly[(j + 1) % bPoly.length])) return true;
      }
    }
    return false;
  }

  function polygonTouchesWaterReserve(polygon, terrain) {
    const centroid = polygonCentroid(polygon);
    for (const body of terrain.waterBodies || []) {
      if (body.kind !== "lake" || !body.polygon) continue;
      const lakeRoadPad = 7.2;
      if (pointInPolygon(centroid, body.polygon)) return true;
      if (polygon.some(p => pointInPolygon(p, body.polygon))) return true;
      if (polygonIntersectsPolygonEdges(polygon, body.polygon)) return true;
      if (pointToPolygonEdgeDistance(centroid, body.polygon) < lakeRoadPad) return true;
      if (polygon.some(p => pointToPolygonEdgeDistance(p, body.polygon) < lakeRoadPad)) return true;
    }
    return false;
  }

  function ownedWaterPolygons(ownershipPolygon, terrain) {
    return waterBodiesOfKind(terrain, "lake")
      .filter(body => body.polygon && pointInPolygon(
        body.centroid || polygonCentroid(body.polygon), ownershipPolygon
      ))
      .map(body => ({
        id: body.id, kind: body.kind,
        polygon: body.polygon,
        path: body.path || polygonToPath(body.polygon)
      }));
  }

  function interiorPoint(polygon) {
    const centroid = polygonCentroid(polygon);
    if (pointInPolygon(centroid, polygon)) return centroid;
    const box = polygonBBox(polygon);
    const center = { x: box.minX + box.w / 2, y: box.minY + box.h / 2 };
    let best = null;
    for (let ix = 1; ix <= 5; ix++) {
      for (let iy = 1; iy <= 5; iy++) {
        const point = { x: box.minX + (box.w * ix) / 6, y: box.minY + (box.h * iy) / 6 };
        if (!pointInPolygon(point, polygon)) continue;
        const d = Math.hypot(point.x - center.x, point.y - center.y);
        if (!best || d < best.d) best = { point, d };
      }
    }
    return best ? best.point : centroid;
  }

  function slotPairsForArea(area) {
    if (area > 56000) return 5;
    if (area > 36000) return 4;
    if (area > 21000) return 3;
    return 2;
  }

  function slotPairsForDistrict(district) {
    if (district.landmassId !== "mainland") return 1;
    return slotPairsForArea(district.area);
  }

  function polygonEdgeDistance(point, polygon) {
    let best = Infinity;
    for (let i = 0; i < polygon.length; i++) {
      best = Math.min(best, pointToSegmentDist(
        point.x, point.y,
        polygon[i], polygon[(i + 1) % polygon.length]
      ));
    }
    return best;
  }

  function viewportEdgeDistance(point) {
    return Math.min(point.x, VIEW_W - point.x, point.y, VIEW_H - point.y);
  }

  function labelFootprint(district) {
    const text = (district.name || district.id || "").slice(0, district.bbox && district.bbox.w < 70 ? 4 : 9);
    return {
      x: district.labelAnchor.x,
      y: district.labelAnchor.y,
      halfW: Math.max(18, text.length * 5.1 + 9),
      halfH: 12
    };
  }

  function labelDistance(point, footprint) {
    const dx = Math.max(0, Math.abs(point.x - footprint.x) - footprint.halfW);
    const dy = Math.max(0, Math.abs(point.y - footprint.y) - footprint.halfH);
    return Math.hypot(dx, dy);
  }

  function districtEdgeDistance(point, district) {
    const polygons = district.ownershipPolygons && district.ownershipPolygons.length
      ? district.ownershipPolygons
      : [district.ownershipPolygon || district.polygon].filter(Boolean);
    let best = Infinity;
    for (const polygon of polygons) {
      if (!pointInPolygon(point, polygon)) continue;
      best = Math.min(best, polygonEdgeDistance(point, polygon));
    }
    return Number.isFinite(best) ? best : -Infinity;
  }

  function candidatePointsForBlocks(blocks, district, rng) {
    const targetPairs = slotPairsForDistrict(district);
    const labelBounds = labelFootprint(district);
    const points = blocks
      .filter(b => b.buildable && b.area > 220)
      .flatMap(b => {
        const labelPoint = b.slotAnchor || polylabel(b.polygon, 1.2, b.centroid);
        const box = b.bbox;
        const spread = Math.max(7, Math.min(18, Math.min(box.w, box.h) * 0.32));
        const variants = [
          { x: labelPoint.x, y: labelPoint.y },
          { x: labelPoint.x - spread, y: labelPoint.y },
          { x: labelPoint.x + spread, y: labelPoint.y },
          { x: labelPoint.x, y: labelPoint.y - spread },
          { x: labelPoint.x, y: labelPoint.y + spread }
        ].filter((point, index, arr) =>
          pointInPolygon(point, b.polygon) &&
          polygonEdgeDistance(point, b.polygon) > 2.2 &&
          arr.findIndex(other => Math.hypot(other.x - point.x, other.y - point.y) < 2) === index
        );
        return variants.map(c => ({
          x: c.x,
          y: c.y,
          block: b,
          edgeClearance: districtEdgeDistance(c, district),
          viewportClearance: viewportEdgeDistance(c),
          labelClearance: labelDistance(c, labelBounds),
          jitter: rng() * 10
        }));
      });

    const minDistTo = (p, others) => others.length
      ? Math.min(...others.map(e => Math.hypot(e.x - p.x, e.y - p.y)))
      : Math.hypot(p.x - district.centroid.x, p.y - district.centroid.y);

    const targetAnchors = (count, owner) => {
      const box = district.bbox;
      const inset = 0.18;
      const lowX = box.minX + box.w * inset;
      const highX = box.maxX - box.w * inset;
      const ownerTop = owner === "them";
      if (count <= 1) {
        return [{ x: district.centroid.x, y: ownerTop ? box.minY + box.h * 0.28 : box.maxY - box.h * 0.28 }];
      }
      return Array.from({ length: count }, (_, i) => ({
        x: lowX + (highX - lowX) * (i / Math.max(1, count - 1)),
        y: ownerTop ? box.minY + box.h * (0.20 + 0.08 * (i % 2)) : box.maxY - box.h * (0.20 + 0.08 * (i % 2))
      }));
    };

    const pickSpread = (candidates, count, existing, owner) => {
      const selected = [];
      const used = new Set();
      const slotEdgeClearance = Math.max(24, Math.hypot(MAP_SLOT_HALF_W, MAP_SLOT_HALF_H) + 3);
      const slotLabelClearance = Math.max(6, MAP_SLOT_HALF_H * 0.65);
      const edgeClearanceSteps = district.landmassId === "mainland"
        ? [slotEdgeClearance + 8, slotEdgeClearance + 4, slotEdgeClearance]
        : [slotEdgeClearance];
      const relaxedSpacing = rng() < 0.2;
      const separationSteps = relaxedSpacing
        ? [38, 34, 30]
        : [58, 52, 46, 40, 34, 30];
      const anchors = targetAnchors(count, owner);
      for (const minEdgeClearance of edgeClearanceSteps) {
        for (const minSep of separationSteps) {
          while (selected.length < count) {
            let best = null, bestScore = -Infinity;
            const anchor = anchors[selected.length] || district.centroid;
            for (const p of candidates) {
              if (used.has(p.block.id)) continue;
              if (p.edgeClearance < minEdgeClearance) continue;
              if (p.viewportClearance < slotEdgeClearance) continue;
              if (p.labelClearance < slotLabelClearance) continue;
              const clearance = minDistTo(p, [...existing, ...selected]);
              if (clearance < minSep) continue;
              const anchorDist = Math.hypot(p.x - anchor.x, p.y - anchor.y);
              const edgePull = Math.hypot(p.x - district.centroid.x, p.y - district.centroid.y) * 0.08;
              const score = clearance * 2.8 - anchorDist * 1.85 + edgePull +
                p.edgeClearance * 1.3 + p.viewportClearance * 0.45 + p.labelClearance * 1.0 + p.jitter;
              if (score > bestScore) {
                best = p;
                bestScore = score;
              }
            }
            if (!best) break;
            used.add(best.block.id);
            selected.push(best);
          }
          if (selected.length >= count) break;
        }
        if (selected.length >= count) break;
      }
      return selected;
    };

    const fillShortfall = (ownerSlots, owner, existing) => {
      if (ownerSlots.length >= targetPairs) return ownerSlots;
      const selected = [...ownerSlots];
      const anchors = targetAnchors(targetPairs, owner);
      const usedIds = new Set([...ownerSlots, ...existing].map(p => p.block && p.block.id).filter(Boolean));
      const slotEdgeClearance = Math.max(18, Math.hypot(MAP_SLOT_HALF_W, MAP_SLOT_HALF_H));
      const companionPoint = () => {
        const base = existing[0] || selected[0] || points[0];
        if (!base || !base.block) return null;
        const direction = owner === "them" ? -1 : 1;
        const tries = [];
        for (const r of [18, 14, 10, 6, 3]) {
          tries.push(
            { x: base.x, y: base.y + direction * r },
            { x: base.x - r, y: base.y + direction * r * 0.55 },
            { x: base.x + r, y: base.y + direction * r * 0.55 },
            { x: base.x - r, y: base.y },
            { x: base.x + r, y: base.y }
          );
        }
        const point = tries.find(p =>
          pointInPolygon(p, base.block.polygon) &&
          polygonEdgeDistance(p, base.block.polygon) > 1.1 &&
          minDistTo(p, [...existing, ...selected]) > 2
        ) || { x: base.x, y: base.y };
        return {
          x: point.x,
          y: point.y,
          block: base.block,
          edgeClearance: districtEdgeDistance(point, district),
          viewportClearance: viewportEdgeDistance(point),
          labelClearance: labelDistance(point, labelBounds),
          jitter: rng() * 10,
          synthetic: true
        };
      };
      while (selected.length < targetPairs) {
        let best = null;
        const anchor = anchors[selected.length] || district.centroid;
        for (const p of points) {
          const alreadySameBlock = usedIds.has(p.block.id);
          const clearance = minDistTo(p, [...existing, ...selected]);
          if (clearance < (alreadySameBlock ? 16 : 22)) continue;
          if (p.viewportClearance < slotEdgeClearance) continue;
          const anchorDist = Math.hypot(p.x - anchor.x, p.y - anchor.y);
          const ownerBias = owner === "them"
            ? Math.max(0, district.centroid.y - p.y) * 0.36
            : Math.max(0, p.y - district.centroid.y) * 0.36;
          const score = ownerBias + p.edgeClearance * 1.1 + clearance * 1.25 - anchorDist * 0.9 + p.jitter;
          if (!best || score > best.score) best = { ...p, score };
        }
        if (!best) best = companionPoint();
        if (!best) break;
        usedIds.add(best.block.id);
        selected.push(best);
      }
      return selected;
    };

    let themCandidates = points.filter(p => p.y < district.centroid.y);
    let youCandidates = points.filter(p => p.y >= district.centroid.y);
    if (themCandidates.length < targetPairs) themCandidates = points;
    if (youCandidates.length < targetPairs) youCandidates = points;

    let them = pickSpread(themCandidates, targetPairs, [], "them");
    let you = pickSpread(youCandidates, targetPairs, them, "you");
    them = fillShortfall(them, "them", you);
    you = fillShortfall(you, "you", them);
    return [
      ...them.slice(0, targetPairs).map((p, i) => ({ ...p, owner: "them", index: i })),
      ...you.slice(0, targetPairs).map((p, i) => ({ ...p, owner: "you", index: i }))
    ];
  }

  function makeSlots(district, rng) {
    return candidatePointsForBlocks(district.blocks, district, rng).map(p => ({
      id: `V35D${district.idx}-${p.owner}-${p.index}`,
      districtIdx: district.idx,
      districtId: district.id,
      owner: p.owner,
      blockId: p.block.id,
      x: p.x, y: p.y
    }));
  }

  function cutToRoad(cut, index, sourcePrefix) {
    const points = cut.polyline && cut.polyline.length >= 2 ? cut.polyline : [cut.p1, cut.p2];
    const d = cut.polyline
      ? cutPath(cut)
      : `M ${cut.p1.x.toFixed(2)} ${cut.p1.y.toFixed(2)} L ${cut.p2.x.toFixed(2)} ${cut.p2.y.toFixed(2)}`;
    const kind = cut.depth === 0 ? "highway" : cut.depth === 1 ? "avenue" : cut.depth === 2 ? "street" : "local";
    return {
      id: `${sourcePrefix}-road-${index + 1}`,
      kind,
      source: cut.depth <= 1 ? "macro-cut" : "bsp-cut",
      path: d, points, depth: cut.depth, cut,
      riverBank: !!cut.riverBank
    };
  }

  function makeBuildingForBlock(block, index, rng) {
    const box = block.bbox;
    const w = Math.max(4, Math.min(18, box.w * (0.22 + rng() * 0.22)));
    const h = Math.max(4, Math.min(20, box.h * (0.22 + rng() * 0.22)));
    const footprint = rectPolygon(block.centroid.x, block.centroid.y, w, h, block.fieldAngle);
    const height = block.density === "dense" ? 12 + rng() * 18
      : block.density === "medium" ? 7 + rng() * 10 : 4 + rng() * 7;
    return {
      id: `${block.id}:building:${index}`,
      cellId: block.id,
      landmassId: block.landmassId,
      footprint,
      path: polygonToPath(footprint),
      area: polygonArea(footprint),
      height,
      shadow: { azimuth: -0.72, length: height * 0.58, opacity: Math.min(0.32, 0.07 + height / 100) },
      render: {
        extrudable: true, staticMesh: true,
        lodGroup: height > 18 ? "tower" : height > 9 ? "midrise" : "lowrise"
      }
    };
  }

  function polygonLongestEdgeAngle(polygon) {
    let longest = 0, angle = 0;
    for (let i = 0; i < polygon.length; i++) {
      const p1 = polygon[i];
      const p2 = polygon[(i + 1) % polygon.length];
      const dx = p2.x - p1.x, dy = p2.y - p1.y;
      const len = dx * dx + dy * dy;
      if (len > longest) {
        longest = len;
        angle = Math.atan2(dy, dx);
      }
    }
    return angle;
  }

  // Sutherland-Hodgman polygon clip. clip polygon should be convex (or locally
  // convex at the clipped edges — good enough for coast-road clipping).
  function clipPolygonSH(subject, clip) {
    if (!subject || subject.length < 3) return [];
    // Determine winding via signed area (shoelace). In screen coords (y-down):
    // positive signed area = CW winding → inside is cross >= 0.
    let area2 = 0;
    for (let i = 0; i < clip.length; i++) {
      const a = clip[i], b = clip[(i + 1) % clip.length];
      area2 += (a.x * b.y - b.x * a.y);
    }
    const sign = area2 >= 0 ? 1 : -1;
    const inside = (p, a, b) =>
      sign * ((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)) >= 0;
    const intersect = (a, b, c, d) => {
      const A1 = b.y - a.y, B1 = a.x - b.x, C1 = A1 * a.x + B1 * a.y;
      const A2 = d.y - c.y, B2 = c.x - d.x, C2 = A2 * c.x + B2 * c.y;
      const det = A1 * B2 - A2 * B1;
      if (Math.abs(det) < 1e-9) return { x: a.x, y: a.y };
      return { x: (C1 * B2 - C2 * B1) / det, y: (A1 * C2 - A2 * C1) / det };
    };
    let output = subject.map(p => ({ x: p.x, y: p.y }));
    for (let i = 0; i < clip.length; i++) {
      if (!output.length) return [];
      const ca = clip[i], cb = clip[(i + 1) % clip.length];
      const input = output; output = [];
      for (let j = 0; j < input.length; j++) {
        const curr = input[j], prev = input[(j + input.length - 1) % input.length];
        const ci = inside(curr, ca, cb), pi = inside(prev, ca, cb);
        if (ci) { if (!pi) output.push(intersect(prev, curr, ca, cb)); output.push(curr); }
        else if (pi) output.push(intersect(prev, curr, ca, cb));
      }
    }
    return output;
  }

  function makeBlock(leaf, district, index, terrain, gridAngle = 0) {
    let polygon = leaf.polygon;
    const centroid = interiorPoint(polygon);
    const area = polygonArea(polygon);
    const lakeReserve = polygonTouchesWaterReserve(polygon, terrain);
    const centroidInWater = pointInWater(centroid, terrain);
    const slotAnchor = lakeReserve ? null : dryInteriorAnchor(polygon, terrain);
    const inWater = lakeReserve || (centroidInWater && !slotAnchor);
    const longestAngle = polygonLongestEdgeAngle(polygon);
    return {
      id: `${district.id}:block:${index + 1}`,
      districtId: district.id,
      districtIdx: district.idx,
      landmassId: district.landmassId,
      polygon,
      path: polygonToPath(polygon),
      centroid, area,
      slotAnchor,
      bbox: polygonBBox(polygon),
      density: area < 460 ? "dense" : area < 1100 ? "medium" : "sparse",
      buildable: !inWater && area > 80,
      tags: inWater ? ["waterReserve"] : ["buildable", ...(centroidInWater ? ["riverSplit"] : [])],
      fieldAngle: longestAngle, orientation: longestAngle,
      leaf
    };
  }

  // Build ownership path: smooth coast edges, straight cut edges.
  // Cut endpoints are the only vertices NOT in the original land polygon —
  // they're new points inserted by splitPolygonByLine. Densify only edges
  // incident to cut endpoints so smoothClosedPath stays straight along them.
  // Coast edges (original land polygon vertices) are left untouched so the
  // bezier curves match landmass.path.
  function buildOwnershipPath(region, landPolygon) {
    const snap = p => `${Math.round(p.x * 10)},${Math.round(p.y * 10)}`;
    const landSet = new Set(landPolygon.map(snap));
    const isCut = p => !landSet.has(snap(p));

    const densified = [];
    for (let i = 0; i < region.length; i++) {
      const a = region[i];
      const b = region[(i + 1) % region.length];
      densified.push(a);
      if (isCut(a) || isCut(b)) {
        const dist = Math.hypot(b.x - a.x, b.y - a.y);
        if (dist > 8) {
          const steps = Math.ceil(dist / 8);
          for (let j = 1; j < steps; j++) {
            const t = j / steps;
            densified.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
          }
        }
      }
    }
    return smoothClosedPath(densified);
  }

  function signedLineSide(point, a, b) {
    return (b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x);
  }

  function cutBoundarySegments(cut) {
    const points = cut.polyline && cut.polyline.length >= 2
      ? cut.polyline
      : [cut.p1, cut.p2];
    const segments = [];
    for (let i = 0; i + 1 < points.length; i++) {
      segments.push({ a: points[i], b: points[i + 1] });
    }
    return segments;
  }

  function polygonUsesCutBoundary(polygon, cut) {
    const segments = cutBoundarySegments(cut);
    if (!segments.length) return false;
    let matchedSpan = 0;
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i];
      const b = polygon[(i + 1) % polygon.length];
      const edgeLen = Math.hypot(b.x - a.x, b.y - a.y);
      if (edgeLen < 4) continue;
      for (const segment of segments) {
        const da = pointToSegmentDist(a.x, a.y, segment.a, segment.b);
        const db = pointToSegmentDist(b.x, b.y, segment.a, segment.b);
        if (da < 2.25 && db < 2.25) {
          matchedSpan += edgeLen;
          break;
        }
      }
    }
    return matchedSpan >= 5;
  }

  function clipPolygonToCutSide(subject, cut, keepPoint) {
    if (!subject || subject.length < 3) return [];
    const points = cut.polyline && cut.polyline.length >= 2
      ? [cut.polyline[0], cut.polyline[cut.polyline.length - 1]]
      : [cut.p1, cut.p2];
    const a = points[0], b = points[1];
    const keepSide = signedLineSide(keepPoint, a, b);
    if (Math.abs(keepSide) < 1e-6) return subject;

    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) return subject;
    const ux = dx / len, uy = dy / len;
    const huge = 4000;
    const result = splitPolygonByLine(
      subject,
      { x: a.x - ux * huge, y: a.y - uy * huge },
      { x: b.x + ux * huge, y: b.y + uy * huge }
    );
    if (!result) return subject;

    const halves = [result[0], result[1]].filter(poly => poly && poly.length >= 3 && polygonArea(poly) > 20);
    const selected = halves.find(poly => signedLineSide(interiorPoint(poly), a, b) * keepSide >= -1e-6);
    return selected || subject;
  }

  function buildMainlandBuildablePolygons(ownershipPolygons, buildableLandPolygon, boundaryCuts) {
    if (!buildableLandPolygon || buildableLandPolygon.length < 3) return ownershipPolygons;
    return ownershipPolygons.map(ownershipPolygon => {
      const keepPoint = interiorPoint(ownershipPolygon);
      let buildable = buildableLandPolygon;
      for (const cut of boundaryCuts) {
        if (!polygonUsesCutBoundary(ownershipPolygon, cut)) continue;
        const clipped = clipPolygonToCutSide(buildable, cut, keepPoint);
        if (clipped.length >= 3) buildable = clipped;
      }
      return buildable;
    }).filter(poly => poly && poly.length >= 3 && polygonArea(poly) > 50);
  }

  // extraPolygons: secondary polygons added to this district during a merge-down.
  // They are BSP-subdivided at the same gridAngle so their streets are coherent
  // with the primary polygon's grid — the merged district has one unified feel.
  function makeDistrict(region, idx, names, colors, terrain, rng, landmassId = "mainland", gridAngle = 0, waterSegs = [], extraPolygons = [], buildablePolygons = null) {
    const allOwnershipPolygons = [region, ...extraPolygons];
    const buildablePieces = (buildablePolygons && buildablePolygons.length ? buildablePolygons : allOwnershipPolygons)
      .filter(poly => poly && poly.length >= 3 && polygonArea(poly) > 50);
    const bspRoots = buildablePieces.map(poly => bspSubdivide(poly, 2, gridAngle, rng));
    const bspRoot = bspRoots[0] || null;
    const allLeaves = bspRoots.flatMap(root => leavesUnder(root));
    const mergedArea = allOwnershipPolygons.reduce((s, p) => s + polygonArea(p), 0);
    const base = {
      idx,
      id: `district-${idx + 1}`,
      name: names[idx % names.length],
      color: colors[idx % colors.length],
      landmassId,
      ownershipPolygon: region,
      ownershipPolygons: allOwnershipPolygons,
      ownershipPath: buildOwnershipPath(region, terrain.mainland.polygon),
      polygon: region,
      polygonPath: polygonToPath(region),
      outlinePath: polygonOutlinePathClippedToViewport(region),
      area: mergedArea,
      centroid: interiorPoint(region),
      bbox: polygonBBox(region),
      bspRoot, blockTree: bspRoot,
      waterPolygons: allOwnershipPolygons.flatMap(p => ownedWaterPolygons(p, terrain)),
      blocks: [], buildablePolygons: [], polygons: [],
      roads: [], slots: [], dots: [],
      rawCuts: [],
      labelAnchor: interiorPoint(region),
      labelPos: interiorPoint(region),
      labelText: names[idx % names.length],
      metadata: { architecture: "v35", blockGrammar: "v3-bsp", merged: extraPolygons.length > 0 }
    };
    base.blocks = allLeaves.map((leaf, i) => makeBlock(leaf, base, i, terrain, gridAngle));
    base.buildablePolygons = base.blocks.filter(b => b.buildable).map(b => b.polygon);
    base.polygons = base.buildablePolygons;
    // Collect BSP cuts from the same buildable roots that generated blocks.
    const rawCuts = bspRoots.flatMap(r => collectAllCuts(r));
    base.rawCuts = rawCuts;
    const truncatedCuts = waterSegs.length
      ? rawCuts.flatMap(cut => truncateCutAtRiver(cut, waterSegs, 5))
      : rawCuts;
    base.roads = truncatedCuts.map((cut, i) => cutToRoad(cut, i, `${base.id}-bsp`));
    base.slots = makeSlots(base, rng);
    base.dots = base.slots;
    return base;
  }

  function makeIslandDistricts(terrain, startIdx, names, colors, rng, waterSegs) {
    const districts = [];
    for (const landmass of terrain.landmasses || []) {
      if (landmass.kind !== "island" || landmass.visibleArea < 520) continue;
      const angle = (rng() - 0.5) * (Math.PI / 4); // islands get their own tilt
      
      const innerPolygon = window.CityMapGeometryV3.insetPolygon(landmass.polygon, 6);
      if (!innerPolygon || innerPolygon.length < 3 || polygonArea(innerPolygon) < 260) continue;
      
      const district = makeDistrict(
        innerPolygon, startIdx + districts.length,
        names, colors, terrain, rng, landmass.id, angle, waterSegs
      );
      
      const coastCut = {
        p1: innerPolygon[0], p2: innerPolygon[0], // dummy endpoints
        polyline: [...innerPolygon, innerPolygon[0]],
        polylineMode: "coast", depth: 1, angle: 0
      };
      
      district.roads.push({
        id: `${district.id}-coast-road`,
        kind: "avenue",
        source: "coast-road",
        path: window.CityMapPathsV3.smoothClosedPath(innerPolygon),
        points: [...innerPolygon, innerPolygon[0]],
        depth: 1,
        cut: coastCut
      });
      
      districts.push(district);
    }
    return districts;
  }

  function riverBodyForBridges(terrain) {
    const rivers = waterBodiesOfKind(terrain, "river");
    if (!rivers.length) return null;
    return {
      path: rivers.map(r => r.path).join(" "),
      segments: rivers.flatMap(r => r.segments || []),
      outerWidth: Math.max(...rivers.map(r => r.outerWidth || 7)),
      innerWidth: Math.max(...rivers.map(r => r.innerWidth || 3.5)),
      buildingBuffer: Math.max(...rivers.map(r => r.buildingBuffer || 7))
    };
  }

  function bridgeLinePath(cx, cy, angle, length) {
    const dx = Math.cos(angle) * length * 0.5;
    const dy = Math.sin(angle) * length * 0.5;
    return `M ${(cx - dx).toFixed(2)} ${(cy - dy).toFixed(2)} L ${(cx + dx).toFixed(2)} ${(cy + dy).toFixed(2)}`;
  }

  function angleDelta(a, b) {
    let d = Math.abs(a - b) % Math.PI;
    return d > Math.PI / 2 ? Math.PI - d : d;
  }

  function nearestSegmentAngle(point, segments) {
    let best = null;
    for (const seg of segments || []) {
      const d = pointToSegmentDist(point.x, point.y, seg.a, seg.b);
      if (!best || d < best.d) {
        best = { d, angle: Math.atan2(seg.b.y - seg.a.y, seg.b.x - seg.a.x) };
      }
    }
    return best ? best.angle : null;
  }

  function bridgeCrossesRiver(bridge, riverSegments) {
    return true;
  }

  function bridgeRiverDelta(bridge, riverSegments) {
    const riverAngle = nearestSegmentAngle({ x: bridge.x, y: bridge.y }, riverSegments);
    if (riverAngle == null) return Math.PI / 2;
    return angleDelta(bridge.roadAngle ?? bridge.angle ?? 0, riverAngle);
  }

  function makeBridgePlan(terrain, mainlandCoastRoadPolygon = null, roadCuts = []) {
    const islandBridges = (terrain.channels || [])
      .filter(ch => ch.bridgeAllowed && ch.centerline && ch.centerline.length >= 2)
      .map((ch, i) => {
        const mainlandOuter = ch.centerline[0];
        const islandOuter = ch.centerline[ch.centerline.length - 1];
        const island = (terrain.landmasses || []).find(l => l.id === ch.landmassIds[1]);
        const islandCoastRoad = island && window.CityMapGeometryV3.insetPolygon(island.polygon, 6);
        const b = islandCoastRoad && islandCoastRoad.length >= 3
          ? closestPointOnPolygon(mainlandOuter.x, mainlandOuter.y, islandCoastRoad)
          : islandOuter;
        const a = mainlandCoastRoadPolygon
          ? closestPointOnPolygon(b.x, b.y, mainlandCoastRoadPolygon)
          : ch.centerline[0];
        return {
          id: `v35-bridge-${i + 1}`,
          channelId: ch.id,
          path: `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} L ${b.x.toFixed(2)} ${b.y.toFixed(2)}`,
          center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
          deckWidth: 4.8,
          type: "island"
        };
      });
    const river = riverBodyForBridges(terrain);
    const riverBridgeResult = river && mainlandCoastRoadPolygon && window.CityMapBridgesV3
      ? window.CityMapBridgesV3.generateBridges({
          allCuts: roadCuts,
          river,
          riverSegments: river.segments,
          coastRoadPolygon: mainlandCoastRoadPolygon,
          landPolygon: terrain.mainland.polygon
        })
      : null;
    const renderedCuts = riverBridgeResult && riverBridgeResult.renderedCuts
      ? riverBridgeResult.renderedCuts
      : roadCuts;
    const riverBridges = riverBridgeResult
      ? riverBridgeResult.bridges.filter(bridge => !bridge.offshore).map((bridge, i) => {
          if (!bridgeCrossesRiver(bridge, river.segments)) return null;
          const depth = bridge.depth ?? 2;
          const delta = bridgeRiverDelta(bridge, river.segments);
          const baseLength = Math.max((river.outerWidth || 7) + 8, depth <= 1 ? 13 : 10);
          const shallowFactor = 1 / Math.max(0.34, Math.sin(Math.max(delta, 0.22)));
          const maxLength = depth <= 1 ? 64 : depth >= 4 ? 36 : 52;
          const length = Math.min(maxLength, baseLength * shallowFactor);
          const deckWidth = depth === 0 ? 5.2 : depth === 1 ? 4.4 : depth >= 4 ? 2.6 : 3.5;
          return {
            id: `v35-river-bridge-${i + 1}`,
            path: bridgeLinePath(bridge.x, bridge.y, bridge.angle || 0, length),
            center: { x: bridge.x, y: bridge.y },
            angle: bridge.angle || 0,
            deckWidth,
            depth,
            riverMouth: !!bridge.riverMouth,
            type: "river"
          };
        }).filter(Boolean)
      : [];
    return { bridges: [...islandBridges, ...riverBridges], renderedCuts };
  }

  function districtAdjacency(districts) {
    const graph = {};
    for (const d of districts) graph[d.id] = [];
    for (let i = 0; i < districts.length; i++) {
      for (let j = i + 1; j < districts.length; j++) {
        const a = districts[i], b = districts[j];
        if (Math.hypot(a.centroid.x - b.centroid.x, a.centroid.y - b.centroid.y) < Math.max(VIEW_W, VIEW_H)) {
          graph[a.id].push(b.id);
          graph[b.id].push(a.id);
        }
      }
    }
    return graph;
  }

  function makeCompoundOpenSpace(block, rng) {
    const box = block.bbox;
    const featureCount = Math.max(2, Math.min(6, Math.floor(block.area / 620) + (rng() < 0.45 ? 1 : 0)));
    const angle = block.fieldAngle || 0;
    const axisX = Math.cos(angle), axisY = Math.sin(angle);
    const crossX = -axisY, crossY = axisX;
    const rowCount = featureCount > 4 ? 2 : 1;
    const colCount = Math.ceil(featureCount / rowCount);
    const spreadX = Math.min(box.w * 0.44, colCount * 11);
    const spreadY = Math.min(box.h * 0.30, rowCount * 9);
    const features = [];
    for (let i = 0; i < featureCount; i++) {
      const col = i % colCount;
      const row = Math.floor(i / colCount);
      const u = colCount <= 1 ? 0 : (col / (colCount - 1) - 0.5) * spreadX;
      const v = rowCount <= 1 ? 0 : (row / (rowCount - 1) - 0.5) * spreadY;
      const cx = block.centroid.x + axisX * u + crossX * v;
      const cy = block.centroid.y + axisY * u + crossY * v;
      const w = Math.max(4.5, Math.min(13, box.w * (0.12 + rng() * 0.06)));
      const h = Math.max(4, Math.min(11, box.h * (0.12 + rng() * 0.07)));
      features.push({
        path: polygonToPath(rectPolygon(cx, cy, w, h, angle + (rng() - 0.5) * 0.08)),
        opacity: 0.34 + rng() * 0.18
      });
    }
    const entry = {
      x: block.centroid.x - axisX * Math.min(box.w * 0.36, 24),
      y: block.centroid.y - axisY * Math.min(box.w * 0.36, 24)
    };
    const exit = {
      x: block.centroid.x + axisX * Math.min(box.w * 0.36, 24),
      y: block.centroid.y + axisY * Math.min(box.w * 0.36, 24)
    };
    return {
      id: `${block.id}:compound`,
      kind: "compound",
      cellId: block.id,
      angle,
      features,
      accessPath: `M ${entry.x.toFixed(2)} ${entry.y.toFixed(2)} L ${exit.x.toFixed(2)} ${exit.y.toFixed(2)}`
    };
  }

  function blockSpacingDistance(a, b) {
    const ac = a.centroid || polygonCentroid(a.polygon);
    const bc = b.centroid || polygonCentroid(b.polygon);
    return Math.hypot(ac.x - bc.x, ac.y - bc.y);
  }

  function blockNearOpenSpace(block, openSpaces, cellsById, minDist = 34) {
    for (const space of openSpaces) {
      if (space.kind !== "park" && space.kind !== "compound") continue;
      const other = cellsById.get(space.cellId);
      if (!other) continue;
      if (blockSpacingDistance(block, other) < minDist) return true;
    }
    return false;
  }

  function blockNearLake(block, terrain, minDist = 24) {
    if (!terrain) return false;
    for (const lake of waterBodiesOfKind(terrain, "lake")) {
      if (!lake.polygon) continue;
      if (pointToPolygonEdgeDistance(block.centroid, lake.polygon) < minDist) return true;
      if (block.polygon.some(p => pointToPolygonEdgeDistance(p, lake.polygon) < minDist)) return true;
    }
    return false;
  }

  function lakeRoadHazards(terrain, buffer = 9) {
    return waterBodiesOfKind(terrain, "lake").flatMap(lake => {
      if (!lake.polygon) return [];
      const hazards = [];
      for (let i = 0; i < lake.polygon.length; i++) {
        hazards.push({
          a: lake.polygon[i],
          b: lake.polygon[(i + 1) % lake.polygon.length],
          buffer
        });
      }
      return hazards;
    });
  }

  function footprintTouchesWaterSetback(corners, riverSegments, roadHazards, riverBuffer) {
    const probes = [...corners];
    let cx = 0, cy = 0;
    for (let i = 0; i < corners.length; i++) {
      const a = corners[i];
      const b = corners[(i + 1) % corners.length];
      cx += a.x / corners.length;
      cy += a.y / corners.length;
      probes.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    }
    probes.push({ x: cx, y: cy });
    for (const p of probes) {
      if (riverSegments && riverSegments.length && distToRiver(p.x, p.y, riverSegments) < riverBuffer) {
        return true;
      }
      for (const hz of roadHazards || []) {
        if (pointToSegmentDist(p.x, p.y, hz.a, hz.b) < hz.buffer) return true;
      }
    }
    return false;
  }

  function fallbackTinyBlockBuildings(block, rng, riverSegments, roadHazards, riverBuffer) {
    const blockPolygon = block.polygon;
    const gridAngle = block.fieldAngle || 0;
    const cosG = Math.cos(-gridAngle), sinG = Math.sin(-gridAngle);
    const cosI = Math.cos(gridAngle), sinI = Math.sin(gridAngle);
    let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
    for (const p of blockPolygon) {
      const u = p.x * cosG - p.y * sinG;
      const v = p.x * sinG + p.y * cosG;
      minU = Math.min(minU, u);
      maxU = Math.max(maxU, u);
      minV = Math.min(minV, v);
      maxV = Math.max(maxV, v);
    }

    const wU = maxU - minU;
    const wV = maxV - minV;
    if (wU < 3.4 || wV < 3.4) return [];

    const placed = [];
    const buildings = [];
    const maxBuildings = Math.min(12, Math.max(2, Math.floor(block.area / 170)));
    const sizes = [5.2, 4.4, 3.6, 2.8];
    const candidates = [];
    const step = 2.8;
    for (let u = minU + 1.9; u <= maxU - 1.9; u += step) {
      for (let v = minV + 1.9; v <= maxV - 1.9; v += step) {
        candidates.push({
          u: u + (rng() - 0.5) * 0.8,
          v: v + (rng() - 0.5) * 0.8
        });
      }
    }
    const shuffled = shuffle(candidates, rng);

    const tryPlace = (u, v, w, h) => {
      const u1 = u - w / 2, u2 = u + w / 2;
      const v1 = v - h / 2, v2 = v + h / 2;
      if (u1 < minU || u2 > maxU || v1 < minV || v2 > maxV) return false;
      for (const b of placed) {
        if (u2 + 0.45 > b.u1 && u1 - 0.45 < b.u2 &&
            v2 + 0.45 > b.v1 && v1 - 0.45 < b.v2) {
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
      if (!corners.every(c => pointInPolygon(c, blockPolygon))) return false;
      if (footprintTouchesWaterSetback(corners, riverSegments, roadHazards, riverBuffer)) return false;
      placed.push({ u1, u2, v1, v2 });
      buildings.push({
        path: `M ${corners[0].x.toFixed(2)} ${corners[0].y.toFixed(2)} ` +
              `L ${corners[1].x.toFixed(2)} ${corners[1].y.toFixed(2)} ` +
              `L ${corners[2].x.toFixed(2)} ${corners[2].y.toFixed(2)} ` +
              `L ${corners[3].x.toFixed(2)} ${corners[3].y.toFixed(2)} Z`,
        polygon: corners,
        area: polygonArea(corners),
        shade: rng(),
        fallback: true
      });
      return true;
    };

    for (const candidate of shuffled) {
      if (buildings.length >= maxBuildings) break;
      for (const size of sizes) {
        const aspect = 0.78 + rng() * 0.52;
        const w = size * aspect;
        const h = size / aspect;
        if (tryPlace(candidate.u, candidate.v, w, h)) break;
      }
    }
    return buildings;
  }

  function buildStaticBuildings(blocks, rng, terrain) {
    const buildings = [], openSpaces = [];
    const parkBlockIds = new Set();
    const cellsById = new Map(blocks.map(block => [block.id, block]));
    const riverSegments = terrain ? waterBodiesOfKind(terrain, "river").flatMap(r => r.segments || []) : null;
    const roadHazards = terrain ? lakeRoadHazards(terrain) : [];
    const riverBuffer = terrain
      ? Math.max(7, ...waterBodiesOfKind(terrain, "river").map(r => r.buildingBuffer || 7))
      : 7;
    for (const block of blocks) {
      if (!block.buildable) {
        openSpaces.push({ id: `${block.id}:reserve`, kind: "setback", cellId: block.id });
        continue;
      }
      const lakefront = blockNearLake(block, terrain);
      const nearOpenSpace = blockNearOpenSpace(block, openSpaces, cellsById);
      const parkEligible = !lakefront && !nearOpenSpace && block.area > 620;
      const parkRoll = block.area > 2300 ? 0.42 : block.area > 1500 ? 0.30 : 0.12;
      if (parkEligible && rng() < parkRoll) {
        parkBlockIds.add(block.id);
        if (block.area > 2100 && rng() < 0.42) {
          openSpaces.push(makeCompoundOpenSpace(block, rng));
        } else {
          const parkObj = {
            id: `${block.id}:park`,
            kind: "park",
            role: "landmark",
            cellId: block.id
          };
          if (rng() < 0.35) {
            const box = polygonBBox(block.polygon);
            const angle = block.fieldAngle || 0;
            const dx = Math.cos(angle), dy = Math.sin(angle);
            const cx = block.centroid.x, cy = block.centroid.y;
            const t = 0.25 + rng() * 0.5;
            const bend = rng() < 0.6;
            if (bend) {
              const p1 = { x: cx - dx * box.w * 0.45, y: cy - dy * box.w * 0.45 };
              const p2 = { x: cx + dx * box.w * 0.45, y: cy + dy * box.w * 0.45 };
              const bendAmp = (rng() - 0.5) * box.w * 0.15;
              const bendX = p1.x + (p2.x - p1.x) * t + (-dy) * bendAmp;
              const bendY = p1.y + (p2.y - p1.y) * t + dx * bendAmp;
              parkObj.parkRoad = { p1, p2, bend: { x: bendX, y: bendY } };
            } else {
              const p1 = { x: cx - dx * box.w * 0.45, y: cy - dy * box.w * 0.45 };
              const p2 = { x: cx + dx * box.w * 0.45, y: cy + dy * box.w * 0.45 };
              parkObj.parkRoad = { p1, p2 };
            }
          }
          openSpaces.push(parkObj);
        }
        continue;
      }
      if (parkBlockIds.has(block.id)) {
        continue;
      }
      let generated = window.CityMapBuildingsV3.generateBlockBuildings(
        block.polygon, block.fieldAngle, rng, riverSegments, roadHazards, riverBuffer
      );
      if (!generated.length && block.area > 110) {
        generated = fallbackTinyBlockBuildings(block, rng, riverSegments, roadHazards, riverBuffer);
      }
      generated.forEach((gen, i) => {
        const height = block.density === "dense" ? 12 + rng() * 18
          : block.density === "medium" ? 7 + rng() * 10 : 4 + rng() * 7;
        buildings.push({
          id: `${block.id}:building:${i}`,
          cellId: block.id,
          landmassId: block.landmassId,
          footprint: gen.polygon,
          path: gen.path,
          area: gen.area,
          height,
          shade: gen.shade,
          fallback: !!gen.fallback,
          shadow: { azimuth: -0.72, length: height * 0.58, opacity: Math.min(0.32, 0.07 + height / 100) },
          render: {
            extrudable: true, staticMesh: true,
            lodGroup: height > 18 ? "tower" : height > 9 ? "midrise" : "lowrise"
          }
        });
      });
    }
    // Deduplication: remove buildings that significantly overlap with others
    const deduplicatedBuildings = [];
    for (const building of buildings) {
      let isOverlapping = false;
      if (building.footprint && building.footprint.length > 0) {
        const cx = building.footprint.reduce((s, p) => s + p.x, 0) / building.footprint.length;
        const cy = building.footprint.reduce((s, p) => s + p.y, 0) / building.footprint.length;
        // Check against already-kept buildings
        for (const kept of deduplicatedBuildings) {
          if (kept.footprint && kept.footprint.length > 0) {
            const kcx = kept.footprint.reduce((s, p) => s + p.x, 0) / kept.footprint.length;
            const kcy = kept.footprint.reduce((s, p) => s + p.y, 0) / kept.footprint.length;
            const dist = Math.hypot(cx - kcx, cy - kcy);
            // If centers are very close (< 2 px apart), likely a duplicate
            if (dist < 2.0) {
              isOverlapping = true;
              break;
            }
          }
        }
      }
      if (!isOverlapping) {
        deduplicatedBuildings.push(building);
      }
    }
    return {
      buildings: deduplicatedBuildings, openSpaces, landmarks: [],
      staticScene: { shadowAzimuth: -0.72, shadowElevation: 0.55, cacheable: true }
    };
  }

  // ── Top-level builder ────────────────────────────────────────

  function buildCityV35(seed = 1) {
    const normalizedSeed = normalizeSeed(seed);
    const key = `city-v35:${normalizedSeed}`;
    if (cache.has(key)) return cache.get(key);

    const terrain = window.CityMapTerrainV4.buildTerrain(normalizedSeed);
    const rng = window.makeRng(normalizedSeed ^ 0x3355);
    const names = shuffle(DISTRICT_NAMES, rng);
    const colors = shuffle(DISTRICT_COLORS, rng);
    const waterSegs = allWaterSegments(terrain);

    // ── Macro division: district boundaries ARE the roads ────────────────
    // macroDivide3 makes 2 sequential grid-aligned cuts through the land polygon.
    // The cut line is simultaneously the district boundary AND the rendered highway/
    // avenue — so hovering a district always shows a boundary that sits exactly on
    // a road. This is how v3 works; v35 now uses the same contract.
    //
    // gridAngle = 0 → largest district gets perfectly horizontal/vertical streets
    // (Manhattan Rule). macroDivide3 uses the same angle for both the macro cuts
    // AND the BSP inside each region, so everything is consistent.
    const riverSegs = waterBodiesOfKind(terrain, "river")
      .flatMap(r => (r.segments || []).map(s => ({ a: s.a, b: s.b })));
      
    const mainlandInset = window.CityMapGeometryV3.insetPolygon(terrain.mainland.polygon, 6);
    const validInset = mainlandInset && mainlandInset.length >= 3 && polygonArea(mainlandInset) > 400;
    const workingPolygon = validInset ? mainlandInset : terrain.mainland.polygon;
    
    // Split the FULL land polygon so ownership polygons reach the actual coastline.
    // workingPolygon (inset) is kept only for the coast road and per-district BSP inset.
    const divided = macroDivide3(terrain.mainland.polygon, 0, rng, riverSegs);

    // Apply the two golden rules on top:
    //   1. Exactly 3 districts (merge-down if macroDivide3 returned 2)
    //   2. Largest district angle already 0 from macroDivide3; enforceThreeDistricts
    //      keeps that contract even when a split-up is needed.
    const lakes     = waterBodiesOfKind(terrain, "lake");
    const asDivided = {
      regions:      divided.regions,
      regionAngles: divided.regions.map(() => 0), // all regions share gridAngle=0
      spineCuts:    divided.macroCuts
    };
    const enforced = enforceThreeDistricts(asDivided, rng, lakes);

    // enforceThreeDistricts already sorted regions largest-first.
    // Largest district (idx 0) = 0° grid = perfectly horizontal civic anchor.
    // The smaller two get distinct angles so their internal blocks look different
    // and grids "collide" visually at the shared road boundary (SF-style triangular
    // corner blocks where two orientations meet).
    const districtAngles = [
      0,                                            // largest: horizontal anchor
      Math.PI / 4 + (rng() - 0.5) * 0.14,         // medium:  ~45° diagonal
      -Math.PI / 5 + (rng() - 0.5) * 0.14         // smallest: ~-36° counter-diagonal
    ];

    const mainlandBuildableByDistrict = enforced.regions.map((region, idx) =>
      buildMainlandBuildablePolygons(
        [region, ...(enforced.regionSubPolygons[idx] || [])],
        workingPolygon,
        enforced.spineCuts
      )
    );

    const mainlandDistricts = enforced.regions.map((region, idx) => {
      return makeDistrict(region, idx, names, colors, terrain, rng, "mainland",
        districtAngles[idx] ?? 0, waterSegs,
        enforced.regionSubPolygons[idx] || [],
        mainlandBuildableByDistrict[idx]);
    });

    if (validInset && mainlandDistricts.length > 0) {
      const coastCut = {
        p1: mainlandInset[0], p2: mainlandInset[0],
        polyline: [...mainlandInset, mainlandInset[0]],
        polylineMode: "coast", depth: 1, angle: 0
      };
      mainlandDistricts[0].roads.push({
        id: "mainland-coast-road",
        kind: "avenue",
        source: "coast-road",
        path: window.CityMapPathsV3.smoothClosedPath(mainlandInset),
        points: [...mainlandInset, mainlandInset[0]],
        depth: 1,
        cut: coastCut
      });
    }

    const islandDistricts = makeIslandDistricts(
      terrain, mainlandDistricts.length, names, colors, rng, waterSegs
    );
    const districts = [...mainlandDistricts, ...islandDistricts];
    const cells = districts.flatMap(d => d.blocks);

    const rawRoadCuts = [
      ...enforced.spineCuts,
      ...districts.flatMap(d => d.rawCuts || []),
      ...districts.flatMap(d => d.roads || []).filter(r => r.source === "coast-road").map(r => r.cut)
    ].filter(Boolean);

    const bridgePlan = makeBridgePlan(terrain, validInset ? mainlandInset : null, rawRoadCuts);
    const bridgeAwareRoadCuts = bridgePlan.renderedCuts || rawRoadCuts;

    const riverBankCuts = waterBodiesOfKind(terrain, "river")
      .flatMap(river => window.CityMapWaterV3 && window.CityMapWaterV3.makeRiverBankRoads
        ? window.CityMapWaterV3.makeRiverBankRoads(river, terrain.mainland.polygon)
        : []);
    const lakeBankCuts = waterBodiesOfKind(terrain, "lake")
      .flatMap(lake => window.CityMapWaterV3 && window.CityMapWaterV3.makeLakeBankRoads
        ? window.CityMapWaterV3.makeLakeBankRoads(lake, terrain.mainland.polygon)
        : []);

    const roadEdges = [
      ...bridgeAwareRoadCuts.map((cut, i) => cutToRoad(cut, i, "v35-road")),
      ...riverBankCuts.map((cut, i) => cutToRoad(cut, i, "v35-river-bank")),
      ...lakeBankCuts.map((cut, i) => cutToRoad(cut, i, "v35-lake-bank"))
    ];
    const buildingPlan = buildStaticBuildings(cells, rng, terrain);
    const coastDocks = window.CityMapLandV3 && window.CityMapLandV3.generateCoastDocks
      ? window.CityMapLandV3.generateCoastDocks(terrain.mainland.polygon, window.makeRng(normalizedSeed ^ 0xd0c5), riverSegs)
      : [];

    return remember(key, {
      version: 3.5,
      architecture: "v35",
      seed: normalizedSeed,
      bounds: terrain.bounds,
      terrain, cells,
      neighborhoods: [],
      adjacency: {},
      roadGraph: {
        nodes: [],
        edges: roadEdges,
        bridgeCandidates: [],
        roadCells: [],
        blockedCells: cells.filter(c => !c.buildable).map(c => c.id),
        roadCorridors: []
      },
      districts,
      districtAdjacency: districtAdjacency(districts),
      cellDistrict: Object.fromEntries(cells.map(c => [c.id, c.districtId])),
      bridgePlan,
      coastDocks,
      buildingPlan
    });
  }

  function summarizeCityV35(city) {
    const data = city || buildCityV35(1);
    const roadKinds = {};
    for (const edge of data.roadGraph.edges) roadKinds[edge.kind] = (roadKinds[edge.kind] || 0) + 1;
    return {
      seed: data.seed,
      districts: data.districts.length,
      blocks: data.cells.length,
      buildableBlocks: data.cells.filter(c => c.buildable).length,
      ownedWater: data.districts.reduce((sum, d) => sum + d.waterPolygons.length, 0),
      roads: data.roadGraph.edges.length,
      roadKinds,
      bridges: data.bridgePlan.bridges.length,
      buildings: data.buildingPlan.buildings.length
    };
  }

  function clearCache() { cache.clear(); }

  window.CityMapV35 = { buildCityV35, summarizeCityV35, clearCache };
})();
