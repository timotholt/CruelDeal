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

  function snapGridAngle(angle) {
    return Math.round(angle / (Math.PI / 2)) * (Math.PI / 2);
  }

  function signedTriArea(a, b, c) {
    return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  }

  function strictSegmentIntersect(a, b, c, d) {
    const ab1 = signedTriArea(a, b, c);
    const ab2 = signedTriArea(a, b, d);
    const cd1 = signedTriArea(c, d, a);
    const cd2 = signedTriArea(c, d, b);
    if (Math.abs(ab1) < 1e-7 || Math.abs(ab2) < 1e-7 || Math.abs(cd1) < 1e-7 || Math.abs(cd2) < 1e-7) return false;
    return ((ab1 > 0) !== (ab2 > 0)) && ((cd1 > 0) !== (cd2 > 0));
  }

  function isSimplePolygon(poly) {
    if (!poly || poly.length < 3) return false;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      if (!Number.isFinite(a.x) || !Number.isFinite(a.y)) return false;
      for (let j = i + 1; j < poly.length; j++) {
        const adjacent = Math.abs(i - j) <= 1 || (i === 0 && j === poly.length - 1);
        if (adjacent) continue;
        const c = poly[j];
        const d = poly[(j + 1) % poly.length];
        if (strictSegmentIntersect(a, b, c, d)) return false;
      }
    }
    return true;
  }

  function isUsablePolygon(poly) {
    return isSimplePolygon(poly) && polygonArea(poly) >= MIN_CELL_AREA;
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
    if (!isUsablePolygon(a) || !isUsablePolygon(b)) return null;
    const sourceArea = polygonArea(poly);
    const splitArea = polygonArea(a) + polygonArea(b);
    if (sourceArea > 0 && Math.abs(splitArea - sourceArea) / sourceArea > 0.025) return null;
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

  function densityFromField(sample, rng) {
    if (!sample) {
      const densityRoll = rng();
      return densityRoll < 0.28 ? "sparse" : densityRoll < 0.78 ? "medium" : "dense";
    }
    if (sample.avoidSteepTerrain || sample.density === "sparse") return rng() < 0.78 ? "sparse" : "medium";
    if (sample.density === "dense") return rng() < 0.68 ? "dense" : "medium";
    const densityRoll = rng();
    return densityRoll < 0.2 ? "sparse" : densityRoll < 0.82 ? "medium" : "dense";
  }

  function seedNeighborhoodsForLandmass(landmass, terrain, field, rng) {
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
      const sample = field && field.sample ? field.sample(p) : null;
      const density = densityFromField(sample, rng);
      seeds.push({
        id: `${landmass.id}:hood:${seeds.length + 1}`,
        landmassId: landmass.id,
        seedPoint: p,
        orientation: sample ? sample.primaryAngle : rng() * Math.PI,
        secondaryOrientation: sample ? sample.secondaryAngle : null,
        fieldElementIds: sample ? sample.fieldElementIds : [],
        density,
        targetArea: density === "dense" ? 500 + rng() * 260 : density === "medium" ? 760 + rng() * 360 : 1180 + rng() * 620,
        cells: []
      });
    }
    if (!seeds.length) {
      const seedPoint = polygonCentroid(landmass.polygon);
      const sample = field && field.sample ? field.sample(seedPoint) : null;
      seeds.push({
        id: `${landmass.id}:hood:1`,
        landmassId: landmass.id,
        seedPoint,
        orientation: sample ? sample.primaryAngle : rng() * Math.PI,
        secondaryOrientation: sample ? sample.secondaryAngle : null,
        fieldElementIds: sample ? sample.fieldElementIds : [],
        density: densityFromField(sample, rng),
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

  function chooseSplitAngle(item, hood, field, rng) {
    const centroid = polygonCentroid(item.polygon);
    const sample = field && field.sample ? field.sample(centroid) : null;
    const primary = sample ? sample.primaryAngle : hood.orientation;
    const secondary = sample ? sample.secondaryAngle : (hood.secondaryOrientation || primary + Math.PI / 2);
    const axis = snapGridAngle(item.depth % 2 === 0 ? primary : secondary);
    const jitter = sample && sample.strength > 0.62 ? 0.025 : 0.045;
    return axis + (rng() - 0.5) * jitter;
  }

  function subdivideNeighborhood(poly, hood, field, rng) {
    const stack = [{ polygon: poly, depth: 0 }];
    const cells = [];
    const maxDepth = hood.density === "dense" ? 9 : hood.density === "medium" ? 8 : 7;
    while (stack.length) {
      const item = stack.pop();
      const area = polygonArea(item.polygon);
      const shouldSplit = area > hood.targetArea * (0.78 + rng() * 0.46) && item.depth < maxDepth;
      if (!shouldSplit) {
        cells.push(item.polygon);
        continue;
      }
      const jitteredAngle = chooseSplitAngle(item, hood, field, rng);
      const bbox = polygonBBox(item.polygon);
      const span = Math.max(bbox.w, bbox.h);
      const offset = (rng() - 0.5) * span * 0.11;
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

  function makeCell(rawId, polygon, landmass, hood, terrain, field) {
    if (!isUsablePolygon(polygon)) return null;
    const area = polygonArea(polygon);
    const centroid = polygonCentroid(polygon);
    if (!pointInPolygon(centroid, landmass.polygon)) return null;
    if (waterConflict(centroid, terrain)) return null;
    const tags = ["buildable", ...waterTags(centroid, polygon, terrain)];
    const sample = field && field.sample ? field.sample(centroid) : null;
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
      orientation: sample ? sample.primaryAngle : hood.orientation,
      fieldAngle: sample ? sample.primaryAngle : hood.orientation,
      secondaryFieldAngle: sample ? sample.secondaryAngle : (hood.secondaryOrientation || hood.orientation + Math.PI / 2),
      fieldStrength: sample ? sample.strength : 0,
      fieldElementIds: sample ? sample.fieldElementIds : hood.fieldElementIds || [],
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

  function generateCells(terrain, fieldOrRng, maybeRng) {
    const field = maybeRng ? fieldOrRng : null;
    const rng = maybeRng || fieldOrRng;
    const cells = [];
    const neighborhoods = [];
    for (const landmass of terrain.landmasses) {
      const hoods = seedNeighborhoodsForLandmass(landmass, terrain, field, rng);
      neighborhoods.push(...hoods);
      const hoodPolys = buildNeighborhoodPolygons(landmass, hoods);
      for (const { hood, polygon } of hoodPolys) {
        const polys = subdivideNeighborhood(polygon, hood, field, rng);
        for (const poly of polys) {
          const cell = makeCell(`${landmass.id}:cell:${cells.length + 1}`, poly, landmass, hood, terrain, field);
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
    const field = window.CityMapFieldV4.buildField(normalizedSeed, terrain);
    const cells = generateCells(terrain, field, window.makeRng(normalizedSeed ^ 0x51c0115));
    return { terrain, field, ...cells };
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
