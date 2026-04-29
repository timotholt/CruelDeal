(function () {
  "use strict";

  const {
    VIEW_W,
    VIEW_H
  } = window.CityMapConfigV3;

  const {
    polygonCentroid,
    pointToSegmentDist,
    distToRiver
  } = window.CityMapGeometryV3;

  const SAMPLE_STEP = 42;

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function normAngle(angle) {
    let a = angle % Math.PI;
    if (a < 0) a += Math.PI;
    return a;
  }

  function angleDelta(a, b) {
    let d = Math.abs(normAngle(a) - normAngle(b));
    return d > Math.PI / 2 ? Math.PI - d : d;
  }

  function dist(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function polygonEdges(polygon) {
    const edges = [];
    for (let i = 0; i < polygon.length; i++) {
      edges.push({ a: polygon[i], b: polygon[(i + 1) % polygon.length] });
    }
    return edges;
  }

  function longestEdgeAngle(polygon) {
    let best = null;
    for (const edge of polygonEdges(polygon)) {
      const dx = edge.b.x - edge.a.x;
      const dy = edge.b.y - edge.a.y;
      const len = Math.hypot(dx, dy);
      if (!best || len > best.len) best = { len, angle: Math.atan2(dy, dx) };
    }
    return best ? normAngle(best.angle) : 0;
  }

  function nearestCoast(point, terrain, landmassId) {
    let best = null;
    for (const edge of terrain.coastline.edges || []) {
      if (landmassId && edge.landmassId !== landmassId) continue;
      const d = pointToSegmentDist(point.x, point.y, edge.a, edge.b);
      if (!best || d < best.d) {
        best = {
          d,
          angle: Math.atan2(edge.b.y - edge.a.y, edge.b.x - edge.a.x),
          edge
        };
      }
    }
    return best;
  }

  function nearestRiver(point, terrain) {
    let best = null;
    for (const body of terrain.waterBodies || []) {
      if (body.kind !== "river" || !body.segments) continue;
      const d = distToRiver(point.x, point.y, body.segments);
      if (!best || d < best.d) {
        let bestSeg = body.segments[0];
        let bestSegD = Infinity;
        for (const seg of body.segments) {
          const sd = pointToSegmentDist(point.x, point.y, seg.a, seg.b);
          if (sd < bestSegD) {
            bestSegD = sd;
            bestSeg = seg;
          }
        }
        best = {
          d,
          angle: bestSeg ? Math.atan2(bestSeg.b.y - bestSeg.a.y, bestSeg.b.x - bestSeg.a.x) : Math.PI / 2,
          body
        };
      }
    }
    return best;
  }

  function radialAngle(point, origin) {
    return normAngle(Math.atan2(point.y - origin.y, point.x - origin.x) + Math.PI / 2);
  }

  function strengthAt(element, point, terrain) {
    if (element.kind === "grid") return element.strength;
    if (element.kind === "radial") {
      const d = dist(point, element.origin);
      return element.strength * clamp(1 - d / element.radius, 0, 1);
    }
    if (element.kind === "coastFollow") {
      const coast = nearestCoast(point, terrain, element.landmassId);
      if (!coast) return 0;
      return element.strength * clamp(1 - coast.d / element.radius, 0, 1);
    }
    if (element.kind === "riverFollow") {
      const river = nearestRiver(point, terrain);
      if (!river) return 0;
      return element.strength * clamp(1 - river.d / element.radius, 0, 1);
    }
    if (element.kind === "diagonalCorridor") {
      const dx = point.x - element.origin.x;
      const dy = point.y - element.origin.y;
      const normal = { x: -Math.sin(element.angle), y: Math.cos(element.angle) };
      const lateral = Math.abs(dx * normal.x + dy * normal.y);
      return element.strength * clamp(1 - lateral / element.radius, 0, 1);
    }
    if (element.kind === "hillAvoidance") {
      const d = dist(point, element.origin);
      return element.strength * clamp(1 - d / element.radius, 0, 1);
    }
    return 0;
  }

  function elementAngle(element, point, terrain) {
    if (element.kind === "coastFollow") {
      const coast = nearestCoast(point, terrain, element.landmassId);
      return normAngle(coast ? coast.angle : element.angle);
    }
    if (element.kind === "riverFollow") {
      const river = nearestRiver(point, terrain);
      return normAngle(river ? river.angle : element.angle);
    }
    if (element.kind === "radial") return radialAngle(point, element.origin);
    return normAngle(element.angle);
  }

  function makeSampler(fieldElements, terrain) {
    return function sample(point) {
      const weighted = [];
      let vx = 0;
      let vy = 0;
      let total = 0;

      for (const element of fieldElements) {
        const strength = strengthAt(element, point, terrain);
        if (strength <= 0.001) continue;
        const angle = elementAngle(element, point, terrain);
        weighted.push({ element, angle, strength });
        vx += Math.cos(angle * 2) * strength;
        vy += Math.sin(angle * 2) * strength;
        total += strength;
      }

      weighted.sort((a, b) => b.strength - a.strength);
      const primaryAngle = total > 0 ? normAngle(Math.atan2(vy, vx) / 2) : 0;
      let secondaryAngle = weighted[1] ? weighted[1].angle : primaryAngle + Math.PI / 2;
      if (angleDelta(primaryAngle, secondaryAngle) < 0.18) secondaryAngle = primaryAngle + Math.PI / 2;

      const river = nearestRiver(point, terrain);
      const coast = nearestCoast(point, terrain);
      const nearWater = (river && river.d < 24) || (coast && coast.d < 18);
      const elevation = window.CityMapTerrainV4.sampleElevation(point.x, point.y, terrain);

      return {
        primaryAngle: normAngle(primaryAngle),
        secondaryAngle: normAngle(secondaryAngle),
        strength: clamp(total / 2.7, 0, 1),
        density: elevation > 0.3 || nearWater ? "sparse" : total > 1.9 ? "dense" : "medium",
        avoidWater: nearWater,
        avoidSteepTerrain: elevation > 0.34,
        fieldElementIds: weighted.slice(0, 3).map(w => w.element.id)
      };
    };
  }

  function fieldElementsForLandmass(landmass, terrain, rng) {
    const elements = [];
    const centroid = landmass.centroid || polygonCentroid(landmass.polygon);
    const base = longestEdgeAngle(landmass.polygon);
    const primaryAngle = normAngle(base + (rng() - 0.5) * 0.28);
    const secondaryAngle = normAngle(primaryAngle + Math.PI / 2 + (rng() - 0.5) * 0.2);
    const prefix = landmass.id;

    elements.push({
      id: `${prefix}:grid:primary`,
      kind: "grid",
      origin: centroid,
      angle: primaryAngle,
      strength: landmass.kind === "island" ? 1.0 : 1.25,
      radius: Math.max(VIEW_W, VIEW_H),
      falloff: "none",
      landmassId: landmass.id,
      priority: 10
    });

    if (landmass.kind !== "island" || rng() < 0.62) {
      elements.push({
        id: `${prefix}:grid:secondary`,
        kind: "grid",
        origin: centroid,
        angle: secondaryAngle,
        strength: landmass.kind === "island" ? 0.26 : 0.38 + rng() * 0.2,
        radius: Math.max(VIEW_W, VIEW_H),
        falloff: "none",
        landmassId: landmass.id,
        priority: 5
      });
    }

    elements.push({
      id: `${prefix}:coast-follow`,
      kind: "coastFollow",
      origin: centroid,
      angle: primaryAngle,
      strength: landmass.kind === "island" ? 0.74 : 0.48,
      radius: landmass.kind === "island" ? 52 : 34,
      falloff: "linear",
      landmassId: landmass.id,
      priority: 8
    });

    if (landmass.kind !== "island" && rng() < 0.5) {
      const diag = rng() < 0.5 ? Math.PI / 4 : -Math.PI / 4;
      elements.push({
        id: `${prefix}:diagonal-corridor`,
        kind: "diagonalCorridor",
        origin: {
          x: centroid.x + (rng() - 0.5) * 80,
          y: centroid.y + (rng() - 0.5) * 80
        },
        angle: normAngle(primaryAngle + diag + (rng() - 0.5) * 0.18),
        strength: 0.72,
        radius: 28 + rng() * 18,
        falloff: "linear",
        landmassId: landmass.id,
        priority: 7
      });
    }

    if (landmass.kind !== "island" && rng() < 0.46) {
      elements.push({
        id: `${prefix}:radial-anchor`,
        kind: "radial",
        origin: {
          x: centroid.x + (rng() - 0.5) * 90,
          y: centroid.y + (rng() - 0.5) * 90
        },
        angle: primaryAngle,
        strength: 0.42,
        radius: 86 + rng() * 70,
        falloff: "linear",
        landmassId: landmass.id,
        priority: 4
      });
    }

    return elements;
  }

  function makeSamples(sample, terrain) {
    const samples = [];
    for (let x = SAMPLE_STEP / 2; x < VIEW_W; x += SAMPLE_STEP) {
      for (let y = SAMPLE_STEP / 2; y < VIEW_H; y += SAMPLE_STEP) {
        const point = { x, y };
        const s = sample(point);
        samples.push({
          point,
          primaryAngle: s.primaryAngle,
          secondaryAngle: s.secondaryAngle,
          strength: s.strength,
          density: s.density,
          tags: [
            s.avoidWater ? "water-influence" : null,
            s.avoidSteepTerrain ? "hill-influence" : null
          ].filter(Boolean)
        });
      }
    }
    return samples;
  }

  function generateField(terrain, rng) {
    const fieldElements = [];
    for (const landmass of terrain.landmasses) {
      fieldElements.push(...fieldElementsForLandmass(landmass, terrain, rng));
    }

    if ((terrain.waterBodies || []).some(w => w.kind === "river")) {
      fieldElements.push({
        id: "river-follow",
        kind: "riverFollow",
        origin: terrain.mainland.centroid,
        angle: Math.PI / 2,
        strength: 0.76,
        radius: 42,
        falloff: "linear",
        landmassId: terrain.mainland.id,
        priority: 9
      });
    }

    for (const hill of terrain.elevation.hills || []) {
      fieldElements.push({
        id: `hill-avoidance:${hill.id}`,
        kind: "hillAvoidance",
        origin: { x: hill.x, y: hill.y },
        angle: normAngle(Math.atan2(hill.y - terrain.mainland.centroid.y, hill.x - terrain.mainland.centroid.x) + Math.PI / 2),
        strength: 0.22 + hill.height * 0.38,
        radius: hill.radius * 0.72,
        falloff: "linear",
        landmassId: terrain.mainland.id,
        priority: 2
      });
    }

    const sample = makeSampler(fieldElements, terrain);
    return {
      version: 1,
      terrainVersion: terrain.version,
      fieldElements,
      samples: makeSamples(sample, terrain),
      sample
    };
  }

  function buildField(seed = 1, terrain = null) {
    const normalizedSeed = Number.isFinite(seed) ? (seed >>> 0) || 1 : 1;
    const baseTerrain = terrain || window.CityMapTerrainV4.buildTerrain(normalizedSeed);
    return generateField(baseTerrain, window.makeRng(normalizedSeed ^ 0xf13d));
  }

  function fieldSummary(field) {
    const counts = {};
    for (const element of field.fieldElements) counts[element.kind] = (counts[element.kind] || 0) + 1;
    return {
      elements: field.fieldElements.length,
      samples: field.samples.length,
      kinds: counts
    };
  }

  window.CityMapFieldV4 = {
    buildField,
    generateField,
    fieldSummary,
    normAngle
  };
})();
