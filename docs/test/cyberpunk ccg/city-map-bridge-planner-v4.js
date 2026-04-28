(function () {
  "use strict";

  const {
    segIntersect
  } = window.CityMapGeometryV3;

  const {
    straightPolylinePath
  } = window.CityMapPathsV3;

  function pointAlong(a, b, distance) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    return {
      x: a.x + (dx / len) * distance,
      y: a.y + (dy / len) * distance
    };
  }

  function makeDeck(a, b, halfLength) {
    const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    return {
      center,
      a: pointAlong(center, a, halfLength),
      b: pointAlong(center, b, halfLength),
      angle: Math.atan2(b.y - a.y, b.x - a.x),
      length: halfLength * 2
    };
  }

  function riverBridgeCandidates(roadGraph, terrain) {
    const bridges = [];
    const riverBodies = terrain.waterBodies.filter(w => w.kind === "river" && w.segments);
    for (const road of roadGraph.edges.filter(e => e.kind === "highway" || e.kind === "avenue")) {
      for (let i = 0; i < road.points.length - 1; i++) {
        const ra = road.points[i];
        const rb = road.points[i + 1];
        for (const river of riverBodies) {
          for (const segment of river.segments) {
            const hit = segIntersect(ra, rb, segment.a, segment.b);
            if (!hit) continue;
            const deck = makeDeck(ra, rb, Math.max(12, (river.outerWidth || 8) * 1.3));
            bridges.push({
              id: `river-bridge-${bridges.length + 1}`,
              kind: "river",
              roadEdgeId: road.id,
              waterBodyId: river.id,
              fromNode: road.from,
              toNode: road.to,
              deckWidth: road.kind === "highway" ? 7 : 4.5,
              clearanceWidth: river.outerWidth || 8,
              center: hit,
              angle: deck.angle,
              points: [deck.a, deck.b],
              path: straightPolylinePath([deck.a, deck.b]),
              score: road.kind === "highway" ? 120 : 84
            });
          }
        }
      }
    }
    return dedupeNearbyBridges(bridges, 18);
  }

  function channelBridgeCandidates(roadGraph) {
    return roadGraph.bridgeCandidates.map((candidate, i) => {
      const aNode = roadGraph.nodes.find(n => n.id === candidate.fromNode);
      const bNode = roadGraph.nodes.find(n => n.id === candidate.toNode);
      const points = aNode && bNode ? [aNode.point, bNode.point] : [];
      return {
        id: `channel-bridge-${i + 1}`,
        kind: "channel",
        channelId: candidate.channelId,
        fromNode: candidate.fromNode,
        toNode: candidate.toNode,
        fromCellId: candidate.fromCellId,
        toCellId: candidate.toCellId,
        deckWidth: 4.5,
        clearanceWidth: candidate.minWaterWidth,
        center: points.length ? { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 } : null,
        angle: points.length ? Math.atan2(points[1].y - points[0].y, points[1].x - points[0].x) : 0,
        points,
        path: points.length ? straightPolylinePath(points) : "",
        score: candidate.score
      };
    });
  }

  function dedupeNearbyBridges(bridges, minDistance) {
    const sorted = [...bridges].sort((a, b) => b.score - a.score);
    const kept = [];
    for (const bridge of sorted) {
      let tooClose = false;
      for (const existing of kept) {
        if (bridge.waterBodyId === existing.waterBodyId &&
            Math.hypot(bridge.center.x - existing.center.x, bridge.center.y - existing.center.y) < minDistance) {
          tooClose = true;
          break;
        }
      }
      if (!tooClose) kept.push(bridge);
    }
    kept.sort((a, b) => a.id.localeCompare(b.id));
    return kept;
  }

  function planBridges(districtResult) {
    const riverBridges = riverBridgeCandidates(districtResult.roadGraph, districtResult.terrain);
    const channelBridges = channelBridgeCandidates(districtResult.roadGraph)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
    const bridges = [...riverBridges, ...channelBridges].map((bridge, i) => ({
      ...bridge,
      id: `bridge-${i + 1}`
    }));
    return {
      version: 1,
      bridges,
      riverBridges: bridges.filter(b => b.kind === "river").map(b => b.id),
      channelBridges: bridges.filter(b => b.kind === "channel").map(b => b.id)
    };
  }

  function buildBridgePlan(seed = 1) {
    const normalizedSeed = Number.isFinite(seed) ? (seed >>> 0) || 1 : 1;
    const districtResult = window.CityMapDistrictsV4.buildDistricts(normalizedSeed);
    const bridgePlan = planBridges(districtResult);
    return { ...districtResult, bridgePlan };
  }

  function bridgeSummary(result) {
    return {
      bridges: result.bridgePlan.bridges.length,
      riverBridges: result.bridgePlan.riverBridges.length,
      channelBridges: result.bridgePlan.channelBridges.length
    };
  }

  window.CityMapBridgePlannerV4 = {
    buildBridgePlan,
    planBridges,
    bridgeSummary
  };
})();
