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
    pointInPolygon,
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

  function makeDistrictNamePicker(rng) {
    const names = [...DISTRICT_NAMES];
    for (let i = names.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [names[i], names[j]] = [names[j], names[i]];
    }
    let index = 0;
    return function pickDistrictName() {
      if (index >= names.length) index = 0;
      return names[index++];
    };
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

  function assignmentCounts(cells, assignments) {
    const counts = new Array(DISTRICT_COUNT).fill(0);
    for (const cell of cells) {
      if (assignments[cell.id] !== undefined) counts[assignments[cell.id]]++;
    }
    return counts;
  }

  function rebalanceAssignments(cells, seeds, patterns, assignments, adjacency, rng) {
    const bbox = unionBBox(cells);
    const minCells = Math.max(18, Math.floor(cells.length * 0.18));
    const seedIds = new Set(seeds.map(seed => seed && seed.id).filter(Boolean));
    for (let pass = 0; pass < cells.length; pass++) {
      const counts = assignmentCounts(cells, assignments);
      let targetDistrict = 0;
      let donorDistrict = 0;
      for (let i = 1; i < DISTRICT_COUNT; i++) {
        if (counts[i] < counts[targetDistrict]) targetDistrict = i;
        if (counts[i] > counts[donorDistrict]) donorDistrict = i;
      }
      if (counts[targetDistrict] >= minCells) break;
      if (counts[donorDistrict] <= minCells + 3) break;
      if (!seeds[targetDistrict] || !seeds[donorDistrict]) break;

      let best = null;
      for (const cell of cells) {
        if (assignments[cell.id] !== donorDistrict || seedIds.has(cell.id)) continue;
        const touchesTarget = (adjacency[cell.id] || []).some(id => assignments[id] === targetDistrict);
        const targetScore = patternScore(cell, seeds[targetDistrict], bbox, patterns[targetDistrict]);
        const donorScore = patternScore(cell, seeds[donorDistrict], bbox, patterns[donorDistrict]);
        const seedPull = dist(cell.centroid, seeds[targetDistrict].centroid) / Math.max(bbox.w, bbox.h, 1);
        const score = targetScore - donorScore + seedPull * 0.24 + (touchesTarget ? -0.32 : 0.18) + rng() * 0.01;
        if (!best || score < best.score) best = { cell, score };
      }
      if (!best) break;
      assignments[best.cell.id] = targetDistrict;
    }
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

  function labelAnchor(cellIds, byId, displayPolygon) {
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
      if (displayPolygon && !pointInPolygon(cell.centroid, displayPolygon)) continue;
      const edge = displayPolygon ? pointEdgeDistance(cell.centroid, displayPolygon) : 0;
      const d = dist(target, cell.centroid);
      const score = d * 0.45 - edge * 1.6 + (cell.area < 520 ? 16 : 0);
      if (!best || score < best.score) best = { cell, d, score };
    }
    if (best) return best.cell.centroid;
    if (!displayPolygon || pointInPolygon(target, displayPolygon)) return target;
    let fallback = null;
    for (const id of cellIds) {
      const cell = byId[id];
      const d = dist(target, cell.centroid);
      if (!fallback || d < fallback.d) fallback = { cell, d };
    }
    return fallback ? fallback.cell.centroid : target;
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
        let touchesOtherDistrict = false;
        for (const nid of adjacency[id] || []) {
          const neighbor = byId[nid];
          if (!neighbor) continue;
          for (let j = 0; j < neighbor.polygon.length; j++) {
            const c = neighbor.polygon[j];
            const d = neighbor.polygon[(j + 1) % neighbor.polygon.length];
            if (pointToSegmentDist(mid.x, mid.y, c, d) < 0.9) {
              if (idSet.has(nid)) touchesSameDistrict = true;
              else touchesOtherDistrict = true;
              break;
            }
          }
          if (touchesSameDistrict) break;
        }
        if (!touchesSameDistrict && touchesOtherDistrict) segments.push({ a, b });
      }
    }
    return segments;
  }

  function polygonToPath(points) {
    if (!points || !points.length) return "";
    let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
    for (let i = 1; i < points.length; i++) d += ` L ${points[i].x.toFixed(2)} ${points[i].y.toFixed(2)}`;
    return d + " Z";
  }

  function displayPolygonForPattern(bbox, pattern) {
    const x0 = bbox.minX;
    const y0 = bbox.minY;
    const x1 = bbox.maxX;
    const y1 = bbox.maxY;
    const xm = x0 + bbox.w * 0.52;
    const ym = y0 + bbox.h * 0.52;
    const xa = x0 + bbox.w * 0.38;
    const xb = x0 + bbox.w * 0.62;
    const ya = y0 + bbox.h * 0.38;
    const yb = y0 + bbox.h * 0.62;

    if (pattern === "l-nw") return [
      { x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: ya },
      { x: xm, y: ya }, { x: xm, y: y1 }, { x: x0, y: y1 }
    ];
    if (pattern === "l-ne") return [
      { x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 },
      { x: xm, y: y1 }, { x: xm, y: ya }, { x: x0, y: ya }
    ];
    if (pattern === "l-sw") return [
      { x: x0, y: y0 }, { x: xm, y: y0 }, { x: xm, y: yb },
      { x: x1, y: yb }, { x: x1, y: y1 }, { x: x0, y: y1 }
    ];
    if (pattern === "l-se") return [
      { x: xm, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 },
      { x: x0, y: y1 }, { x: x0, y: yb }, { x: xm, y: yb }
    ];
    if (pattern === "c-north") return [
      { x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 },
      { x: xb, y: y1 }, { x: xb, y: yb }, { x: xa, y: yb },
      { x: xa, y: y1 }, { x: x0, y: y1 }
    ];
    if (pattern === "c-south") return [
      { x: x0, y: y0 }, { x: xa, y: y0 }, { x: xa, y: ya },
      { x: xb, y: ya }, { x: xb, y: y0 }, { x: x1, y: y0 },
      { x: x1, y: y1 }, { x: x0, y: y1 }
    ];
    if (pattern === "c-east") return [
      { x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: ya },
      { x: xb, y: ya }, { x: xb, y: yb }, { x: x1, y: yb },
      { x: x1, y: y1 }, { x: x0, y: y1 }
    ];
    if (pattern === "c-west") return [
      { x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 },
      { x: x0, y: y1 }, { x: x0, y: yb }, { x: xa, y: yb },
      { x: xa, y: ya }, { x: x0, y: ya }
    ];
    return [
      { x: x0, y: y0 },
      { x: x1, y: y0 },
      { x: x1, y: y1 },
      { x: x0, y: y1 }
    ];
  }

  function pointEdgeDistance(point, polygon) {
    let best = Infinity;
    for (let i = 0; i < polygon.length; i++) {
      best = Math.min(best, pointToSegmentDist(point.x, point.y, polygon[i], polygon[(i + 1) % polygon.length]));
    }
    return best;
  }

  function slotPairsForArea(area) {
    if (area > 56000) return 5;
    if (area > 36000) return 4;
    if (area > 21000) return 3;
    return 2;
  }

  function makeSlotCandidates(displayPolygon, bbox, labelPoint, owner, rng, relaxed = false) {
    const candidates = [];
    const targetY = owner === "them" ? bbox.minY + bbox.h * 0.27 : bbox.minY + bbox.h * 0.73;
    const targetX = bbox.minX + bbox.w * (0.32 + rng() * 0.36);
    const step = 12;
    for (let x = bbox.minX + 16; x <= bbox.maxX - 16; x += step) {
      for (let y = bbox.minY + 18; y <= bbox.maxY - 18; y += step) {
        const point = {
          x: x + (rng() - 0.5) * 4,
          y: y + (rng() - 0.5) * 4
        };
        if (!pointInPolygon(point, displayPolygon)) continue;
        const edge = pointEdgeDistance(point, displayPolygon);
        if (edge < (relaxed ? 7 : 16)) continue;
        const labelDist = dist(point, labelPoint);
        if (labelDist < (relaxed ? 18 : 30)) continue;
        candidates.push({
          point,
          score: Math.abs(point.y - targetY) * 1.25 + Math.abs(point.x - targetX) * 0.42 - edge * 0.12 + rng() * 8
        });
      }
    }
    return candidates.sort((a, b) => a.score - b.score);
  }

  function generateSlotsForDistrict(district, districtIdx, rng) {
    const pairs = slotPairsForArea(district.area);
    const slots = [];
    for (const owner of ["them", "you"]) {
      const candidates = [
        ...makeSlotCandidates(district.displayPolygon, district.bbox, district.labelAnchor, owner, rng),
        ...makeSlotCandidates(district.displayPolygon, district.bbox, district.labelAnchor, owner, rng, true)
      ];
      for (const candidate of candidates) {
        if (slots.filter(slot => slot.owner === owner).length >= pairs) break;
        const tooClose = slots.some(slot => dist(slot, candidate.point) < 20);
        if (tooClose) continue;
        slots.push({
          id: `V4D${districtIdx}-${owner}-${slots.filter(slot => slot.owner === owner).length}`,
          districtIdx,
          districtId: district.id,
          owner,
          x: candidate.point.x,
          y: candidate.point.y
        });
      }
      while (slots.filter(slot => slot.owner === owner).length < pairs) {
        const count = slots.filter(slot => slot.owner === owner).length;
        const y = owner === "them"
          ? district.bbox.minY + district.bbox.h * (0.22 + count * 0.08)
          : district.bbox.minY + district.bbox.h * (0.78 - count * 0.08);
        const x = district.bbox.minX + district.bbox.w * (0.28 + (count % 3) * 0.22);
        const fallback = pointInPolygon({ x, y }, district.displayPolygon)
          ? { x, y }
          : {
            x: district.labelAnchor.x + (count - 0.5) * 18,
            y: district.labelAnchor.y + (owner === "them" ? -26 - count * 6 : 26 + count * 6)
          };
        slots.push({
          id: `V4D${districtIdx}-${owner}-${count}`,
          districtIdx,
          districtId: district.id,
          owner,
          x: fallback.x,
          y: fallback.y
        });
      }
    }
    return slots;
  }

  function buildDistrictObjects(cells, assignments, adjacency, patterns, rng, pickDistrictName) {
    const byId = cellMap(cells);
    const districts = [];
    for (let i = 0; i < DISTRICT_COUNT; i++) {
      const cellIds = cells.filter(c => assignments[c.id] === i).map(c => c.id);
      const polygons = cellIds.map(id => byId[id].polygon);
      const area = cellIds.reduce((sum, id) => sum + byId[id].area, 0);
      const bbox = unionBBox(cellIds.map(id => byId[id]));
      const displayPolygon = displayPolygonForPattern(bbox, patterns[i]);
      const label = labelAnchor(cellIds, byId, displayPolygon);
      const district = {
        id: `district-${i + 1}`,
        name: pickDistrictName(),
        color: DISTRICT_COLORS[i % DISTRICT_COLORS.length],
        pattern: patterns[i],
        cellIds,
        polygons,
        area,
        bbox,
        centroid: label,
        labelAnchor: label,
        boundarySegments: boundarySegments(cellIds, byId, adjacency),
        displayPolygon,
        // displayOutlinePath is intentionally not exported; displayPolygon is a slot/label envelope, not a drawable district border.
        // displayOutlinePath: polygonToPath(displayPolygon),
        slots: [],
        dots: [],
        components: []
      };
      district.slots = generateSlotsForDistrict(district, i, rng);
      district.dots = district.slots;
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

  function buildLandmassDistrictObjects(allCells, adjacency, terrain, rng, startIndex, pickDistrictName) {
    const byId = cellMap(allCells);
    const byLandmass = {};
    for (const cell of allCells) {
      if (cell.landmassId === "mainland") continue;
      if (!byLandmass[cell.landmassId]) byLandmass[cell.landmassId] = [];
      byLandmass[cell.landmassId].push(cell);
    }
    const landmassById = {};
    for (const landmass of terrain.landmasses || []) landmassById[landmass.id] = landmass;
    const districts = [];
    for (const [landmassId, landmassCells] of Object.entries(byLandmass)) {
      if (landmassCells.length < 2) continue;
      const districtIdx = startIndex + districts.length;
      const cellIds = landmassCells.map(cell => cell.id);
      const area = cellIds.reduce((sum, id) => sum + byId[id].area, 0);
      if (area < 1500) continue;
      const bbox = unionBBox(landmassCells);
      const landmass = landmassById[landmassId];
      const displayPolygon = landmass && landmass.polygon ? landmass.polygon : displayPolygonForPattern(bbox, "box");
      const label = labelAnchor(cellIds, byId, displayPolygon);
      const district = {
        id: `district-${districtIdx + 1}`,
        name: pickDistrictName(),
        color: DISTRICT_COLORS[districtIdx % DISTRICT_COLORS.length],
        pattern: "landmass",
        landmassId,
        cellIds,
        polygons: cellIds.map(id => byId[id].polygon),
        area,
        bbox,
        centroid: label,
        labelAnchor: label,
        boundarySegments: [],
        displayPolygon,
        // displayOutlinePath is intentionally not exported; displayPolygon is a slot/label envelope, not a drawable district border.
        // displayOutlinePath: polygonToPath(displayPolygon),
        slots: [],
        dots: [],
        components: districtComponents({ cellIds }, byId, adjacency)
      };
      district.slots = generateSlotsForDistrict(district, districtIdx, rng);
      district.dots = district.slots;
      district.shape = {
        componentCount: district.components.length,
        boundarySegmentCount: 0,
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
    const seeds = pickSeedCells(cells, rng);
    const patterns = shapeTemplates(rng);
    const assignments = initialAssignments(cells, seeds, patterns, rng);
    const pickDistrictName = makeDistrictNamePicker(rng);

    rebalanceAssignments(cells, seeds, patterns, assignments, roadResult.adjacency, rng);
    repairConnectivity(cells, assignments, roadResult.adjacency, DISTRICT_COUNT);
    rebalanceAssignments(cells, seeds, patterns, assignments, roadResult.adjacency, rng);
    repairConnectivity(cells, assignments, roadResult.adjacency, DISTRICT_COUNT);
    const districts = [
      ...buildDistrictObjects(cells, assignments, roadResult.adjacency, patterns, rng, pickDistrictName),
      ...buildLandmassDistrictObjects(roadResult.cells, roadResult.adjacency, roadResult.terrain, rng, DISTRICT_COUNT, pickDistrictName)
    ];
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
