(function () {
  "use strict";

  const {
    VIEW_W,
    VIEW_H
  } = window.CityMapConfigV3;

  const {
    pointToSegmentDist,
    polygonToPolygonDist
  } = window.CityMapGeometryV3;

  const {
    smoothPolylinePath,
    straightPolylinePath,
    offsetPolyline
  } = window.CityMapPathsV3;

  const HIGHWAY_TARGETS_PER_LANDMASS = 1;
  const AVENUE_TARGETS_PER_NEIGHBORHOOD = 2;

  function dist(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function cellMap(cells) {
    const map = {};
    for (const cell of cells) map[cell.id] = cell;
    return map;
  }

  function cellsByLandmass(cells) {
    const groups = {};
    for (const cell of cells) {
      if (!groups[cell.landmassId]) groups[cell.landmassId] = [];
      groups[cell.landmassId].push(cell);
    }
    return groups;
  }

  function nearestCell(point, cells) {
    let best = null;
    for (const cell of cells) {
      const d = dist(point, cell.centroid);
      if (!best || d < best.d) best = { cell, d };
    }
    return best ? best.cell : null;
  }

  function farthestCell(fromCell, cells, predicate = () => true) {
    let best = null;
    for (const cell of cells) {
      if (cell === fromCell || !predicate(cell)) continue;
      const d = dist(fromCell.centroid, cell.centroid);
      if (!best || d > best.d) best = { cell, d };
    }
    return best ? best.cell : null;
  }

  function edgeCost(a, b, kind) {
    const base = dist(a.centroid, b.centroid);
    let cost = base;

    if (a.tags.includes("riverfront") || b.tags.includes("riverfront")) cost *= kind === "highway" ? 1.26 : 1.08;
    if (a.tags.includes("hill") || b.tags.includes("hill")) cost *= kind === "highway" ? 1.32 : 1.14;
    if (a.tags.includes("parkCandidate") || b.tags.includes("parkCandidate")) cost *= 1.06;
    return cost;
  }

  function shortestCellPath(startId, endId, cells, adjacency, kind) {
    if (startId === endId) return [startId];
    const byId = cellMap(cells);
    const q = new Set(cells.map(c => c.id));
    const score = {};
    const prev = {};
    for (const id of q) score[id] = Infinity;
    score[startId] = 0;

    while (q.size) {
      let current = null;
      for (const id of q) {
        if (!current || score[id] < score[current]) current = id;
      }
      if (!current || score[current] === Infinity) break;
      if (current === endId) break;
      q.delete(current);
      for (const nid of adjacency[current] || []) {
        if (!q.has(nid)) continue;
        const alt = score[current] + edgeCost(byId[current], byId[nid], kind);
        if (alt < score[nid]) {
          score[nid] = alt;
          prev[nid] = current;
        }
      }
    }

    if (!prev[endId]) return [];
    const path = [endId];
    let cur = endId;
    while (cur !== startId) {
      cur = prev[cur];
      if (!cur) return [];
      path.push(cur);
    }
    return path.reverse();
  }

  function simplifyPoints(points, minStep) {
    if (points.length <= 2) return points;
    const out = [points[0]];
    for (let i = 1; i < points.length - 1; i++) {
      const last = out[out.length - 1];
      if (dist(last, points[i]) >= minStep) out.push(points[i]);
    }
    out.push(points[points.length - 1]);
    return out;
  }

  function vectorFromAngleToward(angle, from, to) {
    const vx = Math.cos(angle);
    const vy = Math.sin(angle);
    const tx = to.x - from.x;
    const ty = to.y - from.y;
    const sign = vx * tx + vy * ty < 0 ? -1 : 1;
    return { x: vx * sign, y: vy * sign };
  }

  function normalizeVector(v, fallback = { x: 1, y: 0 }) {
    const len = Math.hypot(v.x, v.y);
    if (!Number.isFinite(len) || len < 1e-6) return fallback;
    return { x: v.x / len, y: v.y / len };
  }

  function blendedVector(a, aw, b, bw, fallback) {
    return normalizeVector({
      x: a.x * aw + b.x * bw,
      y: a.y * aw + b.y * bw
    }, fallback);
  }

  function clampPoint(point) {
    return {
      x: Math.max(-12, Math.min(VIEW_W + 12, point.x)),
      y: Math.max(-12, Math.min(VIEW_H + 12, point.y))
    };
  }

  function traceFieldPath(start, end, kind, field) {
    const total = dist(start, end);
    if (!field || !field.sample || total < 2) return [start, end];
    const direct = normalizeVector({ x: end.x - start.x, y: end.y - start.y });
    const mid = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
    const sample = field.sample(mid);
    const fieldDir = vectorFromAngleToward(sample.primaryAngle, mid, end);
    const perp = { x: -direct.y, y: direct.x };
    const bendSign = fieldDir.x * perp.x + fieldDir.y * perp.y;
    const maxBend = kind === "highway" ? Math.min(10, total * 0.055) : Math.min(18, total * 0.09);
    const bend = Math.max(-maxBend, Math.min(maxBend, bendSign * maxBend * (0.35 + sample.strength * 0.65)));
    if (Math.abs(bend) < 3 || kind === "highway") {
      if (kind === "highway" && Math.abs(bend) >= 5) {
        return [
          start,
          clampPoint({ x: mid.x + perp.x * bend * 0.55, y: mid.y + perp.y * bend * 0.55 }),
          end
        ];
      }
      return [start, end];
    }
    return [
      start,
      clampPoint({ x: mid.x + perp.x * bend, y: mid.y + perp.y * bend }),
      end
    ];
  }

  function routeToPoints(cellIds, byId, kind, field) {
    const raw = cellIds.map(id => byId[id].centroid);
    if (kind === "highway") {
      return simplifyPoints(raw, 44);
    }
    if (kind === "avenue") {
      return simplifyPoints(raw, 30);
    }
    if (kind === "street") return simplifyPoints(raw, 18);
    return simplifyPoints(raw, 14);
  }

  function averagePoint(cells) {
    if (!cells.length) return { x: VIEW_W / 2, y: VIEW_H / 2 };
    return {
      x: cells.reduce((sum, cell) => sum + cell.centroid.x, 0) / cells.length,
      y: cells.reduce((sum, cell) => sum + cell.centroid.y, 0) / cells.length
    };
  }

  function roadWidth(kind) {
    if (kind === "highway") return 14;
    if (kind === "avenue") return 7;
    if (kind === "local") return 3.5;
    return 4.5;
  }

  function makeRoadCorridor(points, kind) {
    if (!points || points.length < 2) return [];
    const half = roadWidth(kind) / 2;
    const left = offsetPolyline(points, half);
    const right = offsetPolyline(points, -half).reverse();
    return [...left, ...right];
  }

  function sampleRoadField(points, field) {
    if (!field || !field.sample || !points || !points.length) return [];
    return points.map(point => {
      const sample = field.sample(point);
      return {
        point,
        primaryAngle: sample.primaryAngle,
        secondaryAngle: sample.secondaryAngle,
        strength: sample.strength,
        density: sample.density,
        fieldElementIds: sample.fieldElementIds
      };
    });
  }

  function addNode(nodes, point, kind, refId) {
    const id = `node-${nodes.length + 1}`;
    nodes.push({ id, point, kind, refId });
    return id;
  }

  function addRoadEdge(edges, nodes, byId, cellIds, kind, fromNode, toNode, field, extra = {}) {
    if (!cellIds || cellIds.length < 2) return null;
    const pts = routeToPoints(cellIds, byId, kind, field);
    const corridorPolygon = makeRoadCorridor(pts, kind);
    const id = `road-${edges.length + 1}`;
    edges.push({
      id,
      from: fromNode,
      to: toNode,
      kind,
      path: kind === "local" ? straightPolylinePath(pts) : smoothPolylinePath(pts),
      points: pts,
      routeCellPoints: cellIds.map(id => byId[id].centroid),
      cellsAlongside: cellIds,
      corridorPolygon,
      corridorPath: corridorPolygon.length ? straightPolylinePath(corridorPolygon) + " Z" : "",
      fieldSamples: sampleRoadField(pts, field),
      visualSmoothing: kind === "local" ? "straight" : "soft",
      ...extra
    });
    return id;
  }

  function endpointCandidates(cells, axis) {
    const sorted = [...cells].sort((a, b) => axis(a.centroid) - axis(b.centroid));
    const low = sorted.slice(0, Math.max(3, Math.ceil(sorted.length * 0.12)));
    const high = sorted.slice(-Math.max(3, Math.ceil(sorted.length * 0.12)));
    return { low, high };
  }

  function generateHighways(nodes, edges, byId, landmassCells, adjacency, field, rng) {
    for (const [landmassId, cells] of Object.entries(landmassCells)) {
      if (landmassId !== "mainland") continue;
      if (cells.length < 18) continue;
      for (let n = 0; n < HIGHWAY_TARGETS_PER_LANDMASS; n++) {
        const center = averagePoint(cells);
        const fieldSample = field && field.sample ? field.sample(center) : null;
        const angle = fieldSample ? fieldSample.primaryAngle : (rng() < 0.55 ? 0 : Math.PI / 2);
        const dir = { x: Math.cos(angle), y: Math.sin(angle) };
        const candidates = endpointCandidates(cells, p => p.x * dir.x + p.y * dir.y);
        const start = candidates.low[Math.floor(rng() * candidates.low.length)];
        const end = farthestCell(start, candidates.high) || candidates.high[candidates.high.length - 1];
        const path = shortestCellPath(start.id, end.id, cells, adjacency, "highway");
        if (path.length < 5) continue;
        const fromNode = addNode(nodes, byId[path[0]].centroid, "coastGate", path[0]);
        const toNode = addNode(nodes, byId[path[path.length - 1]].centroid, "coastGate", path[path.length - 1]);
        addRoadEdge(edges, nodes, byId, path, "highway", fromNode, toNode, field, { landmassId });
      }
    }
  }

  function generateAvenues(nodes, edges, byId, neighborhoods, cells, adjacency, field, rng) {
    const hoodsByLandmass = {};
    for (const hood of neighborhoods) {
      if (hood.landmassId !== "mainland") continue;
      if (!hood.cells.length) continue;
      if (!hoodsByLandmass[hood.landmassId]) hoodsByLandmass[hood.landmassId] = [];
      hoodsByLandmass[hood.landmassId].push(hood);
    }

    for (const hoods of Object.values(hoodsByLandmass)) {
      for (const hood of hoods) {
        const fromCell = nearestCell(hood.seedPoint, hood.cells.map(id => byId[id]).filter(Boolean));
        if (!fromCell) continue;
        const fromNode = addNode(nodes, fromCell.centroid, "districtHub", hood.id);
        const otherHoods = hoods
          .filter(h => h !== hood && h.cells.length)
          .sort((a, b) => dist(hood.seedPoint, a.seedPoint) - dist(hood.seedPoint, b.seedPoint))
          .slice(0, AVENUE_TARGETS_PER_NEIGHBORHOOD);
        for (const targetHood of otherHoods) {
          const targetCell = nearestCell(targetHood.seedPoint, targetHood.cells.map(id => byId[id]).filter(Boolean));
          if (!targetCell) continue;
          const path = shortestCellPath(fromCell.id, targetCell.id, cells.filter(c => c.landmassId === hood.landmassId), adjacency, "avenue");
          if (path.length < 2) continue;
          const toNode = addNode(nodes, targetCell.centroid, "districtHub", targetHood.id);
          addRoadEdge(edges, nodes, byId, path, "avenue", fromNode, toNode, field, {
            landmassId: hood.landmassId
          });
        }
      }
    }
  }

  function generateLocalRoads(nodes, edges, byId, cells, adjacency, field, rng) {
    const used = new Set();
    for (const cell of cells) {
      if (rng() > (cell.landmassId === "mainland" ? 0.56 : 0.68)) continue;
      const neighbors = (adjacency[cell.id] || [])
        .map(id => byId[id])
        .filter(Boolean)
        .filter(neighbor => neighbor.landmassId === cell.landmassId)
        .sort((a, b) => dist(cell.centroid, a.centroid) - dist(cell.centroid, b.centroid));
      const target = neighbors[0];
      if (!target) continue;
      const key = [cell.id, target.id].sort().join("|");
      if (used.has(key)) continue;
      used.add(key);
      const fromNode = addNode(nodes, cell.centroid, "intersection", cell.id);
      const toNode = addNode(nodes, target.centroid, "intersection", target.id);
      addRoadEdge(edges, nodes, byId, [cell.id, target.id], "local", fromNode, toNode, field, {
        landmassId: cell.landmassId
      });
    }
  }

  function generateBridgeCandidates(nodes, edges, byId, terrain, cells, adjacency) {
    const candidates = [];
    for (const channel of terrain.channels || []) {
      const [aLand, bLand] = channel.landmassIds || [];
      const aCells = cells.filter(c => c.landmassId === aLand);
      const bCells = cells.filter(c => c.landmassId === bLand);
      if (!aCells.length || !bCells.length) continue;
      const a = nearestCell(channel.centerline[0], aCells);
      const b = nearestCell(channel.centerline[1], bCells);
      if (!a || !b) continue;
      const d = polygonToPolygonDist(a.polygon, b.polygon);
      const id = `bridge-candidate-${candidates.length + 1}`;
      const fromNode = addNode(nodes, a.centroid, "bridgehead", a.id);
      const toNode = addNode(nodes, b.centroid, "bridgehead", b.id);
      candidates.push({
        id,
        channelId: channel.id,
        fromCellId: a.id,
        toCellId: b.id,
        minWaterWidth: channel.minWidth,
        parcelGap: d,
        score: Math.max(0, 100 - channel.minWidth) + Math.max(0, 80 - d),
        fromNode,
        toNode
      });
    }
    candidates.sort((a, b) => b.score - a.score);
    return candidates;
  }

  function pointNearRoad(point, edges, maxDistance) {
    for (const edge of edges) {
      for (let i = 0; i < edge.points.length - 1; i++) {
        if (pointToSegmentDist(point.x, point.y, edge.points[i], edge.points[i + 1]) < maxDistance) return true;
      }
    }
    return false;
  }

  function roadCells(cells, edges) {
    const roadCellIds = [];
    const blockedCellIds = [];
    for (const cell of cells) {
      const nearMajor = pointNearRoad(cell.centroid, edges.filter(e => e.kind !== "local"), 11);
      const nearAny = nearMajor || pointNearRoad(cell.centroid, edges, 6);
      if (nearAny) roadCellIds.push(cell.id);
      if (nearMajor && cell.area < 460) blockedCellIds.push(cell.id);
    }
    return { roadCellIds, blockedCellIds };
  }

  function generateRoadGraph(cellResult, rng) {
    const terrain = cellResult.terrain;
    const cells = cellResult.cells;
    const byId = cellMap(cells);
    const nodes = [];
    const edges = [];
    const landmassCells = cellsByLandmass(cells);

    generateHighways(nodes, edges, byId, landmassCells, cellResult.adjacency, cellResult.field, rng);
    generateAvenues(nodes, edges, byId, cellResult.neighborhoods, cells, cellResult.adjacency, cellResult.field, rng);
    generateLocalRoads(nodes, edges, byId, cells, cellResult.adjacency, cellResult.field, rng);

    const bridgeCandidates = generateBridgeCandidates(nodes, edges, byId, terrain, cells, cellResult.adjacency);
    const { roadCellIds, blockedCellIds } = roadCells(cells, edges);

    return {
      version: 1,
      nodes,
      edges,
      bridgeCandidates,
      roadCells: roadCellIds,
      blockedCells: blockedCellIds,
      roadCorridors: edges.map(edge => ({
        id: `${edge.id}:corridor`,
        roadId: edge.id,
        kind: edge.kind,
        polygon: edge.corridorPolygon,
        path: edge.corridorPath
      })).filter(corridor => corridor.polygon.length),
      blockedAreas: blockedCellIds
    };
  }

  function buildRoadGraph(seed = 1) {
    const normalizedSeed = Number.isFinite(seed) ? (seed >>> 0) || 1 : 1;
    const cellResult = window.CityMapCellsV4.buildCells(normalizedSeed);
    const roadGraph = generateRoadGraph(cellResult, window.makeRng(normalizedSeed ^ 0x904d4));
    return { ...cellResult, roadGraph };
  }

  function roadGraphSummary(result) {
    const counts = {};
    for (const edge of result.roadGraph.edges) counts[edge.kind] = (counts[edge.kind] || 0) + 1;
    return {
      nodes: result.roadGraph.nodes.length,
      edges: result.roadGraph.edges.length,
      kinds: counts,
      bridgeCandidates: result.roadGraph.bridgeCandidates.length,
      roadCells: result.roadGraph.roadCells.length,
      blockedCells: result.roadGraph.blockedCells.length
    };
  }

  window.CityMapRoadGraphV4 = {
    buildRoadGraph,
    generateRoadGraph,
    roadGraphSummary
  };
})();
