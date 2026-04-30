/* global React */
(function () {
  "use strict";

  const { useMemo } = React;
  const { VIEW_W, VIEW_H, PAL, DISTRICT_SHORT_NAMES } = window.CityMapConfigV3;
  const { polygonToPath } = window.CityMapPathsV3;
  const { polygonBBox } = window.CityMapGeometryV3;

  const V4_PAL = {
    water: PAL.water,
    land: PAL.land,
    coast: PAL.coastRoad,
    roadUnderlay: PAL.labelStroke,
    roadLocal: PAL.streetLocal,
    roadMain: PAL.streetMain,
    avenue: PAL.avenue,
    highway: PAL.hwyInner,
    hoverFill: PAL.regionGlow,
    hoverStroke: PAL.hwyInner
  };

  function shrinkPolygon(polygon, amount) {
    const cx = polygon.reduce((s, p) => s + p.x, 0) / polygon.length;
    const cy = polygon.reduce((s, p) => s + p.y, 0) / polygon.length;
    return polygon.map(p => {
      const dx = p.x - cx, dy = p.y - cy;
      const len = Math.hypot(dx, dy) || 1;
      return { x: p.x - (dx / len) * amount, y: p.y - (dy / len) * amount };
    });
  }

  // Fractal lake shape generator using multi-octave radial noise.
  // Creates organic, irregular shapes: ovals, peanuts, multiple puddles, etc.
  function generateFractalLakePolygon(cellPolygon, rng, numPoints = 32) {
    // Compute centroid and average radius from cell polygon
    const cx = cellPolygon.reduce((s, p) => s + p.x, 0) / cellPolygon.length;
    const cy = cellPolygon.reduce((s, p) => s + p.y, 0) / cellPolygon.length;
    let minR = Infinity;
    for (const p of cellPolygon) {
      const d = Math.hypot(p.x - cx, p.y - cy);
      if (d < minR) minR = d;
    }
    // Lake fits inside cell with padding for park borders
    const baseR = minR * 0.55;

    // Decide lake type: simple, peanut, or multi-puddle
    const lakeType = rng();
    const isMultiPuddle = lakeType < 0.25;
    const isPeanut = lakeType < 0.55;

    if (isMultiPuddle) {
      // Multiple overlapping puddles
      const puddles = [];
      const pudgleCount = 2 + Math.floor(rng() * 2);
      for (let p = 0; p < pudgleCount; p++) {
        const angle = (p / pudgleCount) * Math.PI * 2 + rng() * 0.4;
        const dist = baseR * (0.3 + rng() * 0.3);
        const px = cx + Math.cos(angle) * dist;
        const py = cy + Math.sin(angle) * dist;
        const pr = baseR * (0.35 + rng() * 0.25);
        puddles.push({ x: px, y: py, r: pr });
      }
      // Render puddles
      const allPoints = [];
      for (const puddle of puddles) {
        for (let i = 0; i < numPoints / puddles.length; i++) {
          const angle = (i / (numPoints / puddles.length)) * Math.PI * 2;
          const noise = Math.sin(angle * 3 + rng() * Math.PI) * 0.2;
          const r = puddle.r * (0.9 + noise);
          allPoints.push({
            x: puddle.x + Math.cos(angle) * r,
            y: puddle.y + Math.sin(angle) * r
          });
        }
      }
      return allPoints;
    }

    // Pre-generate octave amplitudes and phase offsets for multi-octave noise
    const octaves = 5;
    const octaveData = [];
    for (let o = 0; o < octaves; o++) {
      octaveData.push({
        freq: Math.pow(2, o) * (1 + rng() * 0.4),
        phase: rng() * Math.PI * 2,
        amp: Math.pow(0.55, o)
      });
    }

    // Random aspect ratio for ellipse-like base
    let aspectX = 0.85 + rng() * 0.4;
    let aspectY = 0.85 + rng() * 0.4;
    
    // Peanut shape: extreme aspect ratio with pinch in middle
    if (isPeanut) {
      aspectX = 0.6 + rng() * 0.3;
      aspectY = 1.2 + rng() * 0.4;
    }

    const tilt = rng() * Math.PI;
    const cosT = Math.cos(tilt), sinT = Math.sin(tilt);

    const points = [];
    for (let i = 0; i < numPoints; i++) {
      const angle = (i / numPoints) * Math.PI * 2;
      // Sum sinusoids at different frequencies for fractal noise
      let noise = 0;
      let totalAmp = 0;
      for (const o of octaveData) {
        noise += Math.sin(angle * o.freq + o.phase) * o.amp;
        totalAmp += o.amp;
      }
      noise /= totalAmp; // normalize to roughly [-1, 1]

      // For peanut shapes, add pinch effect at poles
      let radiusModulation = 0.85 + noise * 0.35;
      if (isPeanut) {
        const pinch = Math.cos(angle * 2) * 0.3; // pinch at top/bottom
        radiusModulation *= (0.7 + pinch * 0.5);
      }

      const r = baseR * radiusModulation;
      // Apply aspect ratio + rotation for organic non-circular base
      const ux = Math.cos(angle) * r * aspectX;
      const uy = Math.sin(angle) * r * aspectY;
      points.push({
        x: cx + ux * cosT - uy * sinT,
        y: cy + ux * sinT + uy * cosT
      });
    }
    return points;
  }

  function buildingStroke(building) {
    if (building.render.lodGroup === "lowrise") return "hsla(215, 82%, 54%, 0.16)";
    return "hsla(215, 84%, 58%, 0.22)";
  }

  function districtLabel(district) {
    const text = district.name || district.id;
    const maxLen = district.bbox && district.bbox.w < 70 ? 4 : 9;
    return text.length > maxLen ? text.slice(0, maxLen) : text;
  }

  function labelMetrics(text) {
    return {
      halfW: text.length * 4.8 + Math.max(0, text.length - 1) * 1.05,
      halfH: 6
    };
  }

  function labelFitsBounds(text, anchor, bounds, pad = 3) {
    if (!text || !anchor || !bounds) return false;
    const m = labelMetrics(text);
    return anchor.x - m.halfW >= bounds.minX + pad &&
      anchor.x + m.halfW <= bounds.maxX - pad &&
      anchor.y - m.halfH >= bounds.minY + pad &&
      anchor.y + m.halfH <= bounds.maxY - pad;
  }

  function labelFitsViewport(text, anchor, pad = 3) {
    return labelFitsBounds(text, anchor, { minX: 0, minY: 0, maxX: VIEW_W, maxY: VIEW_H }, pad);
  }

  function visibleDistrictLabel(district) {
    if (district.landmassId === "mainland") return districtLabel(district);
    const anchor = district.labelAnchor;
    const full = district.name || district.id;
    const short = DISTRICT_SHORT_NAMES[full] || full.slice(0, 3);
    const bounds = district.bbox;
    if (labelFitsViewport(full, anchor) && labelFitsBounds(full, anchor, bounds, 2)) return full;
    if (labelFitsViewport(short, anchor) && labelFitsBounds(short, anchor, bounds, 1)) return short;
    return null;
  }

  function districtClipPolygons(district) {
    const polygons = district.buildablePolygons || district.polygons;
    return Array.isArray(polygons) ? polygons.filter(Boolean) : [];
  }

  function districtHoverPolygons(district) {
    const polygons = district.ownershipPolygons || district.polygons;
    return Array.isArray(polygons) ? polygons.filter(Boolean) : [];
  }

  function roadColor(kind) {
    if (kind === "highway") return V4_PAL.highway;
    if (kind === "avenue") return V4_PAL.avenue;
    if (kind === "local") return V4_PAL.roadLocal;
    return V4_PAL.roadMain;
  }

  function roadWidth(kind) {
    if (kind === "highway") return 1.42;
    if (kind === "avenue") return 1.05;
    if (kind === "street") return 0.72;
    return 0.38;
  }

  function roadUnderlayWidth(kind) {
    if (kind === "highway") return 4.4;
    if (kind === "avenue") return 2.8;
    if (kind === "street") return 1.75;
    return 0.9;
  }

  function segmentLength(segment) {
    return Math.hypot(segment.b.x - segment.a.x, segment.b.y - segment.a.y);
  }

  function segmentIsMostlyCardinal(segment) {
    const dx = Math.abs(segment.b.x - segment.a.x);
    const dy = Math.abs(segment.b.y - segment.a.y);
    if (dx < 0.01 || dy < 0.01) return true;
    const ratio = Math.max(dx, dy) / Math.max(0.01, Math.min(dx, dy));
    return ratio >= 2.35;
  }

  function majorDistrictBoundaryPath(district) {
    return (district.boundarySegments || [])
      .filter((segment) => segmentLength(segment) >= 7.5 && segmentIsMostlyCardinal(segment))
      .map((segment) => (
        `M ${segment.a.x.toFixed(2)} ${segment.a.y.toFixed(2)} L ${segment.b.x.toFixed(2)} ${segment.b.y.toFixed(2)}`
      )).join(" ");
  }

  function districtClipId(idBase, district) {
    return `${idBase}-${district.id}-clip`;
  }

  function districtIndex(district) {
    const match = String(district.id || "").match(/(\d+)$/);
    return match ? Number(match[1]) - 1 : 0;
  }

  function districtGrid(district) {
    const idx = districtIndex(district);
    const spacing = district.bbox && Math.max(district.bbox.w, district.bbox.h) > 170 ? 18 : 15;
    const phaseX = (idx * 7) % spacing;
    const phaseY = (idx * 11) % spacing;
    const lines = [];
    const box = district.bbox;
    if (!box) return lines;
    for (let x = box.minX - spacing + phaseX; x <= box.maxX + spacing; x += spacing) {
      lines.push({ kind: "v", x });
    }
    for (let y = box.minY - spacing + phaseY; y <= box.maxY + spacing; y += spacing) {
      lines.push({ kind: "h", y });
    }
    return lines;
  }

  function structuredRoadPath(a, b, index) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (len < 1) return "";
    if (index % 3 === 0 || len < 96) {
      return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} L ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
    }
    const mostlyVertical = Math.abs(dy) > Math.abs(dx);
    const bend = Math.min(34, len * 0.18) * (index % 2 ? 1 : -1);
    const c1 = mostlyVertical
      ? { x: a.x + bend, y: a.y + dy * 0.32 }
      : { x: a.x + dx * 0.32, y: a.y + bend };
    const c2 = mostlyVertical
      ? { x: b.x + bend, y: b.y - dy * 0.32 }
      : { x: b.x - dx * 0.32, y: b.y + bend };
    return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} C ${c1.x.toFixed(2)} ${c1.y.toFixed(2)} ${c2.x.toFixed(2)} ${c2.y.toFixed(2)} ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
  }

  function districtRoadCenter(district) {
    const box = district.bbox;
    const anchor = district.labelAnchor || district.centroid || {
      x: box ? box.minX + box.w / 2 : VIEW_W / 2,
      y: box ? box.minY + box.h / 2 : VIEW_H / 2
    };
    return {
      x: Math.round(anchor.x / 8) * 8,
      y: Math.round(anchor.y / 8) * 8
    };
  }

  function blockRect(cell) {
    const box = polygonBBox(cell.polygon);
    const angle = cell.fieldAngle || cell.orientation || 0;
    const snappedTurns = Math.round(angle / (Math.PI / 2));
    const snappedAngle = snappedTurns * 90;
    const longSide = Math.max(box.w, box.h);
    const shortSide = Math.min(box.w, box.h);
    const module = cell.density === "dense" ? 8 : cell.density === "medium" ? 10 : 12;
    const w = Math.max(6, Math.min(20, Math.round(longSide * 0.58 / module) * module || module));
    const h = Math.max(5, Math.min(14, Math.round(shortSide * 0.52 / 4) * 4 || 6));
    return {
      x: cell.centroid.x - w / 2,
      y: cell.centroid.y - h / 2,
      w,
      h,
      angle: snappedAngle
    };
  }

  function renderBlockRect(cell, key, stroke, opacity = 1, fill = "none") {
    const rect = blockRect(cell);
    return (
      <rect
        key={key}
        x={rect.x}
        y={rect.y}
        width={rect.w}
        height={rect.h}
        transform={`rotate(${rect.angle.toFixed(2)} ${cell.centroid.x.toFixed(2)} ${cell.centroid.y.toFixed(2)})`}
        fill={fill}
        stroke={stroke}
        strokeWidth={0.12}
        opacity={opacity}
        rx={0.45}
        vectorEffect="non-scaling-stroke"
      />
    );
  }

  function seededRng(seed) {
    let t = seed >>> 0;
    return function () {
      t = (t + 0x6D2B79F5) >>> 0;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  function CityMapV4Preview({
    seed,
    width,
    height,
    opacity = 1,
    showLabels = true,
    showDebug = false,
    showBuildings = true,
    showCells = false,
    transparentParks = false,
    brightBuildings = false,
    buildingBorders = false,
    hoveredDistrictId = null
  }) {
    const [debugTransparentParks, setDebugTransparentParks] = React.useState(transparentParks);
    React.useEffect(() => {
      setDebugTransparentParks(transparentParks);
    }, [transparentParks]);
    const data = useMemo(
      () => window.CityMapV35 ? window.CityMapV35.buildCityV35(seed || 1) : window.CityMapV4.buildCityV4(seed || 1),
      [seed]
    );
    const idBase = `cv4-${seed || 1}`;
    const mainlandCoastRoad = data.roadGraph && data.roadGraph.edges
      ? data.roadGraph.edges.find((edge) => edge.id === "mainland-coast-road")
      : null;
    const mainlandBuildableClipId = `${idBase}-mainland-buildable`;
    const buildingFill = (building) => {
      let color = building.shade < 0.5 ? PAL.bldgB : PAL.bldgA;
      if (brightBuildings) {
        // Brighten by increasing lightness: replace "XX%" with higher value
        // PAL.bldgA/B are like "hsla(215, 45%, 38%, 0.78)" - increase the 38% to ~55%
        color = color.replace(/(\d+)%,\s*(\d+)%/, (match, sat, light) => {
          const newLight = Math.min(100, parseInt(light) + 17);
          return `${sat}%, ${newLight}%`;
        });
      }
      return color;
    };
    const renderBuilding = (building) => {
      return (
        <g key={building.id}>
          <path
            d={building.path}
            fill={buildingFill(building)}
            stroke={buildingStroke(building)}
            strokeWidth={0.08}
            vectorEffect="non-scaling-stroke"
          />
          {buildingBorders && (
            <path
              d={building.path}
              fill="none"
              stroke="#ff00ff"
              strokeWidth={0.4}
              vectorEffect="non-scaling-stroke"
              opacity={0.8}
            />
          )}
        </g>
      );
    };
    const renderOpenSpace = (space) => {
      const cell = data.cells.find(c => c.id === space.cellId);
      if (!cell) return null;
      const parkFill = "hsla(145, 54%, 58%, 0.45)";
      const parkStroke = "hsla(145, 62%, 66%, 0.62)";
      if (space.kind === "park") {
        const area = cell.area || cell.polygon.reduce((a, _, i, p) => {
          const j = (i + 1) % p.length;
          return a + p[i].x * p[j].y - p[j].x * p[i].y;
        }, 0) / 2;
        const isLargePark = Math.abs(area) > 2500;
        const cellHash = cell.id.split("").reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 0);
        const rng = seededRng((seed || 1) ^ cellHash);
        const hasLake = isLargePark && rng() < 0.4;
        if (hasLake) {
          const lakePoly = generateFractalLakePolygon(cell.polygon, rng);
          const waterPath = window.CityMapPathsV3.smoothClosedPath(lakePoly);
          return (
            <g key={space.id}>
              <path d={cell.path} fill={debugTransparentParks ? "transparent" : parkFill} stroke={parkStroke} strokeWidth={0.18} opacity={0.78} vectorEffect="non-scaling-stroke" />
              <path d={waterPath} fill={V4_PAL.water} />
            </g>
          );
        }
      }
      if (space.kind === "compound") {
        return (
          <g key={space.id}>
            {renderBlockRect(cell, `${space.id}-plot`, PAL.plaza, 0.22, PAL.plaza)}
            {space.accessPath && (
              <path
                d={space.accessPath}
                fill="none"
                stroke={PAL.streetLocal}
                strokeWidth={0.32}
                opacity={0.62}
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            )}
            {(space.features || []).map((feature, index) => (
              <path
                key={`${space.id}-feature-${index}`}
                d={feature.path}
                fill={PAL.stadium}
                stroke={PAL.mallAccent}
                strokeWidth={0.1}
                opacity={feature.opacity || 0.42}
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </g>
        );
      }
      if (space.kind === "park" && space.role === "landmark") {
        if (space.parkRoad) {
          const { p1, p2, bend } = space.parkRoad;
          const roadPath = bend
            ? `M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} Q ${bend.x.toFixed(2)} ${bend.y.toFixed(2)} ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`
            : `M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} L ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
          return (
            <g key={space.id}>
              <path d={cell.path} fill={debugTransparentParks ? "transparent" : parkFill} stroke={parkStroke} strokeWidth={0.18} opacity={0.78} vectorEffect="non-scaling-stroke" />
              <path d={roadPath} fill="none" stroke={V4_PAL.roadUnderlay} strokeWidth={2.2} opacity={0.7} vectorEffect="non-scaling-stroke" strokeLinecap="round" />
              <path d={roadPath} fill="none" stroke={V4_PAL.roadLocal} strokeWidth={0.32} opacity={0.78} vectorEffect="non-scaling-stroke" strokeLinecap="round" />
            </g>
          );
        }
        return (
          <path
            key={space.id}
            d={cell.path}
            fill={debugTransparentParks ? "transparent" : parkFill}
            stroke={parkStroke}
            strokeWidth={0.18}
            opacity={0.78}
            vectorEffect="non-scaling-stroke"
          />
        );
      }
      return renderBlockRect(cell, space.id, parkStroke, 0.36, debugTransparentParks ? "transparent" : parkFill);
    };

    return (
      <div style={{ position: "relative" }}>
        {showDebug && (
          <button
            onClick={() => setDebugTransparentParks(!debugTransparentParks)}
            style={{
              position: "absolute",
              top: "8px",
              left: "8px",
              zIndex: 10,
              padding: "6px 12px",
              backgroundColor: debugTransparentParks ? "#4a9eff" : "#666",
              color: "white",
              border: "1px solid #aaa",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "12px",
              fontFamily: "monospace"
            }}
          >
            {debugTransparentParks ? "Parks: Transparent" : "Parks: Opaque"}
          </button>
        )}
        <svg
          className="city-map-v4-preview-svg"
          width={width || VIEW_W}
          height={height || VIEW_H}
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          preserveAspectRatio="none"
          style={{ opacity, display: "block", position: "absolute", left: 0, top: 0, pointerEvents: "none" }}
        >
        <defs>
          <clipPath id={`${idBase}-mainland`}>
            <path d={data.terrain.mainland.path} />
          </clipPath>
          {mainlandCoastRoad && (
            <clipPath id={mainlandBuildableClipId}>
              <path d={mainlandCoastRoad.path} />
            </clipPath>
          )}
          {data.districts.map((district) => (
            <clipPath key={`${district.id}-clip`} id={districtClipId(idBase, district)}>
              {districtClipPolygons(district).map((polygon, index) => (
                <path key={`${district.id}-clip-cell-${index}`} d={polygonToPath(polygon)} />
              ))}
            </clipPath>
          ))}
        </defs>

        <g>
          <rect x={0} y={0} width={VIEW_W} height={VIEW_H} fill={V4_PAL.water} />
          <rect x={0} y={0} width={VIEW_W} height={VIEW_H} fill="black" opacity={0.18} />
        </g>

        {data.terrain.landmasses.map((landmass) => (
          <g key={landmass.id}>
            <path d={landmass.path} fill={V4_PAL.land} />
            <path d={landmass.path} fill="black" opacity={0.18} />
            <path
              d={landmass.path}
              fill="none"
              stroke={PAL.streetLocal}
              strokeWidth={0.34}
              opacity={0.46}
              vectorEffect="non-scaling-stroke"
            />
          </g>
        ))}

        {data.coastDocks && data.coastDocks.length > 0 && (
          <g opacity={0.72}>
            {data.coastDocks.map((dock, index) => (
              <path
                key={`coast-dock-${index}`}
                d={dock.path}
                fill={PAL.bldgB}
                stroke={PAL.avenue}
                strokeWidth={0.14}
                opacity={0.78}
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </g>
        )}

        {data.architecture !== "v35" && (
          <g>
            {data.districts.map((district) => {
              const clipId = districtClipId(idBase, district);
              const center = districtRoadCenter(district);
              const box = district.bbox;
              if (!box) return null;
              return (
                <g key={`${district.id}-blocks`} clipPath={`url(#${clipId})`}>
                  {districtGrid(district).map((line, index) => (
                    line.kind === "v"
                      ? <line
                          key={`gv-${index}`}
                          x1={line.x} y1={box.minY - 8} x2={line.x} y2={box.maxY + 8}
                          stroke={PAL.streetLocal} strokeWidth={0.26} opacity={0.44}
                          vectorEffect="non-scaling-stroke"
                        />
                      : <line
                          key={`gh-${index}`}
                          x1={box.minX - 8} y1={line.y} x2={box.maxX + 8} y2={line.y}
                          stroke={PAL.streetLocal} strokeWidth={0.26} opacity={0.44}
                          vectorEffect="non-scaling-stroke"
                        />
                  ))}
                  <line
                    x1={center.x} y1={box.minY - 12} x2={center.x} y2={box.maxY + 12}
                    stroke={V4_PAL.roadUnderlay} strokeWidth={2.1} opacity={0.7}
                    vectorEffect="non-scaling-stroke"
                  />
                  <line
                    x1={box.minX - 12} y1={center.y} x2={box.maxX + 12} y2={center.y}
                    stroke={V4_PAL.roadUnderlay} strokeWidth={1.85} opacity={0.62}
                    vectorEffect="non-scaling-stroke"
                  />
                  <line
                    x1={center.x} y1={box.minY - 12} x2={center.x} y2={box.maxY + 12}
                    stroke={PAL.streetMain} strokeWidth={0.9} opacity={0.92}
                    vectorEffect="non-scaling-stroke"
                  />
                  <line
                    x1={box.minX - 12} y1={center.y} x2={box.maxX + 12} y2={center.y}
                    stroke={PAL.streetMain} strokeWidth={0.74} opacity={0.82}
                    vectorEffect="non-scaling-stroke"
                  />
                </g>
              );
            })}
          </g>
        )}

        {showCells && (
          <g opacity={0.54}>
            {mainlandCoastRoad && (
              <g clipPath={`url(#${mainlandBuildableClipId})`}>
                {data.cells.filter((cell) => cell.landmassId === "mainland" && cell.buildable).map((cell) => (
                  <path
                    key={cell.id}
                    d={cell.path}
                    fill="none"
                    stroke={cell.tags.includes("parkCandidate") ? PAL.park : PAL.streetLocal}
                    strokeWidth={0.18}
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
              </g>
            )}
            {data.cells.filter((cell) => cell.buildable && (!mainlandCoastRoad || cell.landmassId !== "mainland")).map((cell) => (
              <path
                key={cell.id}
                d={cell.path}
                fill="none"
                stroke={cell.tags.includes("parkCandidate") ? PAL.park : PAL.streetLocal}
                strokeWidth={0.18}
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </g>
        )}

        {showBuildings && (() => {
          // Pre-compute park cell polygons for spatial filtering
          const parkCells = data.buildingPlan.openSpaces
            .filter(s => s.kind === "park")
            .map(s => data.cells.find(c => c.id === s.cellId))
            .filter(Boolean);
          const buildingInPark = (building) => {
            // First check by cellId (fast)
            if (parkCells.some(c => c.id === building.cellId)) return true;
            // Then check spatially using footprint center
            if (!building.footprint || !building.footprint.length) return false;
            const cx = building.footprint.reduce((s, p) => s + p.x, 0) / building.footprint.length;
            const cy = building.footprint.reduce((s, p) => s + p.y, 0) / building.footprint.length;
            return parkCells.some(c => window.CityMapGeometryV3.pointInPolygon({ x: cx, y: cy }, c.polygon));
          };
          return (
            <g>
              {mainlandCoastRoad && (
                <g clipPath={`url(#${mainlandBuildableClipId})`}>
                  {data.buildingPlan.buildings
                    .filter((building) => building.landmassId === "mainland" && !buildingInPark(building))
                    .map(renderBuilding)}
                </g>
              )}
              {data.buildingPlan.buildings
                .filter((building) => {
                  if (mainlandCoastRoad && building.landmassId === "mainland") return false;
                  return !buildingInPark(building);
                })
                .map(renderBuilding)}
            </g>
          );
        })()}

        {/* Parks and open spaces - rendered independently of buildings toggle */}
        <g>
          {mainlandCoastRoad && (
            <g clipPath={`url(#${mainlandBuildableClipId})`}>
              {data.buildingPlan.openSpaces
                .filter((space) => {
                  if (space.kind !== "park" && space.kind !== "compound") return false;
                  const cell = data.cells.find(c => c.id === space.cellId);
                  return cell && cell.landmassId === "mainland";
                })
                .map(renderOpenSpace)}
            </g>
          )}
          {data.buildingPlan.openSpaces
            .filter((space) => {
              if (space.kind !== "park" && space.kind !== "compound") return false;
              const cell = data.cells.find(c => c.id === space.cellId);
              return !mainlandCoastRoad || !cell || cell.landmassId !== "mainland";
            })
            .map(renderOpenSpace)}
        </g>

        <g>
          {data.roadGraph.edges.map((edge) => (
                <g key={edge.id}>
                  {!edge.riverBank && (
                    <path
                      d={edge.path}
                      fill="none"
                      stroke={V4_PAL.roadUnderlay}
                      strokeWidth={roadUnderlayWidth(edge.kind)}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      opacity={edge.kind === "local" ? 0.76 : 0.72}
                      vectorEffect="non-scaling-stroke"
                    />
                  )}
                  <path
                    d={edge.path}
                    fill="none"
                    stroke={edge.riverBank ? V4_PAL.roadLocal : roadColor(edge.kind)}
                    strokeWidth={edge.riverBank ? 0.32 : roadWidth(edge.kind)}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={edge.riverBank ? 0.78 : edge.kind === "local" ? 0.88 : 0.95}
                    vectorEffect="non-scaling-stroke"
                  />
                </g>
              ))}
        </g>

        {data.terrain.waterBodies.map((body) => {
          if (body.kind === "ocean") return null;
          if (body.kind === "river") {
            return (
              <path
                key={body.id}
                d={body.path}
                fill="none"
                stroke={V4_PAL.water}
                strokeWidth={(body.outerWidth || 7) + 2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            );
          }

          return null;
        })}

        {/* DISTRICT HOVER FLOOD — after water so rivers/lakes tint with the owned district. */}
        {hoveredDistrictId && (
          <g>
            {data.districts.filter(district => district.id === hoveredDistrictId).map((district) => {
              const DEBUG_COLORS = ["#ffee00", "#ff2222", "#22ff88"];
              const idx = districtIndex(district);
              const floodColor = DEBUG_COLORS[idx % DEBUG_COLORS.length];
              return (
                <g key={`${district.id}-hover`}>
                  {districtHoverPolygons(district).map((polygon, index) => (
                    <path
                      key={`${district.id}-hover-cell-${index}`}
                      d={index === 0 && district.ownershipPath ? district.ownershipPath : polygonToPath(polygon)}
                      fill={floodColor}
                      stroke="none"
                      opacity={0.34}
                      style={{ mixBlendMode: "screen" }}
                      vectorEffect="non-scaling-stroke"
                    />
                  ))}
                </g>
              );
            })}
          </g>
        )}

        <g>
          {data.bridgePlan.bridges.map((bridge) => (
            <g key={bridge.id}>
              <path
                d={bridge.path}
                fill="none"
                stroke={V4_PAL.roadUnderlay}
                strokeWidth={bridge.deckWidth + 1.6}
                strokeLinecap="butt"
                opacity={0.78}
                vectorEffect="non-scaling-stroke"
              />
              <path
                d={bridge.path}
                fill="none"
                stroke={V4_PAL.highway}
                strokeWidth={bridge.deckWidth}
                strokeLinecap="butt"
                opacity={0.94}
                vectorEffect="non-scaling-stroke"
              />
            </g>
          ))}
        </g>

        <g opacity={0.72}>
          {data.districts.map((district) => {
            const path = majorDistrictBoundaryPath(district);
            if (!path) return null;
            return (
              <path
                key={district.id}
                d={path}
                fill="none"
                stroke={PAL.regionLine}
                strokeWidth={0.42}
                opacity={0.34}
                strokeLinecap="square"
                vectorEffect="non-scaling-stroke"
              />
            );
          })}
        </g>



        {showLabels && (
          <g>
            {data.districts.map((district) => {
              const text = visibleDistrictLabel(district);
              if (!text) return null;
              return (
                <text
                  key={`${district.id}-label`}
                  x={district.labelAnchor.x}
                  y={district.labelAnchor.y}
                  fill={PAL.label}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontFamily="'Roboto Mono', 'SFMono-Regular', monospace"
                  fontSize="10"
                  fontWeight="700"
                  letterSpacing="2"
                  opacity={0.88}
                  style={{ textShadow: `0 0 6px ${PAL.labelGlow}` }}
                >
                  {text}
                </text>
              );
            })}
          </g>
        )}
      </svg>
      </div>
    );
  }

  window.CityMapV4Preview = CityMapV4Preview;
})();
