(function () {
  "use strict";

  // ── Geometry helpers ──────────────────────────────────────────

  function _closestOnSeg(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    if (lenSq < 1e-12) return { x: ax, y: ay, t: 0, distSq: (px - ax) ** 2 + (py - ay) ** 2 };
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
    const cx = ax + t * dx, cy = ay + t * dy;
    return { x: cx, y: cy, t, distSq: (px - cx) ** 2 + (py - cy) ** 2 };
  }

  // Allows near-endpoint hits to catch T-junctions.
  // Skips pure endpoint↔endpoint (both t and u near 0/1) since those are Pass 1 nodes.
  function _segIntersect(ax, ay, bx, by, cx, cy, dx, dy) {
    const rx = bx - ax, ry = by - ay;
    const sx = dx - cx, sy = dy - cy;
    const denom = rx * sy - ry * sx;
    if (Math.abs(denom) < 1e-10) return null;
    const t = ((cx - ax) * sy - (cy - ay) * sx) / denom;
    const u = ((cx - ax) * ry - (cy - ay) * rx) / denom;
    const E = 1e-4;
    if (t < -E || t > 1 + E || u < -E || u > 1 + E) return null;
    const tEnd = t < E || t > 1 - E;
    const uEnd = u < E || u > 1 - E;
    if (tEnd && uEnd) return null;
    const tc = Math.max(0, Math.min(1, t));
    return { x: ax + tc * rx, y: ay + tc * ry };
  }

  function _centroid(pts) {
    let cx = 0, cy = 0;
    for (const p of pts) { cx += p.x; cy += p.y; }
    return { x: cx / pts.length, y: cy / pts.length };
  }

  function _closestOnPolyline(px, py, pts) {
    let totalLen = 0;
    const segLens = [];
    for (let i = 0; i + 1 < pts.length; i++) {
      const dx = pts[i + 1].x - pts[i].x, dy = pts[i + 1].y - pts[i].y;
      segLens.push(Math.sqrt(dx * dx + dy * dy));
      totalLen += segLens[i];
    }
    let best = null, cumLen = 0;
    for (let i = 0; i + 1 < pts.length; i++) {
      const r = _closestOnSeg(px, py, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y);
      const edgeT = totalLen > 0 ? (cumLen + r.t * segLens[i]) / totalLen : 0;
      if (!best || r.distSq < best.distSq) best = { point: { x: r.x, y: r.y }, edgeT, distSq: r.distSq };
      cumLen += segLens[i];
    }
    return best ? { ...best, dist: Math.sqrt(best.distSq) } : null;
  }

  function _polylineLen(pts) {
    let len = 0;
    for (let i = 0; i + 1 < pts.length; i++) len += Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
    return len;
  }

  // Extract sub-polyline of pts[] between edgeT values tA..tB (0..1 by cumulative length).
  // Returns actual road geometry — no straight-line shortcuts through blocks.
  function _subPolyline(pts, tA, tB) {
    const reversed = tA > tB;
    if (reversed) { const tmp = tA; tA = tB; tB = tmp; }
    if (tB - tA < 1e-9) return [];

    let total = 0;
    const segLens = [];
    for (let i = 0; i + 1 < pts.length; i++) {
      const l = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
      segLens.push(l); total += l;
    }
    if (total < 1e-10) return [{ x: pts[0].x, y: pts[0].y }];

    const lerp = (i, t) => ({
      x: pts[i].x + t * (pts[i + 1].x - pts[i].x),
      y: pts[i].y + t * (pts[i + 1].y - pts[i].y)
    });

    const result = [];
    let cumLen = 0;
    for (let i = 0; i < segLens.length; i++) {
      const segTA = cumLen / total;
      const segTB = (cumLen + segLens[i]) / total;
      cumLen += segLens[i];

      if (segTB < tA - 1e-9) continue;
      if (segTA > tB + 1e-9) break;
      const span = segTB - segTA;

      if (result.length === 0) {
        result.push(lerp(i, span > 1e-10 ? Math.max(0, (tA - segTA) / span) : 0));
      }
      if (segTB <= tB + 1e-9) {
        result.push({ x: pts[i + 1].x, y: pts[i + 1].y });
      } else {
        result.push(lerp(i, span > 1e-10 ? Math.min(1, (tB - segTA) / span) : 1));
        break;
      }
    }

    if (reversed) result.reverse();
    return result;
  }

  function _nkey(x, y, eps) { return `${Math.round(x / eps)}_${Math.round(y / eps)}`; }

  function _samePoint(a, b, eps = 0.35) {
    return !!a && !!b && Math.hypot(a.x - b.x, a.y - b.y) <= eps;
  }

  function _pushPoint(out, point, eps = 0.35) {
    if (!point) return;
    const prev = out[out.length - 1];
    if (!prev || !_samePoint(prev, point, eps)) out.push({ x: point.x, y: point.y });
  }

  function _simplifyNearlyCollinear(points, tolerance = 0.42) {
    if (!points || points.length <= 2) return points || [];
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
    _pushPoint(out, points[points.length - 1]);
    return out;
  }

  // ── Edge densification ────────────────────────────────────────
  // Replace edge.points (raw BSP control polyline) with the SAME sampled curve
  // the renderer draws. Otherwise:
  //   - Pass 2 misses intersections that occur on curve interior
  //   - Sub-polyline extraction traces chords between control points (cuts blocks)
  //   - Building snap distance is to the chord, not the curve

  function _densifyEdgePoints(edge) {
    const paths = window.CityMapPathsV3;
    if (!paths || !paths.cutSegments || !edge.cut) return edge.points || [];
    const segs = paths.cutSegments(edge.cut);
    if (!segs || !segs.length) return edge.points || [];
    // Convert {a, b} segment array to continuous polyline points.
    const pts = [{ x: segs[0].a.x, y: segs[0].a.y }];
    for (const s of segs) pts.push({ x: s.b.x, y: s.b.y });
    return pts;
  }

  function _densifyEdges(edges) {
    return edges.map(e => {
      const dense = _densifyEdgePoints(e);
      return { ...e, points: dense };
    });
  }

  // ── Water-aware crossing check ────────────────────────────────
  // Returns true if segment (p1, p2) crosses a river/lake without a nearby bridge.
  // Bridges legitimately cross water; everything else must not.
  function _crossesUnbridgedWater(p1, p2, waterSegs, bridges, bridgeRadius) {
    if (!waterSegs || !waterSegs.length) return false;
    for (const ws of waterSegs) {
      const hit = _segIntersect(p1.x, p1.y, p2.x, p2.y, ws.a.x, ws.a.y, ws.b.x, ws.b.y);
      if (!hit) continue;
      const nearBridge = bridges && bridges.some(b => Math.hypot(b.x - hit.x, b.y - hit.y) < bridgeRadius);
      if (!nearBridge) return true;
    }
    return false;
  }

  // Collect all river + lake boundary segments from terrain.
  function _waterSegmentsFromTerrain(terrain) {
    if (!terrain || !terrain.waterBodies) return [];
    const segs = [];
    for (const body of terrain.waterBodies) {
      if (body.kind === "river" && body.segments) {
        for (const s of body.segments) segs.push(s);
      } else if (body.kind === "lake" && body.polygon) {
        const poly = body.polygon;
        for (let i = 0; i < poly.length; i++) segs.push({ a: poly[i], b: poly[(i + 1) % poly.length] });
      }
    }
    return segs;
  }

  // ── Road graph ────────────────────────────────────────────────

  function _buildRoadGraph(rawEdges, waterSegs, bridges) {
    const cfg = window.CityMapConfigV3 || {};
    const VIEW_W = cfg.VIEW_W || 360;
    const VIEW_H = cfg.VIEW_H || 448;
    const EPS = Math.min(VIEW_W, VIEW_H) * 0.004;
    const TOUCH_EPS = Math.max(0.55, EPS * 0.55);
    const BRIDGE_RADIUS = 6; // bridge presence tolerance

    const nodeMap = new Map();
    const nodes = [];

    function getOrAddNode(x, y) {
      const key = _nkey(x, y, EPS);
      if (nodeMap.has(key)) return nodeMap.get(key);
      const node = { id: `rn:${nodes.length}`, x, y, edgeIds: [] };
      nodeMap.set(key, node); nodes.push(node);
      return node;
    }

    const navEdges = rawEdges.filter(e => e.points && e.points.length >= 2);

    // Pass 1 — endpoints.
    for (const edge of navEdges) {
      const pts = edge.points;
      getOrAddNode(pts[0].x, pts[0].y);
      getOrAddNode(pts[pts.length - 1].x, pts[pts.length - 1].y);
    }

    // Pass 2 — pairwise intersections (T-junctions via loose EPS on t).
    for (let i = 0; i < navEdges.length; i++) {
      for (let j = i + 1; j < navEdges.length; j++) {
        const pa = navEdges[i].points, pb = navEdges[j].points;
        for (let si = 0; si + 1 < pa.length; si++) {
          for (let sj = 0; sj + 1 < pb.length; sj++) {
            const hit = _segIntersect(pa[si].x, pa[si].y, pa[si + 1].x, pa[si + 1].y,
                                      pb[sj].x, pb[sj].y, pb[sj + 1].x, pb[sj + 1].y);
            if (hit) getOrAddNode(hit.x, hit.y);
          }
        }
      }
    }

    // Pass 3 — assign nodes to edges, record edgeT for each.
    // EPS*2 is tight enough to avoid linking nodes across narrow rivers,
    // but still catches T-junctions where polylines are slightly off.
    // Water-aware: reject links where node→snap segment crosses unbridged water.
    const nodeById = new Map(nodes.map(n => [n.id, n]));
    const nodeEdgeTs = new Map(); // `${nodeId}:${edgeId}` → edgeT

    const enrichedEdges = navEdges.map(edge => {
      const pts = edge.points;
      const len = _polylineLen(pts);
      const onEdge = [];
      for (const node of nodes) {
        const snap = _closestOnPolyline(node.x, node.y, pts);
        if (!snap || snap.dist >= TOUCH_EPS) continue;
        // Water-aware: skip if the implied connector crosses a river without a bridge.
        if (_crossesUnbridgedWater(node, snap.point, waterSegs, bridges, BRIDGE_RADIUS)) continue;
        onEdge.push({ node, edgeT: snap.edgeT });
      }
      onEdge.sort((a, b) => a.edgeT - b.edgeT);
      const nodeIds = onEdge.map(e => e.node.id);
      for (const { node, edgeT } of onEdge) {
        if (!node.edgeIds.includes(edge.id)) node.edgeIds.push(edge.id);
        nodeEdgeTs.set(`${node.id}:${edge.id}`, edgeT);
      }
      return { ...edge, nodeIds, length: len };
    });

    // Pass 4 — adjacency with road segment geometry stored per connection.
    // Water-aware: reject any segment whose polyline crosses a river without a bridge.
    const adjacency = new Map(nodes.map(n => [n.id, []]));
    let rejected = 0;
    for (const edge of enrichedEdges) {
      const nids = edge.nodeIds;
      for (let k = 0; k + 1 < nids.length; k++) {
        const nA = nodeById.get(nids[k]), nB = nodeById.get(nids[k + 1]);
        if (!nA || !nB) continue;
        const tA = nodeEdgeTs.get(`${nids[k]}:${edge.id}`) ?? 0;
        const tB = nodeEdgeTs.get(`${nids[k + 1]}:${edge.id}`) ?? 1;
        const segPts = _subPolyline(edge.points, tA, tB);

        // Walk segPts segments and reject if any crosses unbridged water.
        let crossesWater = false;
        for (let s = 0; s + 1 < segPts.length; s++) {
          if (_crossesUnbridgedWater(segPts[s], segPts[s + 1], waterSegs, bridges, BRIDGE_RADIUS)) {
            crossesWater = true; break;
          }
        }
        if (crossesWater) { rejected++; continue; }

        const dist = _polylineLen(segPts) || Math.hypot(nB.x - nA.x, nB.y - nA.y);
        adjacency.get(nids[k]).push({ nodeId: nids[k + 1], dist, edgeId: edge.id, segPts });
        adjacency.get(nids[k + 1]).push({ nodeId: nids[k], dist, edgeId: edge.id, segPts: [...segPts].reverse() });
      }
    }
    if (rejected > 0 && typeof console !== "undefined") {
      console.log(`[CityMapRoutingV1] rejected ${rejected} adjacency edge(s) crossing unbridged water`);
    }

    return { nodes, edges: enrichedEdges, nodeById, nodeEdgeTs, adjacency };
  }

  // ── Building enrichment ───────────────────────────────────────
  // Stores top-N snap candidates per building so findPath can try multiple
  // entry edges. This fixes coast-road overshoot: the nearest road geometrically
  // may require a long detour; a slightly farther road may give a much shorter path.

  const SNAP_CANDIDATES = 3;

  function _enrichBuildings(buildings, roadEdges) {
    const navEdges = roadEdges.filter(e => e.points && e.points.length >= 2);
    for (const building of buildings) {
      if (!building.footprint || !building.footprint.length) {
        building.centroid = { x: 0, y: 0 };
        building.snapEdgeId = null; building.snapPoint = null; building.snapT = null;
        building.snapCandidates = [];
        continue;
      }
      const c = _centroid(building.footprint);
      building.centroid = c;

      // Collect all edges sorted by distance to centroid, keep top N.
      const candidates = [];
      for (const edge of navEdges) {
        const snap = _closestOnPolyline(c.x, c.y, edge.points);
        if (snap) candidates.push({ edgeId: edge.id, snapPoint: snap.point, snapT: snap.edgeT, dist: snap.dist });
      }
      candidates.sort((a, b) => a.dist - b.dist);
      building.snapCandidates = candidates.slice(0, SNAP_CANDIDATES);

      // Primary snap = nearest (for backwards compat / simple queries).
      const best = building.snapCandidates[0] || null;
      building.snapEdgeId = best?.edgeId ?? null;
      building.snapPoint  = best?.snapPoint ?? null;
      building.snapT      = best?.snapT ?? null;
    }
  }

  // ── Dijkstra ──────────────────────────────────────────────────

  function _dijkstra(adjacency, startId, endId) {
    const dist = new Map();
    const prev = new Map();
    const prevAdj = new Map();
    const visited = new Set();
    const queue = [{ id: startId, d: 0 }];
    for (const id of adjacency.keys()) dist.set(id, Infinity);
    dist.set(startId, 0);

    while (queue.length) {
      queue.sort((a, b) => a.d - b.d);
      const { id: cur } = queue.shift();
      if (visited.has(cur)) continue;
      visited.add(cur);
      if (cur === endId) break;
      for (const adj of (adjacency.get(cur) || [])) {
        if (visited.has(adj.nodeId)) continue;
        const nd = dist.get(cur) + adj.dist;
        if (nd < (dist.get(adj.nodeId) ?? Infinity)) {
          dist.set(adj.nodeId, nd);
          prev.set(adj.nodeId, cur);
          prevAdj.set(adj.nodeId, adj);
          queue.push({ id: adj.nodeId, d: nd });
        }
      }
    }

    if ((dist.get(endId) ?? Infinity) === Infinity) return null;
    const path = [];
    let cur = endId;
    while (cur !== undefined) { path.unshift(cur); cur = prev.get(cur); }
    return { nodeIds: path, adjSteps: path.slice(1).map(n => prevAdj.get(n)), distance: dist.get(endId) };
  }

  // ── Snap-to-graph helpers ─────────────────────────────────────

  // Nodes immediately bracketing a snapT. This avoids picking two nodes on the
  // same side of the snap and forcing a route to begin in the wrong direction.
  function _snapNodes(edgeId, snapT, routing) {
    const edge = routing.edges.find(e => e.id === edgeId);
    if (!edge || !edge.nodeIds.length) return [];
    const entries = edge.nodeIds
      .map(nid => {
        const node = routing.nodeById.get(nid);
        const t = routing.nodeEdgeTs.get(`${nid}:${edgeId}`) ?? 0;
        const tDist = Math.abs(t - snapT);
        return node ? { node, t, tDist } : null;
      })
      .filter(Boolean)
      .sort((a, b) => a.t - b.t);
    let before = null;
    let after = null;
    for (const entry of entries) {
      if (entry.t <= snapT + 1e-6) before = entry;
      if (!after && entry.t >= snapT - 1e-6) after = entry;
    }
    const chosen = [];
    if (before) chosen.push(before);
    if (after && (!before || after.node.id !== before.node.id)) chosen.push(after);
    if (!chosen.length && entries.length) {
      chosen.push(...entries.sort((a, b) => a.tDist - b.tDist).slice(0, 2));
    }
    return chosen
      .sort((a, b) => a.tDist - b.tDist)
      .map(e => e.node);
  }

  function _segmentSupportedByRoad(a, b, routing, eps = 0.75) {
    if (_samePoint(a, b, eps)) return true;
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    for (const edge of routing.edges) {
      if (!edge.points || edge.points.length < 2) continue;
      const sa = _closestOnPolyline(a.x, a.y, edge.points);
      if (!sa || sa.dist > eps) continue;
      const sb = _closestOnPolyline(b.x, b.y, edge.points);
      if (!sb || sb.dist > eps) continue;
      const sm = _closestOnPolyline(mid.x, mid.y, edge.points);
      if (!sm || sm.dist > eps) continue;
      const sub = _subPolyline(edge.points, sa.edgeT, sb.edgeT);
      const along = _polylineLen(sub);
      const direct = Math.hypot(b.x - a.x, b.y - a.y);
      if (along <= direct + eps * 2.5) return true;
    }
    return false;
  }

  function _routeSupportedByRoads(waypoints, routing) {
    if (!waypoints || waypoints.length < 2) return false;
    for (let i = 0; i + 1 < waypoints.length; i++) {
      if (!_segmentSupportedByRoad(waypoints[i], waypoints[i + 1], routing)) return false;
    }
    return true;
  }

  // Build waypoints from snap-A → road nodes → snap-B using stored segment geometry.
  function _buildWaypoints(bldA, nA, bldB, nB, result, routing) {
    const waypoints = [];

    const edgeA = routing.edges.find(e => e.id === bldA.snapEdgeId);
    const tA_node = routing.nodeEdgeTs.get(`${nA.id}:${bldA.snapEdgeId}`);
    if (edgeA && tA_node !== undefined) {
      const sub = _subPolyline(edgeA.points, bldA.snapT, tA_node);
      for (const p of (sub.length > 0 ? sub : [bldA.snapPoint])) _pushPoint(waypoints, p);
    } else {
      _pushPoint(waypoints, bldA.snapPoint);
      _pushPoint(waypoints, { x: nA.x, y: nA.y });
    }

    for (const adj of result.adjSteps) {
      if (adj?.segPts?.length > 1) {
        for (const p of adj.segPts) _pushPoint(waypoints, p);
      } else if (adj) {
        const nb = routing.nodeById.get(adj.nodeId);
        if (nb) _pushPoint(waypoints, { x: nb.x, y: nb.y });
      }
    }

    const edgeB = routing.edges.find(e => e.id === bldB.snapEdgeId);
    const tB_node = routing.nodeEdgeTs.get(`${nB.id}:${bldB.snapEdgeId}`);
    if (edgeB && tB_node !== undefined) {
      const sub = _subPolyline(edgeB.points, tB_node, bldB.snapT);
      for (const p of (sub.length > 1 ? sub : [bldB.snapPoint])) _pushPoint(waypoints, p);
    } else {
      _pushPoint(waypoints, bldB.snapPoint);
    }

    return _simplifyNearlyCollinear(waypoints);
  }

  // ── Public API ────────────────────────────────────────────────

  function enrichCity(city) {
    const waterSegs = _waterSegmentsFromTerrain(city.terrain);
    const bridges = (city.bridgePlan && city.bridgePlan.bridges) || [];
    // Densify edges to match the rendered curve geometry, not the raw BSP control polyline.
    const denseEdges = _densifyEdges(city.roadGraph.edges);
    _enrichBuildings(city.buildingPlan.buildings, denseEdges);
    const graph = _buildRoadGraph(denseEdges, waterSegs, bridges);
    city.roadGraph.nodes = graph.nodes;
    city._routing = graph;
    return city;
  }

  /**
   * Find shortest road path between two buildings.
   * Tries up to SNAP_CANDIDATES entry edges per building — prevents coast-road
   * overshoot where the nearest road requires a long detour.
   * Returns { waypoints, distance, nodeIds, buildingIds } or null.
   */
  function findPath(city, buildingIdA, buildingIdB) {
    const r = city._routing;
    if (!r) return null;

    const bldA = city.buildingPlan.buildings.find(b => b.id === buildingIdA);
    const bldB = city.buildingPlan.buildings.find(b => b.id === buildingIdB);
    if (!bldA?.snapCandidates?.length || !bldB?.snapCandidates?.length) return null;

    let bestWaypoints = null, bestDist = Infinity;

    for (const candA of bldA.snapCandidates) {
      const edgeA = r.edges.find(e => e.id === candA.edgeId);
      if (!edgeA) continue;

      for (const candB of bldB.snapCandidates) {
        const edgeB = r.edges.find(e => e.id === candB.edgeId);
        if (!edgeB) continue;

        // Build temporary building-like objects with the current candidate's snap data.
        const bA = { ...bldA, snapEdgeId: candA.edgeId, snapPoint: candA.snapPoint, snapT: candA.snapT };
        const bB = { ...bldB, snapEdgeId: candB.edgeId, snapPoint: candB.snapPoint, snapT: candB.snapT };

        // Same edge: trace directly. This does not need graph nodes; a quiet
        // street with no intersections is still a valid street-level route.
        if (candA.edgeId === candB.edgeId) {
          const sub = _subPolyline(edgeA.points, candA.snapT, candB.snapT);
          const waypoints = sub.length >= 2 ? sub : [candA.snapPoint, candB.snapPoint];
          const d = _polylineLen(waypoints);
          if (d < bestDist && _routeSupportedByRoads(waypoints, r)) {
            bestDist = d;
            bestWaypoints = waypoints;
          }
          continue;
        }

        const nodesA = _snapNodes(candA.edgeId, candA.snapT, r);
        const nodesB = _snapNodes(candB.edgeId, candB.snapT, r);
        if (!nodesA.length || !nodesB.length) continue;

        for (const nA of nodesA) {
          for (const nB of nodesB) {
            if (nA.id === nB.id) {
              const tA = r.nodeEdgeTs.get(`${nA.id}:${candA.edgeId}`) ?? 0;
              const tB = r.nodeEdgeTs.get(`${nB.id}:${candB.edgeId}`) ?? 0;
              const segA = _subPolyline(edgeA.points, candA.snapT, tA);
              const segB = _subPolyline(edgeB.points, tB, candB.snapT);
              const d = _polylineLen(segA) + _polylineLen(segB);
              const waypoints = [];
              for (const p of segA) _pushPoint(waypoints, p);
              for (const p of segB) _pushPoint(waypoints, p);
              if (d < bestDist && _routeSupportedByRoads(waypoints, r)) {
                bestDist = d;
                const simplified = _simplifyNearlyCollinear(waypoints);
                bestWaypoints = _routeSupportedByRoads(simplified, r) ? simplified : waypoints;
              }
              continue;
            }

            const result = _dijkstra(r.adjacency, nA.id, nB.id);
            if (!result) continue;

            const tA = r.nodeEdgeTs.get(`${nA.id}:${candA.edgeId}`) ?? 0;
            const tB = r.nodeEdgeTs.get(`${nB.id}:${candB.edgeId}`) ?? 0;
            const snapDistA = _polylineLen(_subPolyline(edgeA.points, candA.snapT, tA));
            const snapDistB = _polylineLen(_subPolyline(edgeB.points, tB, candB.snapT));
            const total = snapDistA + result.distance + snapDistB;

            if (total < bestDist) {
              const waypoints = _buildWaypoints(bA, nA, bB, nB, result, r);
              if (_routeSupportedByRoads(waypoints, r)) {
                bestDist = total;
                bestWaypoints = waypoints;
              }
            }
          }
        }
      }
    }

    if (!bestWaypoints || bestWaypoints.length < 2) return null;
    return { waypoints: bestWaypoints, distance: bestDist, buildingIds: [buildingIdA, buildingIdB] };
  }

  /** Convert waypoints to SVG path string. smooth=false: roads carry their own curves. */
  function routeToSvgPath(waypoints, smooth = false) {
    if (!waypoints || waypoints.length < 2) return "";
    let d = `M ${waypoints[0].x.toFixed(2)} ${waypoints[0].y.toFixed(2)}`;
    for (let i = 1; i < waypoints.length; i++) d += ` L ${waypoints[i].x.toFixed(2)} ${waypoints[i].y.toFixed(2)}`;
    return d;
  }

  /** Nearest building centroid to pixel (x,y). For click-to-select. */
  function nearestBuilding(city, x, y) {
    let best = null, bestDist = Infinity;
    for (const b of city.buildingPlan.buildings) {
      if (!b.centroid) continue;
      const d = Math.hypot(b.centroid.x - x, b.centroid.y - y);
      if (d < bestDist) { bestDist = d; best = b; }
    }
    return best;
  }

  /**
   * For card slot → building linkage (future use).
   * Returns nearest building centroid within same block as slot.
   * slot: { blockId, x, y }
   */
  function nearestBuildingToSlot(city, slot) {
    const inBlock = city.buildingPlan.buildings.filter(b => b.cellId === slot.blockId && b.centroid);
    if (!inBlock.length) return null;
    let best = null, bestDist = Infinity;
    for (const b of inBlock) {
      const d = Math.hypot(b.centroid.x - slot.x, b.centroid.y - slot.y);
      if (d < bestDist) { bestDist = d; best = b; }
    }
    return best;
  }

  /** 
   * High-level wrapper that accepts arbitrary coordinates, maps them to the nearest
   * map features, and guarantees the output route connects exactly to the given points.
   */
  function findPathBetweenCoords(city, x1, y1, x2, y2) {
    const bA = nearestBuilding(city, x1, y1);
    const bB = nearestBuilding(city, x2, y2);
    if (!bA || !bB) return null;
    
    const result = findPath(city, bA.id, bB.id);
    if (!result || !result.waypoints) return null;
    
    // Inject the exact start/end coordinates so the SVG connects perfectly to the target
    const waypoints = [{x: x1, y: y1}, ...result.waypoints, {x: x2, y: y2}];
    return { ...result, waypoints };
  }

  window.CityMapRoutingV1 = {
    enrichCity, findPath, routeToSvgPath, nearestBuilding, nearestBuildingToSlot, findPathBetweenCoords
  };
})();
