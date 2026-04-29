(function () {
  "use strict";

  const { VIEW_W, VIEW_H, DISTRICT_NAMES, DISTRICT_COLORS } = window.CityMapConfigV3;
  const {
    polygonArea,
    polygonCentroid,
    polygonBBox,
    pointInPolygon,
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

  function candidatePointsForBlocks(blocks, district, rng) {
    const targetPairs = slotPairsForArea(district.area);
    const points = blocks
      .filter(b => b.buildable && b.area > 140)
      .map(b => {
        const c = b.centroid;
        return {
          x: c.x, y: c.y, block: b,
          score: Math.abs(c.x - district.centroid.x) * 0.35 +
                 Math.abs(c.y - district.centroid.y) * 0.18 + rng() * 16
        };
      })
      .sort((a, b) => a.score - b.score);
    const them = [], you = [];
    for (const p of points) {
      const bucket = p.y < district.centroid.y ? them : you;
      if (bucket.length >= targetPairs) continue;
      const tooClose = [...them, ...you].some(e => Math.hypot(e.x - p.x, e.y - p.y) < 21);
      if (!tooClose) bucket.push(p);
      if (them.length >= targetPairs && you.length >= targetPairs) break;
    }
    for (const p of points) {
      if (them.length >= targetPairs && you.length >= targetPairs) break;
      const bucket = them.length < targetPairs ? them : you;
      const tooClose = [...them, ...you].some(e => Math.hypot(e.x - p.x, e.y - p.y) < 18);
      if (!tooClose) bucket.push(p);
    }
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
      path: d, points, depth: cut.depth, cut
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

  function makeBlock(leaf, district, index, terrain, gridAngle = 0) {
    const polygon = leaf.polygon;
    const centroid = interiorPoint(polygon);
    const area = polygonArea(polygon);
    const inWater = pointInWater(centroid, terrain);
    const longestAngle = polygonLongestEdgeAngle(polygon);
    return {
      id: `${district.id}:block:${index + 1}`,
      districtId: district.id,
      districtIdx: district.idx,
      landmassId: district.landmassId,
      polygon,
      path: polygonToPath(polygon),
      centroid, area,
      bbox: polygonBBox(polygon),
      density: area < 460 ? "dense" : area < 1100 ? "medium" : "sparse",
      buildable: !inWater && area > 80,
      tags: inWater ? ["waterReserve"] : ["buildable"],
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

  // extraPolygons: secondary polygons added to this district during a merge-down.
  // They are BSP-subdivided at the same gridAngle so their streets are coherent
  // with the primary polygon's grid — the merged district has one unified feel.
  function makeDistrict(region, idx, names, colors, terrain, rng, landmassId = "mainland", gridAngle = 0, waterSegs = [], extraPolygons = [], bspRegion = null) {
    // bspRegion is the inset polygon for block/building placement (keeps buildings
    // off the coastline). region is the full ownership polygon for hover/game logic.
    const effectiveBsp = bspRegion || region;
    const bspRoot = bspSubdivide(effectiveBsp, 2, gridAngle, rng);
    const leaves = leavesUnder(bspRoot);
    // Merged districts: BSP each secondary polygon at the same angle so
    // their internal streets feel like one coherent neighbourhood.
    const extraLeaves = extraPolygons.flatMap(ep => leavesUnder(bspSubdivide(ep, 2, gridAngle, rng)));
    const allLeaves = [...leaves, ...extraLeaves];
    const allOwnershipPolygons = [region, ...extraPolygons];
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
      labelAnchor: interiorPoint(region),
      labelPos: interiorPoint(region),
      labelText: names[idx % names.length],
      metadata: { architecture: "v35", blockGrammar: "v3-bsp", merged: extraPolygons.length > 0 }
    };
    base.blocks = allLeaves.map((leaf, i) => makeBlock(leaf, base, i, terrain, gridAngle));
    base.buildablePolygons = base.blocks.filter(b => b.buildable).map(b => b.polygon);
    base.polygons = base.buildablePolygons;
    // Collect BSP cuts from primary + all secondary polygons
    const allBspRoots = [bspRoot, ...extraPolygons.map(ep => bspSubdivide(ep, 2, gridAngle, rng))];
    const rawCuts = allBspRoots.flatMap(r => collectAllCuts(r));
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
      if (landmass.kind !== "island" || landmass.visibleArea < 1200) continue;
      const angle = (rng() - 0.5) * (Math.PI / 4); // islands get their own tilt
      
      const innerPolygon = window.CityMapGeometryV3.insetPolygon(landmass.polygon, 6);
      if (!innerPolygon || innerPolygon.length < 3 || polygonArea(innerPolygon) < 400) continue;
      
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

  function makeBridgePlan(terrain) {
    const bridges = (terrain.channels || [])
      .filter(ch => ch.bridgeAllowed && ch.centerline && ch.centerline.length >= 2)
      .map((ch, i) => {
        const a = ch.centerline[0], b = ch.centerline[ch.centerline.length - 1];
        return {
          id: `v35-bridge-${i + 1}`,
          channelId: ch.id,
          path: `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} L ${b.x.toFixed(2)} ${b.y.toFixed(2)}`,
          center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
          deckWidth: 4.8
        };
      });
    return { bridges };
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

  function buildStaticBuildings(blocks, rng) {
    const buildings = [], openSpaces = [];
    for (const block of blocks) {
      if (!block.buildable) {
        openSpaces.push({ id: `${block.id}:reserve`, kind: "setback", cellId: block.id });
        continue;
      }
      if (block.area > 1600 && rng() < 0.2) {
        openSpaces.push({ id: `${block.id}:park`, kind: "park", cellId: block.id });
        continue;
      }
      const generated = window.CityMapBuildingsV3.generateBlockBuildings(
        block.polygon, block.fieldAngle, rng, null, null, 7.0
      );
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
          shadow: { azimuth: -0.72, length: height * 0.58, opacity: Math.min(0.32, 0.07 + height / 100) },
          render: {
            extrudable: true, staticMesh: true,
            lodGroup: height > 18 ? "tower" : height > 9 ? "midrise" : "lowrise"
          }
        });
      });
    }
    return {
      buildings, openSpaces, landmarks: [],
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

    const mainlandDistricts = enforced.regions.map((region, idx) => {
      const inset = window.CityMapGeometryV3.insetPolygon(region, 6);
      const bspRegion = (inset && inset.length >= 3 && polygonArea(inset) > 400) ? inset : region;
      return makeDistrict(region, idx, names, colors, terrain, rng, "mainland",
        districtAngles[idx] ?? 0, waterSegs,
        enforced.regionSubPolygons[idx] || [], bspRegion);
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

    // Macro cuts become the highway/avenue roads; truncate at water
    const truncatedMacroCuts = waterSegs.length
      ? enforced.spineCuts.flatMap(cut => truncateCutAtRiver(cut, waterSegs, 5))
      : enforced.spineCuts;

    const roadEdges = [
      ...truncatedMacroCuts.map((cut, i) => cutToRoad(cut, i, "v35-macro")),
      ...districts.flatMap(d => d.roads)
    ];

    const bridgePlan = makeBridgePlan(terrain);
    const buildingPlan = buildStaticBuildings(cells, rng);

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
