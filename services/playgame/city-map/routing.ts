// @ts-nocheck
import { VIEW_H, VIEW_W } from './config';
import { cutSegments } from './paths';
import type { Building, CityMap, CityRoute, Point, RoadEdge, RoadGraph, RoutingGraph } from './types';

const SNAP_CANDIDATES = 3;

function closestOnSeg(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-12) return { x: ax, y: ay, t: 0, distSq: (px - ax) ** 2 + (py - ay) ** 2 };
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return { x: cx, y: cy, t, distSq: (px - cx) ** 2 + (py - cy) ** 2 };
}

function segIntersect(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, dx: number, dy: number) {
  const rx = bx - ax;
  const ry = by - ay;
  const sx = dx - cx;
  const sy = dy - cy;
  const denom = rx * sy - ry * sx;
  if (Math.abs(denom) < 1e-10) return null;
  const t = ((cx - ax) * sy - (cy - ay) * sx) / denom;
  const u = ((cx - ax) * ry - (cy - ay) * rx) / denom;
  const e = 1e-4;
  if (t < -e || t > 1 + e || u < -e || u > 1 + e) return null;
  const tEnd = t < e || t > 1 - e;
  const uEnd = u < e || u > 1 - e;
  if (tEnd && uEnd) return null;
  const tc = Math.max(0, Math.min(1, t));
  return { x: ax + tc * rx, y: ay + tc * ry };
}

function centroid(points: Point[]): Point {
  if (!points.length) return { x: 0, y: 0 };
  return {
    x: points.reduce((sum, p) => sum + p.x, 0) / points.length,
    y: points.reduce((sum, p) => sum + p.y, 0) / points.length,
  };
}

function polylineLen(points: Point[]) {
  let len = 0;
  for (let i = 0; i + 1 < points.length; i++) len += Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y);
  return len;
}

function closestOnPolyline(px: number, py: number, points: Point[]) {
  let totalLen = 0;
  const segLens: number[] = [];
  for (let i = 0; i + 1 < points.length; i++) {
    const len = Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y);
    segLens.push(len);
    totalLen += len;
  }
  let best: { point: Point; edgeT: number; distSq: number } | null = null;
  let cumLen = 0;
  for (let i = 0; i + 1 < points.length; i++) {
    const snap = closestOnSeg(px, py, points[i].x, points[i].y, points[i + 1].x, points[i + 1].y);
    const edgeT = totalLen > 0 ? (cumLen + snap.t * segLens[i]) / totalLen : 0;
    if (!best || snap.distSq < best.distSq) best = { point: { x: snap.x, y: snap.y }, edgeT, distSq: snap.distSq };
    cumLen += segLens[i];
  }
  return best ? { ...best, dist: Math.sqrt(best.distSq) } : null;
}

function subPolyline(points: Point[], tA: number, tB: number) {
  const reversed = tA > tB;
  if (reversed) [tA, tB] = [tB, tA];
  if (tB - tA < 1e-9) return [];
  let total = 0;
  const segLens: number[] = [];
  for (let i = 0; i + 1 < points.length; i++) {
    const len = Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y);
    segLens.push(len);
    total += len;
  }
  if (total < 1e-10) return points[0] ? [{ ...points[0] }] : [];

  const lerp = (i: number, t: number) => ({
    x: points[i].x + t * (points[i + 1].x - points[i].x),
    y: points[i].y + t * (points[i + 1].y - points[i].y),
  });
  const result: Point[] = [];
  let cumLen = 0;
  for (let i = 0; i < segLens.length; i++) {
    const segTA = cumLen / total;
    const segTB = (cumLen + segLens[i]) / total;
    cumLen += segLens[i];
    if (segTB < tA - 1e-9) continue;
    if (segTA > tB + 1e-9) break;
    const span = segTB - segTA;
    if (result.length === 0) result.push(lerp(i, span > 1e-10 ? Math.max(0, (tA - segTA) / span) : 0));
    if (segTB <= tB + 1e-9) result.push({ ...points[i + 1] });
    else {
      result.push(lerp(i, span > 1e-10 ? Math.min(1, (tB - segTA) / span) : 1));
      break;
    }
  }
  if (reversed) result.reverse();
  return result;
}

function samePoint(a?: Point | null, b?: Point | null, eps = 0.35) {
  return !!a && !!b && Math.hypot(a.x - b.x, a.y - b.y) <= eps;
}

function pushPoint(out: Point[], point?: Point | null, eps = 0.35) {
  if (!point) return;
  const prev = out[out.length - 1];
  if (!prev || !samePoint(prev, point, eps)) out.push({ x: point.x, y: point.y });
}

function simplifyNearlyCollinear(points: Point[], tolerance = 0.42) {
  if (points.length <= 2) return points;
  const out = [points[0]];
  for (let i = 1; i + 1 < points.length; i++) {
    const a = out[out.length - 1];
    const b = points[i];
    const c = points[i + 1];
    const ac = Math.hypot(c.x - a.x, c.y - a.y);
    if (ac < 1e-6) continue;
    const area2 = Math.abs((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x));
    const offLine = area2 / ac;
    const dot = (b.x - a.x) * (c.x - b.x) + (b.y - a.y) * (c.y - b.y);
    if (offLine <= tolerance && dot >= -0.01) continue;
    out.push(b);
  }
  pushPoint(out, points[points.length - 1]);
  return out;
}

function densifyEdgePoints(edge: RoadEdge) {
  if (!edge.cut) return edge.points || [];
  const segments = cutSegments(edge.cut);
  if (!segments?.length) return edge.points || [];
  return [{ x: segments[0].a.x, y: segments[0].a.y }, ...segments.map((segment) => ({ x: segment.b.x, y: segment.b.y }))];
}

function waterSegmentsFromTerrain(city: CityMap) {
  const segments: Array<{ a: Point; b: Point }> = [];
  for (const body of city.terrain?.waterBodies || []) {
    if (body.kind === 'river' && body.segments) segments.push(...body.segments);
    if (body.kind === 'lake' && body.polygon) {
      for (let i = 0; i < body.polygon.length; i++) segments.push({ a: body.polygon[i], b: body.polygon[(i + 1) % body.polygon.length] });
    }
  }
  return segments;
}

function crossesUnbridgedWater(p1: Point, p2: Point, waterSegs: Array<{ a: Point; b: Point }>, bridges: Array<{ x?: number; y?: number; center?: Point }>, bridgeRadius: number) {
  for (const water of waterSegs) {
    const hit = segIntersect(p1.x, p1.y, p2.x, p2.y, water.a.x, water.a.y, water.b.x, water.b.y);
    if (!hit) continue;
    const nearBridge = bridges.some((bridge) => {
      const c = bridge.center || (typeof bridge.x === 'number' && typeof bridge.y === 'number' ? { x: bridge.x, y: bridge.y } : null);
      return c ? Math.hypot(c.x - hit.x, c.y - hit.y) < bridgeRadius : false;
    });
    if (!nearBridge) return true;
  }
  return false;
}

function nkey(x: number, y: number, eps: number) {
  return `${Math.round(x / eps)}_${Math.round(y / eps)}`;
}

function buildRoadGraph(rawEdges: RoadEdge[], waterSegs: Array<{ a: Point; b: Point }>, bridges: Array<{ x?: number; y?: number; center?: Point }>): RoutingGraph {
  const eps = Math.min(VIEW_W, VIEW_H) * 0.004;
  const touchEps = Math.max(0.55, eps * 0.55);
  const bridgeRadius = 6;
  const nodeMap = new Map<string, { id: string; x: number; y: number; edgeIds: string[] }>();
  const nodes: Array<{ id: string; x: number; y: number; edgeIds: string[] }> = [];
  const getOrAddNode = (x: number, y: number) => {
    const key = nkey(x, y, eps);
    const existing = nodeMap.get(key);
    if (existing) return existing;
    const node = { id: `rn:${nodes.length}`, x, y, edgeIds: [] };
    nodeMap.set(key, node);
    nodes.push(node);
    return node;
  };

  const navEdges = rawEdges.filter((edge) => edge.points && edge.points.length >= 2);
  for (const edge of navEdges) {
    getOrAddNode(edge.points[0].x, edge.points[0].y);
    getOrAddNode(edge.points[edge.points.length - 1].x, edge.points[edge.points.length - 1].y);
  }
  for (let i = 0; i < navEdges.length; i++) {
    for (let j = i + 1; j < navEdges.length; j++) {
      const pa = navEdges[i].points;
      const pb = navEdges[j].points;
      for (let si = 0; si + 1 < pa.length; si++) {
        for (let sj = 0; sj + 1 < pb.length; sj++) {
          const hit = segIntersect(pa[si].x, pa[si].y, pa[si + 1].x, pa[si + 1].y, pb[sj].x, pb[sj].y, pb[sj + 1].x, pb[sj + 1].y);
          if (hit) getOrAddNode(hit.x, hit.y);
        }
      }
    }
  }

  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const nodeEdgeTs = new Map<string, number>();
  const edges = navEdges.map((edge) => {
    const onEdge = nodes
      .map((node) => {
        const snap = closestOnPolyline(node.x, node.y, edge.points);
        if (!snap || snap.dist >= touchEps) return null;
        if (crossesUnbridgedWater(node, snap.point, waterSegs, bridges, bridgeRadius)) return null;
        return { node, edgeT: snap.edgeT };
      })
      .filter(Boolean)
      .sort((a, b) => a!.edgeT - b!.edgeT) as Array<{ node: { id: string; edgeIds: string[] }; edgeT: number }>;
    const nodeIds = onEdge.map(({ node }) => node.id);
    for (const { node, edgeT } of onEdge) {
      if (!node.edgeIds.includes(edge.id)) node.edgeIds.push(edge.id);
      nodeEdgeTs.set(`${node.id}:${edge.id}`, edgeT);
    }
    return { ...edge, nodeIds, length: polylineLen(edge.points) };
  });

  const adjacency = new Map<string, Array<{ nodeId: string; dist: number; edgeId: string; segPts: Point[] }>>(nodes.map((node) => [node.id, []]));
  for (const edge of edges) {
    for (let k = 0; k + 1 < edge.nodeIds.length; k++) {
      const a = nodeById.get(edge.nodeIds[k]);
      const b = nodeById.get(edge.nodeIds[k + 1]);
      if (!a || !b) continue;
      const tA = nodeEdgeTs.get(`${a.id}:${edge.id}`) ?? 0;
      const tB = nodeEdgeTs.get(`${b.id}:${edge.id}`) ?? 1;
      const segPts = subPolyline(edge.points, tA, tB);
      if (segPts.some((p, idx) => idx + 1 < segPts.length && crossesUnbridgedWater(p, segPts[idx + 1], waterSegs, bridges, bridgeRadius))) continue;
      const dist = polylineLen(segPts) || Math.hypot(b.x - a.x, b.y - a.y);
      adjacency.get(a.id)?.push({ nodeId: b.id, dist, edgeId: edge.id, segPts });
      adjacency.get(b.id)?.push({ nodeId: a.id, dist, edgeId: edge.id, segPts: [...segPts].reverse() });
    }
  }
  return { nodes, edges, nodeById, nodeEdgeTs, adjacency };
}

function enrichBuildings(buildings: Building[], roadEdges: RoadEdge[]) {
  const navEdges = roadEdges.filter((edge) => edge.points && edge.points.length >= 2);
  for (const building of buildings) {
    if (!building.footprint?.length) {
      building.centroid = { x: 0, y: 0 };
      building.snapEdgeId = null;
      building.snapPoint = null;
      building.snapT = null;
      building.snapCandidates = [];
      continue;
    }
    building.centroid = centroid(building.footprint);
    const candidates = navEdges
      .map((edge) => {
        const snap = closestOnPolyline(building.centroid!.x, building.centroid!.y, edge.points);
        return snap ? { edgeId: edge.id, snapPoint: snap.point, snapT: snap.edgeT, dist: snap.dist } : null;
      })
      .filter(Boolean)
      .sort((a, b) => a!.dist - b!.dist)
      .slice(0, SNAP_CANDIDATES) as Building['snapCandidates'];
    building.snapCandidates = candidates;
    const best = candidates[0] || null;
    building.snapEdgeId = best?.edgeId ?? null;
    building.snapPoint = best?.snapPoint ?? null;
    building.snapT = best?.snapT ?? null;
  }
}

export function enrichCityRouting(city: CityMap): CityMap {
  const waterSegs = waterSegmentsFromTerrain(city);
  const denseEdges = city.roadGraph.edges.map((edge) => ({ ...edge, points: densifyEdgePoints(edge) }));
  enrichBuildings(city.buildingPlan.buildings, denseEdges);
  const graph = buildRoadGraph(denseEdges, waterSegs, city.bridgePlan?.bridges || []);
  city.roadGraph.nodes = graph.nodes;
  city._routing = graph;
  return city;
}

function dijkstra(adjacency: RoutingGraph['adjacency'], startId: string, endId: string) {
  const dist = new Map<string, number>();
  const prev = new Map<string, string>();
  const prevAdj = new Map<string, { nodeId: string; dist: number; edgeId: string; segPts: Point[] }>();
  const visited = new Set<string>();
  const queue = [{ id: startId, d: 0 }];
  for (const id of adjacency.keys()) dist.set(id, Infinity);
  dist.set(startId, 0);
  while (queue.length) {
    queue.sort((a, b) => a.d - b.d);
    const { id } = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    if (id === endId) break;
    for (const adj of adjacency.get(id) || []) {
      if (visited.has(adj.nodeId)) continue;
      const next = (dist.get(id) ?? Infinity) + adj.dist;
      if (next < (dist.get(adj.nodeId) ?? Infinity)) {
        dist.set(adj.nodeId, next);
        prev.set(adj.nodeId, id);
        prevAdj.set(adj.nodeId, adj);
        queue.push({ id: adj.nodeId, d: next });
      }
    }
  }
  if ((dist.get(endId) ?? Infinity) === Infinity) return null;
  const nodeIds: string[] = [];
  for (let cur: string | undefined = endId; cur !== undefined; cur = prev.get(cur)) nodeIds.unshift(cur);
  return { nodeIds, adjSteps: nodeIds.slice(1).map((id) => prevAdj.get(id)), distance: dist.get(endId) ?? Infinity };
}

function snapNodes(edgeId: string, snapT: number, routing: RoutingGraph) {
  const edge = routing.edges.find((item) => item.id === edgeId);
  if (!edge?.nodeIds?.length) return [];
  const entries = edge.nodeIds
    .map((nodeId) => {
      const node = routing.nodeById.get(nodeId);
      const t = routing.nodeEdgeTs.get(`${nodeId}:${edgeId}`) ?? 0;
      return node ? { node, t, tDist: Math.abs(t - snapT) } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a!.t - b!.t) as Array<{ node: { id: string; x: number; y: number }; t: number; tDist: number }>;
  let before: typeof entries[number] | null = null;
  let after: typeof entries[number] | null = null;
  for (const entry of entries) {
    if (entry.t <= snapT + 1e-6) before = entry;
    if (!after && entry.t >= snapT - 1e-6) after = entry;
  }
  const chosen = [before, after].filter((entry, idx, arr) => entry && arr.findIndex((other) => other?.node.id === entry.node.id) === idx) as typeof entries;
  return (chosen.length ? chosen : entries.slice(0, 2)).sort((a, b) => a.tDist - b.tDist).map((entry) => entry.node);
}

function buildWaypoints(a: Building, nA: { id: string; x: number; y: number }, b: Building, nB: { id: string; x: number; y: number }, result: NonNullable<ReturnType<typeof dijkstra>>, routing: RoutingGraph) {
  const waypoints: Point[] = [];
  const edgeA = routing.edges.find((edge) => edge.id === a.snapEdgeId);
  const tA = routing.nodeEdgeTs.get(`${nA.id}:${a.snapEdgeId}`);
  if (edgeA && tA !== undefined && a.snapT != null) for (const p of subPolyline(edgeA.points, a.snapT, tA)) pushPoint(waypoints, p);
  else {
    pushPoint(waypoints, a.snapPoint);
    pushPoint(waypoints, nA);
  }
  for (const adj of result.adjSteps) for (const p of adj?.segPts || []) pushPoint(waypoints, p);
  const edgeB = routing.edges.find((edge) => edge.id === b.snapEdgeId);
  const tB = routing.nodeEdgeTs.get(`${nB.id}:${b.snapEdgeId}`);
  if (edgeB && tB !== undefined && b.snapT != null) for (const p of subPolyline(edgeB.points, tB, b.snapT)) pushPoint(waypoints, p);
  else pushPoint(waypoints, b.snapPoint);
  return simplifyNearlyCollinear(waypoints);
}

export function findPath(city: CityMap, buildingIdA: string, buildingIdB: string): CityRoute | null {
  const routing = city._routing;
  if (!routing) return null;
  const bldA = city.buildingPlan.buildings.find((building) => building.id === buildingIdA);
  const bldB = city.buildingPlan.buildings.find((building) => building.id === buildingIdB);
  if (!bldA?.snapCandidates?.length || !bldB?.snapCandidates?.length) return null;

  let bestWaypoints: Point[] | null = null;
  let bestDist = Infinity;
  for (const candA of bldA.snapCandidates) {
    const edgeA = routing.edges.find((edge) => edge.id === candA.edgeId);
    if (!edgeA) continue;
    for (const candB of bldB.snapCandidates) {
      const edgeB = routing.edges.find((edge) => edge.id === candB.edgeId);
      if (!edgeB) continue;
      if (candA.edgeId === candB.edgeId) {
        const waypoints = subPolyline(edgeA.points, candA.snapT, candB.snapT);
        const dist = polylineLen(waypoints);
        if (dist < bestDist) {
          bestDist = dist;
          bestWaypoints = waypoints;
        }
        continue;
      }
      for (const nA of snapNodes(candA.edgeId, candA.snapT, routing)) {
        for (const nB of snapNodes(candB.edgeId, candB.snapT, routing)) {
          const result = nA.id === nB.id ? { nodeIds: [nA.id], adjSteps: [], distance: 0 } : dijkstra(routing.adjacency, nA.id, nB.id);
          if (!result) continue;
          const total = result.distance
            + polylineLen(subPolyline(edgeA.points, candA.snapT, routing.nodeEdgeTs.get(`${nA.id}:${candA.edgeId}`) ?? 0))
            + polylineLen(subPolyline(edgeB.points, routing.nodeEdgeTs.get(`${nB.id}:${candB.edgeId}`) ?? 0, candB.snapT));
          if (total < bestDist) {
            bestDist = total;
            bestWaypoints = buildWaypoints(
              { ...bldA, snapEdgeId: candA.edgeId, snapPoint: candA.snapPoint, snapT: candA.snapT },
              nA,
              { ...bldB, snapEdgeId: candB.edgeId, snapPoint: candB.snapPoint, snapT: candB.snapT },
              nB,
              result,
              routing,
            );
          }
        }
      }
    }
  }
  return bestWaypoints && bestWaypoints.length >= 2
    ? { waypoints: bestWaypoints, distance: bestDist, buildingIds: [buildingIdA, buildingIdB] }
    : null;
}

export function routeToSvgPath(waypoints: Point[]) {
  if (!waypoints || waypoints.length < 2) return '';
  return `M ${waypoints[0].x.toFixed(2)} ${waypoints[0].y.toFixed(2)}${waypoints.slice(1).map((p) => ` L ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join('')}`;
}

export function nearestBuilding(city: CityMap, x: number, y: number): Building | null {
  let best: Building | null = null;
  let bestDist = Infinity;
  for (const building of city.buildingPlan.buildings) {
    if (!building.centroid) continue;
    const dist = Math.hypot(building.centroid.x - x, building.centroid.y - y);
    if (dist < bestDist) {
      bestDist = dist;
      best = building;
    }
  }
  return best;
}

export function nearestBuildingToSlot(city: CityMap, slot: { blockId?: string | null; x: number; y: number }): Building | null {
  let best: Building | null = null;
  let bestDist = Infinity;
  for (const building of city.buildingPlan.buildings) {
    if (building.cellId !== slot.blockId || !building.centroid) continue;
    const dist = Math.hypot(building.centroid.x - slot.x, building.centroid.y - slot.y);
    if (dist < bestDist) {
      bestDist = dist;
      best = building;
    }
  }
  return best;
}

export function findPathBetweenCoords(city: CityMap, x1: number, y1: number, x2: number, y2: number): CityRoute | null {
  const bA = nearestBuilding(city, x1, y1);
  const bB = nearestBuilding(city, x2, y2);
  if (!bA || !bB) return null;

  const result = findPath(city, bA.id, bB.id);
  if (!result || !result.waypoints) return null;

  // Prepend and append the actual coords so the route visually connects to them
  const waypoints = [{ x: x1, y: y1 }, ...result.waypoints, { x: x2, y: y2 }];
  return { ...result, waypoints };
}

export function attachRoadGraph(city: CityMap, graph: RoadGraph) {
  city.roadGraph = graph;
  return city;
}
