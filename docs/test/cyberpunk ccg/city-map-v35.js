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
    cutPath,
    rectPolygon
  } = window.CityMapPathsV3;
  const {
    splitPolygonByLine,
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

  // Generate a highway spine — a major road crossing land at a distinctive angle,
  // optionally with one bend (like Market Street through SF).
  // Always generated at least once per map so every city has a structural axis.
  function generateHighwaySpine(landPolygon, existingSpines, rng) {
    const bbox = polygonBBox(landPolygon);
    const HUGE = 4000;

    for (let attempt = 0; attempt < 55; attempt++) {
      // Angle: meaningfully different from any existing spine
      let angle;
      if (existingSpines.length > 0) {
        const base = existingSpines[0].dominantAngle;
        const minOff = Math.PI / 8; // 22.5° minimum separation
        const off = minOff + rng() * (Math.PI / 2.4 - minOff);
        angle = base + (rng() < 0.5 ? off : -off);
      } else {
        // Diagonal feel: 14–76° from horizontal
        angle = Math.PI * (0.08 + rng() * 0.35);
      }

      // Center point inside polygon
      const ox = bbox.minX + bbox.w * (0.2 + rng() * 0.6);
      const oy = bbox.minY + bbox.h * (0.2 + rng() * 0.6);
      if (!pointInPolygon({ x: ox, y: oy }, landPolygon)) continue;

      const dx = Math.cos(angle), dy = Math.sin(angle);
      const p1 = { x: ox - dx * HUGE, y: oy - dy * HUGE };
      const p2 = { x: ox + dx * HUGE, y: oy + dy * HUGE };
      // Filter out vertex-snapping hits (u near 0 or 1) to avoid polygon-corner issues
      const hits = linePolygonHits(p1, p2, landPolygon).filter(h => h.u > 0.02 && h.u < 0.98);
      if (hits.length < 2) continue;

      const entry = hits[0], exit = hits[hits.length - 1];
      const spineLen = Math.hypot(exit.x - entry.x, exit.y - entry.y);
      if (spineLen < Math.min(bbox.w, bbox.h) * 0.38) continue;

      // Optional bend (~72% of maps): gives the highway an organic character
      let interiorMids = [];
      if (rng() < 0.72 && spineLen > 90) {
        const t = 0.28 + rng() * 0.44;
        const bx = entry.x + (exit.x - entry.x) * t;
        const by = entry.y + (exit.y - entry.y) * t;
        const amp = Math.min(58, spineLen * (0.09 + rng() * 0.16));
        const side = rng() < 0.5 ? 1 : -1;
        const bend = { x: bx + (-dy) * amp * side, y: by + dx * amp * side };
        if (pointInPolygon(bend, landPolygon)) interiorMids = [bend];
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

    const rs = riverSpineFromTerrain(terrain, landPolygon);
    if (rs) spines.push(rs);

    // Always generate at least one highway spine
    const hw1 = generateHighwaySpine(landPolygon, spines, rng);
    if (hw1) spines.push(hw1);

    // More spines for maps without rivers; occasional multi-highway cities
    const wantMore = (!rs && rng() < 0.55) || (rs && rng() < 0.22);
    if (wantMore && spines.length < 3) {
      const hw2 = generateHighwaySpine(landPolygon, spines, rng);
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

    // Drop slivers; cap at 3 regions for game balance
    pool = pool.filter(r => polygonArea(r.polygon) > 1800);
    pool.sort((a, b) => polygonArea(b.polygon) - polygonArea(a.polygon));
    if (pool.length > 3) pool = pool.slice(0, 3);
    if (!pool.length) return { regions: [landPolygon], regionAngles: [0], spineCuts: [] };

    return {
      regions: pool.map(r => r.polygon),
      regionAngles: pool.map(r => r.angle ?? 0),
      spineCuts
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
    const footprint = rectPolygon(block.centroid.x, block.centroid.y, w, h, 0);
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

  function makeBlock(leaf, district, index, terrain) {
    const polygon = leaf.polygon;
    const centroid = interiorPoint(polygon);
    const area = polygonArea(polygon);
    const inWater = pointInWater(centroid, terrain);
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
      fieldAngle: 0, orientation: 0,
      leaf
    };
  }

  function makeDistrict(region, idx, names, colors, terrain, rng, landmassId = "mainland", gridAngle = 0, waterSegs = []) {
    const bspRoot = bspSubdivide(region, 2, gridAngle, rng);
    const leaves = leavesUnder(bspRoot);
    const base = {
      idx,
      id: `district-${idx + 1}`,
      name: names[idx % names.length],
      color: colors[idx % colors.length],
      landmassId,
      ownershipPolygon: region,
      ownershipPolygons: [region],
      polygon: region,
      polygonPath: polygonToPath(region),
      outlinePath: polygonOutlinePathClippedToViewport(region),
      area: polygonArea(region),
      centroid: interiorPoint(region),
      bbox: polygonBBox(region),
      bspRoot, blockTree: bspRoot,
      waterPolygons: ownedWaterPolygons(region, terrain),
      blocks: [], buildablePolygons: [], polygons: [],
      roads: [], slots: [], dots: [],
      labelAnchor: interiorPoint(region),
      labelPos: interiorPoint(region),
      labelText: names[idx % names.length],
      metadata: { architecture: "v35", blockGrammar: "v3-bsp" }
    };
    base.blocks = leaves.map((leaf, i) => makeBlock(leaf, base, i, terrain));
    base.buildablePolygons = base.blocks.filter(b => b.buildable).map(b => b.polygon);
    base.polygons = base.buildablePolygons;
    const rawCuts = collectAllCuts(bspRoot);
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
      const district = makeDistrict(
        landmass.polygon, startIdx + districts.length,
        names, colors, terrain, rng, landmass.id, angle, waterSegs
      );
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
      const count = block.density === "dense" && block.area > 260 ? 2 : 1;
      for (let i = 0; i < count; i++) buildings.push(makeBuildingForBlock(block, i, rng));
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

    // Generate spines: river (terrain) + highway (infrastructure), or just highway.
    // Spines divide land into regions AND define each region's street grid angle.
    // Different angles between adjacent regions produce SF-style triangular blocks
    // at district boundaries where the two grids meet.
    const spines = generateSpines(terrain, terrain.mainland.polygon, rng);
    const divided = spineBasedDivide(terrain.mainland.polygon, spines, rng);

    const regions = divided.regions;
    while (regions.length < 3) regions.push(regions[regions.length - 1]);

    const mainlandDistricts = regions.map((region, idx) =>
      makeDistrict(region, idx, names, colors, terrain, rng, "mainland",
        divided.regionAngles[idx] ?? 0, waterSegs)
    );

    const islandDistricts = makeIslandDistricts(
      terrain, mainlandDistricts.length, names, colors, rng, waterSegs
    );
    const districts = [...mainlandDistricts, ...islandDistricts];
    const cells = districts.flatMap(d => d.blocks);

    // Spine cuts become the highway roads; also truncate at water crossings
    const truncatedSpineCuts = waterSegs.length
      ? divided.spineCuts.flatMap(cut => truncateCutAtRiver(cut, waterSegs, 5))
      : divided.spineCuts;

    const roadEdges = [
      ...truncatedSpineCuts.map((cut, i) => cutToRoad(cut, i, "v35-spine")),
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
