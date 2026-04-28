(function () {
  "use strict";

  const {
    DISTRICT_NAMES,
    DISTRICT_COLORS
  } = window.CityMapConfigV3;

  const {
    polygonArea,
    polygonCentroid,
    polygonBBox,
    pointToSegmentDist
  } = window.CityMapGeometryV3;

  const DISTRICT_COUNT = 3;

  function dist(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function cellMap(cells) {
    const map = {};
    for (const cell of cells) map[cell.id] = cell;
    return map;
  }

  function unionBBox(cells) {
    const box = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
    for (const cell of cells) {
      const b = polygonBBox(cell.polygon);
      box.minX = Math.min(box.minX, b.minX);
      box.minY = Math.min(box.minY, b.minY);
      box.maxX = Math.max(box.maxX, b.maxX);
      box.maxY = Math.max(box.maxY, b.maxY);
    }
    box.w = box.maxX - box.minX;
    box.h = box.maxY - box.minY;
    return box;
  }

  function normalizedPoint(point, bbox) {
    return {
      x: (point.x - bbox.minX) / (bbox.w || 1),
      y: (point.y - bbox.minY) / (bbox.h || 1)
    };
  }

  function pickSeedCells(cells, rng) {
    const bbox = unionBBox(cells);
    const targets = [
      { x: bbox.minX + bbox.w * (0.23 + rng() * 0.12), y: bbox.minY + bbox.h * (0.24 + rng() * 0.18) },
      { x: bbox.minX + bbox.w * (0.72 + rng() * 0.10), y: bbox.minY + bbox.h * (0.28 + rng() * 0.18) },
      { x: bbox.minX + bbox.w * (0.48 + rng() * 0.16), y: bbox.minY + bbox.h * (0.70 + rng() * 0.13) }
    ];
    const seeds = [];
    for (const target of targets) {
      let best = null;
      for (const cell of cells) {
        if (seeds.includes(cell)) continue;
        const d = dist(target, cell.centroid);
        if (!best || d < best.d) best = { cell, d };
      }
      if (best) seeds.push(best.cell);
    }
    return seeds;
  }

  function shapeTemplates(rng) {
    const lVariants = ["l-nw", "l-ne", "l-sw", "l-se"];
    const cVariants = ["c-north", "c-south", "c-east", "c-west"];
    const roll = rng();
    if (roll < 0.42) {
      return [
        lVariants[Math.floor(rng() * lVariants.length)],
        "box",
        lVariants[Math.floor(rng() * lVariants.length)]
      ];
    }
    if (roll < 0.68) {
      return [
        cVariants[Math.floor(rng() * cVariants.length)],
        "box",
        lVariants[Math.floor(rng() * lVariants.length)]
      ];
    }
    return [
      lVariants[Math.floor(rng() * lVariants.length)],
      cVariants[Math.floor(rng() * cVariants.length)],
      "box"
    ];
  }

  function lShapeScore(p, variant) {
    const west = variant.endsWith("w");
    const north = variant.includes("n");
    const cx = west ? 0.08 : 0.92;
    const cy = north ? 0.10 : 0.90;
    const armX = Math.abs(p.x - cx);
    const armY = Math.abs(p.y - cy);
    const cornerPull = Math.hypot(p.x - cx, p.y - cy) * 0.18;
    const wrongCornerPenalty =
      (west ? Math.max(0, p.x - 0.72) : Math.max(0, 0.28 - p.x)) +
      (north ? Math.max(0, p.y - 0.72) : Math.max(0, 0.28 - p.y));
    return Math.min(armX, armY) + cornerPull + wrongCornerPenalty * 0.38;
  }

  function cShapeScore(p, variant) {
    if (variant === "c-north") return Math.min(p.y, p.x, 1 - p.x) + Math.max(0, p.y - 0.82) * 0.44;
    if (variant === "c-south") return Math.min(1 - p.y, p.x, 1 - p.x) + Math.max(0, 0.18 - p.y) * 0.44;
    if (variant === "c-east") return Math.min(1 - p.x, p.y, 1 - p.y) + Math.max(0, 0.18 - p.x) * 0.44;
    return Math.min(p.x, p.y, 1 - p.y) + Math.max(0, p.x - 0.82) * 0.44;
  }

  function patternScore(cell, seed, bbox, pattern) {
    const p = normalizedPoint(cell.centroid, bbox);
    const seedDist = dist(cell.centroid, seed.centroid) / Math.max(bbox.w, bbox.h, 1);
    if (pattern.startsWith("l-")) return lShapeScore(p, pattern) * 0.74 + seedDist * 0.62;
    if (pattern.startsWith("c-")) return cShapeScore(p, pattern) * 0.78 + seedDist * 0.58;
    return seedDist;
  }

  function initialAssignments(cells, seeds, patterns, rng) {
    const bbox = unionBBox(cells);
    const assignments = {};
    for (const cell of cells) {
      let best = null;
      for (let i = 0; i < seeds.length; i++) {
        const score = patternScore(cell, seeds[i], bbox, patterns[i]) + rng() * 0.015;
        if (!best || score < best.score) best = { district: i, score };
      }
      assignments[cell.id] = best ? best.district : 0;
    }
    seeds.forEach((seed, i) => { assignments[seed.id] = i; });
    return assignments;
  }

  function componentIds(startId, targetDistrict, assignments, byId, adjacency, seen) {
    const stack = [startId];
    const component = [];
    seen.add(startId);
    while (stack.length) {
      const id = stack.pop();
      component.push(id);
      for (const nid of adjacency[id] || []) {
        if (seen.has(nid) || !byId[nid] || assignments[nid] !== targetDistrict) continue;
        seen.add(nid);
        stack.push(nid);
      }
    }
    return component;
  }

  function repairConnectivity(cells, assignments, adjacency, districtCount) {
    const byId = cellMap(cells);
    for (let pass = 0; pass < 5; pass++) {
      let changed = false;
      for (let district = 0; district < districtCount; district++) {
        const ids = cells.filter(c => assignments[c.id] === district).map(c => c.id);
        if (ids.length <= 1) continue;
        const seen = new Set();
        const components = [];
        for (const id of ids) {
          if (!seen.has(id)) components.push(componentIds(id, district, assignments, byId, adjacency, seen));
        }
        if (components.length <= 1) continue;
        components.sort((a, b) => b.length - a.length);
        for (const component of components.slice(1)) {
          for (const id of component) {
            const neighborCounts = {};
            for (const nid of adjacency[id] || []) {
              if (assignments[nid] === district) continue;
              neighborCounts[assignments[nid]] = (neighborCounts[assignments[nid]] || 0) + 1;
            }
            let bestDistrict = district;
            let bestCount = -1;
            for (const [candidate, count] of Object.entries(neighborCounts)) {
              if (count > bestCount) {
                bestDistrict = Number(candidate);
                bestCount = count;
              }
            }
            if (bestDistrict !== district) {
              assignments[id] = bestDistrict;
              changed = true;
            }
          }
        }
      }
      if (!changed) break;
    }
  }

  function districtComponents(district, byId, adjacency) {
    const ids = district.cellIds;
    const idSet = new Set(ids);
    const seen = new Set();
    const components = [];
    for (const id of ids) {
      if (seen.has(id)) continue;
      const stack = [id];
      const component = [];
      seen.add(id);
      while (stack.length) {
        const current = stack.pop();
        component.push(current);
        for (const nid of adjacency[current] || []) {
          if (!idSet.has(nid) || seen.has(nid)) continue;
          seen.add(nid);
          stack.push(nid);
        }
      }
      components.push(component);
    }
    return components;
  }

  function labelAnchor(cellIds, byId) {
    let totalArea = 0;
    let x = 0, y = 0;
    for (const id of cellIds) {
      const cell = byId[id];
      totalArea += cell.area;
      x += cell.centroid.x * cell.area;
      y += cell.centroid.y * cell.area;
    }
    const target = { x: x / (totalArea || 1), y: y / (totalArea || 1) };
    let best = null;
    for (const id of cellIds) {
      const cell = byId[id];
      const d = dist(target, cell.centroid);
      if (!best || d < best.d) best = { cell, d };
    }
    return best ? best.cell.centroid : target;
  }

  function boundarySegments(cellIds, byId, adjacency) {
    const idSet = new Set(cellIds);
    const segments = [];
    for (const id of cellIds) {
      const cell = byId[id];
      for (let i = 0; i < cell.polygon.length; i++) {
        const a = cell.polygon[i];
        const b = cell.polygon[(i + 1) % cell.polygon.length];
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        let touchesSameDistrict = false;
        for (const nid of adjacency[id] || []) {
          if (!idSet.has(nid)) continue;
          const neighbor = byId[nid];
          for (let j = 0; j < neighbor.polygon.length; j++) {
            const c = neighbor.polygon[j];
            const d = neighbor.polygon[(j + 1) % neighbor.polygon.length];
            if (pointToSegmentDist(mid.x, mid.y, c, d) < 0.9) {
              touchesSameDistrict = true;
              break;
            }
          }
          if (touchesSameDistrict) break;
        }
        if (!touchesSameDistrict) segments.push({ a, b });
      }
    }
    return segments;
  }

  function buildDistrictObjects(cells, assignments, adjacency, patterns, rng) {
    const byId = cellMap(cells);
    const districts = [];
    for (let i = 0; i < DISTRICT_COUNT; i++) {
      const cellIds = cells.filter(c => assignments[c.id] === i).map(c => c.id);
      const polygons = cellIds.map(id => byId[id].polygon);
      const area = cellIds.reduce((sum, id) => sum + byId[id].area, 0);
      const bbox = unionBBox(cellIds.map(id => byId[id]));
      const district = {
        id: `district-${i + 1}`,
        name: DISTRICT_NAMES[Math.floor(rng() * DISTRICT_NAMES.length)],
        color: DISTRICT_COLORS[i % DISTRICT_COLORS.length],
        pattern: patterns[i],
        cellIds,
        polygons,
        area,
        bbox,
        centroid: labelAnchor(cellIds, byId),
        labelAnchor: labelAnchor(cellIds, byId),
        boundarySegments: boundarySegments(cellIds, byId, adjacency),
        components: []
      };
      district.components = districtComponents(district, byId, adjacency);
      district.shape = {
        componentCount: district.components.length,
        boundarySegmentCount: district.boundarySegments.length,
        cellCount: cellIds.length
      };
      districts.push(district);
    }
    return districts;
  }

  function districtAdjacency(districts, adjacency) {
    const cellToDistrict = {};
    for (const district of districts) {
      for (const cellId of district.cellIds) cellToDistrict[cellId] = district.id;
    }
    const graph = {};
    for (const district of districts) graph[district.id] = [];
    for (const district of districts) {
      const neighbors = new Set();
      for (const cellId of district.cellIds) {
        for (const nid of adjacency[cellId] || []) {
          const other = cellToDistrict[nid];
          if (other && other !== district.id) neighbors.add(other);
        }
      }
      graph[district.id] = Array.from(neighbors);
    }
    return graph;
  }

  function generateDistricts(roadResult, rng) {
    const cells = roadResult.cells.filter(c => c.landmassId === "mainland");
    const allCells = roadResult.cells;
    const seeds = pickSeedCells(cells, rng);
    const patterns = shapeTemplates(rng);
    const assignments = initialAssignments(cells, seeds, patterns, rng);

    for (const cell of allCells) {
      if (cell.landmassId === "mainland") continue;
      let best = null;
      for (const seed of seeds) {
        const d = dist(cell.centroid, seed.centroid);
        if (!best || d < best.d) best = { d, district: seeds.indexOf(seed) };
      }
      assignments[cell.id] = best ? best.district : 0;
    }

    repairConnectivity(allCells, assignments, roadResult.adjacency, DISTRICT_COUNT);
    const districts = buildDistrictObjects(allCells, assignments, roadResult.adjacency, patterns, rng);
    return {
      version: 1,
      districts,
      districtAdjacency: districtAdjacency(districts, roadResult.adjacency),
      cellDistrict: assignments
    };
  }

  function buildDistricts(seed = 1) {
    const normalizedSeed = Number.isFinite(seed) ? (seed >>> 0) || 1 : 1;
    const roadResult = window.CityMapRoadGraphV4.buildRoadGraph(normalizedSeed);
    const districts = generateDistricts(roadResult, window.makeRng(normalizedSeed ^ 0xd157));
    return { ...roadResult, ...districts };
  }

  function districtSummary(result) {
    return {
      districts: result.districts.length,
      cells: result.cells.length,
      assignedCells: Object.keys(result.cellDistrict).length,
      components: result.districts.reduce((sum, d) => sum + d.shape.componentCount, 0),
      patterns: result.districts.map(d => d.pattern),
      boundarySegments: result.districts.reduce((sum, d) => sum + d.boundarySegments.length, 0)
    };
  }

  window.CityMapDistrictsV4 = {
    DISTRICT_COUNT,
    buildDistricts,
    generateDistricts,
    districtSummary
  };
})();
