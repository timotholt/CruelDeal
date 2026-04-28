(function () {
  "use strict";

  const {
    VIEW_W,
    VIEW_H
  } = window.CityMapConfigV3;

  const {
    pointInPolygon,
    polygonArea,
    polygonCentroid,
    polygonBBox,
    polygonToPolygonDist,
    pointToSegmentDist,
    pointToPolygonSignedDist,
    distToRiver
  } = window.CityMapGeometryV3;

  const {
    polygonToPath
  } = window.CityMapPathsV3;

  const MIN_CELL_AREA = 90;
  const MIN_NEIGHBORHOOD_SEPARATION = 52;

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function polygonEdges(polygon) {
    const edges = [];
    for (let i = 0; i < polygon.length; i++) {
      edges.push({ a: polygon[i], b: polygon[(i + 1) % polygon.length] });
    }
    return edges;
  }

  function clipPolygonHalfPlane(poly, point, normal, keepPositive) {
    if (!poly || poly.length < 3) return [];
    const value = (p) => (p.x - point.x) * normal.x + (p.y - point.y) * normal.y;
    const inside = (v) => keepPositive ? v >= -1e-7 : v <= 1e-7;
    const out = [];
    for (let i = 0; i < poly.length; i++) {
      const cur = poly[i];
      const prev = poly[(i - 1 + poly.length) % poly.length];
      const cv = value(cur);
      const pv = value(prev);
      const curInside = inside(cv);
      const prevInside = inside(pv);
      if (curInside !== prevInside) {
        const t = pv / (pv - cv || 1e-9);
        out.push({
          x: prev.x + (cur.x - prev.x) * t,
          y: prev.y + (cur.y - prev.y) * t
        });
      }
      if (curInside) out.push(cur);
    }
    return dedupePolygon(out);
  }

  function dedupePolygon(poly) {
    const out = [];
    for (const p of poly) {
      const last = out[out.length - 1];
      if (!last || Math.hypot(last.x - p.x, last.y - p.y) > 0.08) out.push(p);
    }
    if (out.length > 2) {
      const first = out[0];
      const last = out[out.length - 1];
      if (Math.hypot(first.x - last.x, first.y - last.y) <= 0.08) out.pop();
    }
    return out;
  }

  function splitPolygon(poly, angle, offset) {
    const centroid = polygonCentroid(poly);
    const normal = { x: -Math.sin(angle), y: Math.cos(angle) };
    const point = {
      x: centroid.x + normal.x * offset,
      y: centroid.y + normal.y * offset
    };
    const a = clipPolygonHalfPlane(poly, point, normal, true);
    const b = clipPolygonHalfPlane(poly, point, normal, false);
    if (a.length < 3 || b.length < 3) return null;
    if (polygonArea(a) < MIN_CELL_AREA || polygonArea(b) < MIN_CELL_AREA) return null;
    return [a, b];
  }

  function waterConflict(point, terrain) {
    for (const body of terrain.waterBodies) {
      if (body.kind === "lake" && body.polygon && pointInPolygon(point, body.polygon)) return true;
      if (body.kind === "river" && body.segments && distToRiver(point.x, point.y, body.segments) < (body.outerWidth || 8) * 0.5 + 3) {
        return true;
      }
    }
    return false;
  }

  function waterTags(point, polygon, terrain) {
    const tags = [];
    for (const body of terrain.waterBodies) {
      if (body.kind === "river" && body.segments) {
        const d = distToRiver(point.x, point.y, body.segments);
        if (d < (body.outerWidth || 8) * 0.5 + 18) tags.push("riverfront");
      }
      if (body.kind === "lake" && body.polygon) {
        const d = Math.max(0, pointToPolygonSignedDist(point, body.polygon) * -1);
        if (!pointInPolygon(point, body.polygon) && d < 18) tags.push("lakefront");
      }
    }
    if (terrain.coastline && terrain.coastline.edges) {
      let coastDist = Infinity;
      for (const edge of terrain.coastline.edges) {
        coastDist = Math.min(coastDist, pointToSegmentDist(point.x, point.y, edge.a, edge.b));
      }
      if (coastDist < 16) tags.push("coast");
    }
    const elevation = window.CityMapTerrainV4.sampleElevation(point.x, point.y, terrain);
    if (elevation > 0.28) tags.push("hill");
    if (polygonArea(polygon) > 1450 || tags.includes("coast") || elevation > 0.22) tags.push("parkCandidate");
    return tags;
  }

  function randomPointInPolygon(polygon, rng, terrain, requireBuildable = true) {
    const bbox = polygonBBox(polygon);
    for (let attempt = 0; attempt < 140; attempt++) {
      const p = {
        x: bbox.minX + rng() * bbox.w,
        y: bbox.minY + rng() * bbox.h
      };
      if (!pointInPolygon(p, polygon)) continue;
      if (requireBuildable && waterConflict(p, terrain)) continue;
      return p;
    }
    return polygonCentroid(polygon);
  }

  function seedNeighborhoodsForLandmass(landmass, terrain, rng) {
    const baseCount = clamp(Math.round(landmass.visibleArea / 26000), landmass.kind === "island" ? 1 : 4, landmass.kind === "island" ? 3 : 8);
    const seeds = [];
    for (let attempt = 0; attempt < baseCount * 80 && seeds.length < baseCount; attempt++) {
      const p = randomPointInPolygon(landmass.polygon, rng, terrain);
      let separated = true;
      for (const s of seeds) {
        if (Math.hypot(s.seedPoint.x - p.x, s.seedPoint.y - p.y) < MIN_NEIGHBORHOOD_SEPARATION) {
          separated = false;
          break;
        }
      }
      if (!separated) continue;
      const densityRoll = rng();
      const density = densityRoll < 0.28 ? "sparse" : densityRoll < 0.78 ? "medium" : "dense";
      seeds.push({
        id: `${landmass.id}:hood:${seeds.length + 1}`,
        landmassId: landmass.id,
        seedPoint: p,
        orientation: rng() * Math.PI,
        density,
        targetArea: density === "dense" ? 620 + rng() * 300 : density === "medium" ? 950 + rng() * 460 : 1550 + rng() * 900,
        cells: []
      });
    }
    if (!seeds.length) {
      seeds.push({
        id: `${landmass.id}:hood:1`,
        landmassId: landmass.id,
        seedPoint: polygonCentroid(landmass.polygon),
        orientation: rng() * Math.PI,
        density: "medium",
        targetArea: 1100,
        cells: []
      });
    }
    return seeds;
  }

  function buildNeighborhoodPolygons(landmass, neighborhoods) {
    return neighborhoods.map((hood) => {
      let poly = landmass.polygon;
      for (const other of neighborhoods) {
        if (other === hood) continue;
        const mx = (hood.seedPoint.x + other.seedPoint.x) / 2;
        const my = (hood.seedPoint.y + other.seedPoint.y) / 2;
        const nx = other.seedPoint.x - hood.seedPoint.x;
        const ny = other.seedPoint.y - hood.seedPoint.y;
        poly = clipPolygonHalfPlane(poly, { x: mx, y: my }, { x: nx, y: ny }, false);
        if (poly.length < 3) break;
      }
      return { hood, polygon: poly };
    }).filter(item => item.polygon.length >= 3 && polygonArea(item.polygon) > MIN_CELL_AREA * 2);
  }

  function subdivideNeighborhood(poly, hood, rng) {
    const stack = [{ polygon: poly, depth: 0 }];
    const cells = [];
    const maxDepth = hood.density === "dense" ? 8 : hood.density === "medium" ? 7 : 6;
    while (stack.length) {
      const item = stack.pop();
      const area = polygonArea(item.polygon);
      const shouldSplit = area > hood.targetArea * (0.82 + rng() * 0.58) && item.depth < maxDepth;
      if (!shouldSplit) {
        cells.push(item.polygon);
        continue;
      }
      const axis = item.depth % 2 === 0 ? hood.orientation : hood.orientation + Math.PI / 2;
      const jitteredAngle = axis + (rng() - 0.5) * 0.32;
      const bbox = polygonBBox(item.polygon);
      const span = Math.max(bbox.w, bbox.h);
      const offset = (rng() - 0.5) * span * 0.18;
      const split = splitPolygon(item.polygon, jitteredAngle, offset);
      if (!split) {
        cells.push(item.polygon);
        continue;
      }
      stack.push({ polygon: split[0], depth: item.depth + 1 });
      stack.push({ polygon: split[1], depth: item.depth + 1 });
    }
    return cells;
  }

  function findNearestChannel(point, terrain) {
    let best = null;
    for (const channel of terrain.channels || []) {
      for (const p of channel.centerline || []) {
        const d = Math.hypot(point.x - p.x, point.y - p.y);
        if (!best || d < best.d) best = { d, channel };
      }
    }
    return best;
  }

  function makeCell(rawId, polygon, landmass, hood, terrain) {
    const area = polygonArea(polygon);
    if (area < MIN_CELL_AREA) return null;
    const centroid = polygonCentroid(polygon);
    if (!pointInPolygon(centroid, landmass.polygon)) return null;
    if (waterConflict(centroid, terrain)) return null;
    const tags = ["buildable", ...waterTags(centroid, polygon, terrain)];
    if (landmass.kind === "island") tags.push("island");
    const channel = findNearestChannel(centroid, terrain);
    if (channel && channel.d < 34) tags.push("bridgeheadCandidate");
    return {
      id: rawId,
      polygon,
      path: polygonToPath(polygon),
      centroid,
      area,
      landmassId: landmass.id,
      neighborhoodId: hood.id,
      density: hood.density,
      orientation: hood.orientation,
      tags: Array.from(new Set(tags)),
      neighbors: []
    };
  }

  function buildAdjacency(cells) {
    const adjacency = {};
    for (const cell of cells) adjacency[cell.id] = [];
    for (let i = 0; i < cells.length; i++) {
      for (let j = i + 1; j < cells.length; j++) {
        const a = cells[i];
        const b = cells[j];
        const centerDist = Math.hypot(a.centroid.x - b.centroid.x, a.centroid.y - b.centroid.y);
        if (centerDist > 95) continue;
        if (polygonToPolygonDist(a.polygon, b.polygon) <= 0.9) {
          adjacency[a.id].push(b.id);
          adjacency[b.id].push(a.id);
        }
      }
    }
    for (const cell of cells) {
      if (adjacency[cell.id].length || cells.length <= 1) continue;
      let best = null;
      for (const other of cells) {
        if (other === cell || other.landmassId !== cell.landmassId) continue;
        const d = Math.hypot(cell.centroid.x - other.centroid.x, cell.centroid.y - other.centroid.y);
        if (!best || d < best.d) best = { cell: other, d };
      }
      if (best) {
        adjacency[cell.id].push(best.cell.id);
        adjacency[best.cell.id].push(cell.id);
      }
    }
    for (const cell of cells) cell.neighbors = adjacency[cell.id];
    return adjacency;
  }

  function generateCells(terrain, rng) {
    const cells = [];
    const neighborhoods = [];
    for (const landmass of terrain.landmasses) {
      const hoods = seedNeighborhoodsForLandmass(landmass, terrain, rng);
      neighborhoods.push(...hoods);
      const hoodPolys = buildNeighborhoodPolygons(landmass, hoods);
      for (const { hood, polygon } of hoodPolys) {
        const polys = subdivideNeighborhood(polygon, hood, rng);
        for (const poly of polys) {
          const cell = makeCell(`${landmass.id}:cell:${cells.length + 1}`, poly, landmass, hood, terrain);
          if (!cell) continue;
          cells.push(cell);
          hood.cells.push(cell.id);
        }
      }
    }
    return {
      version: 1,
      terrainVersion: terrain.version,
      cells,
      neighborhoods,
      adjacency: buildAdjacency(cells)
    };
  }

  function buildCells(seed = 1) {
    const normalizedSeed = Number.isFinite(seed) ? (seed >>> 0) || 1 : 1;
    const terrain = window.CityMapTerrainV4.buildTerrain(normalizedSeed);
    const cells = generateCells(terrain, window.makeRng(normalizedSeed ^ 0x51c0115));
    return { terrain, ...cells };
  }

  function cellSummary(result) {
    const counts = {};
    for (const cell of result.cells) {
      for (const tag of cell.tags) counts[tag] = (counts[tag] || 0) + 1;
    }
    return {
      cells: result.cells.length,
      neighborhoods: result.neighborhoods.length,
      avgNeighbors: result.cells.length
        ? result.cells.reduce((sum, c) => sum + c.neighbors.length, 0) / result.cells.length
        : 0,
      tags: counts
    };
  }

  window.CityMapCellsV4 = {
    MIN_CELL_AREA,
    buildCells,
    generateCells,
    cellSummary
  };
})();
