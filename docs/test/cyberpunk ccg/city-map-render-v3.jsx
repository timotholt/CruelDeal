(function () {
  "use strict";

  const { PAL } = window.CityMapConfigV3;
  const {
    pointToSegmentDist: _pointToSegmentDist,
    polygonBBox: _polygonBBox
  } = window.CityMapGeometryV3;
  const {
    cutPath: _cutPath,
    cutPoints: _cutPoints,
    straightPolylinePath: _straightPolylinePath,
    offsetPolyline: _offsetPolyline
  } = window.CityMapPathsV3;

  function districtAlertStyle(alert) {
    if (!alert) return null;
    const raw = typeof alert === "string" ? { level: alert } : alert;
    const level = raw.level || raw.type || raw.color || "yellow";
    const strength = raw.strength != null ? raw.strength : 1;
    const alpha = Math.max(0, Math.min(0.65, (raw.opacity != null ? raw.opacity : 0.28) * strength));
    if (level === "red" || level === "danger" || level === "losing") {
      return { fill: "#ff3868", opacity: alpha, blend: "screen" };
    }
    if (level === "green" || level === "success" || level === "winning") {
      return { fill: "#47ff8a", opacity: alpha, blend: "screen" };
    }
    return { fill: "#ffd84d", opacity: alpha, blend: "screen" };
  }

  function streetStyle(depth) {
    if (depth === 0) return { width: 1.7, stroke: PAL.hwyInner };
    if (depth === 1) return { width: 1.05, stroke: PAL.avenue };
    if (depth === 2) return { width: 0.48, stroke: PAL.streetMain };
    if (depth === 3) return { width: 0.38, stroke: PAL.streetMain };
    return { width: 0.32, stroke: PAL.streetLocal };
  }

  function renderLandmark(key, l, opacity) {
    const t = l.type;
    const bbox = _polygonBBox(l.polygon);
    const detailLines = (clipId, stroke = PAL.mallAccent, lineOpacity = 0.45) => {
      const lines = [];
      const span = Math.max(bbox.w, bbox.h);
      if (span < 14) return null;
      const step = span > 42 ? 9 : 7;
      for (let x = bbox.minX + step; x < bbox.maxX - 1; x += step) {
        lines.push(
          <line
            key={`vx-${x.toFixed(1)}`}
            x1={x} y1={bbox.minY} x2={x} y2={bbox.maxY}
            stroke={stroke} strokeWidth={0.22} opacity={lineOpacity}
          />
        );
      }
      for (let y = bbox.minY + step; y < bbox.maxY - 1; y += step) {
        lines.push(
          <line
            key={`hy-${y.toFixed(1)}`}
            x1={bbox.minX} y1={y} x2={bbox.maxX} y2={y}
            stroke={stroke} strokeWidth={0.22} opacity={lineOpacity * 0.85}
          />
        );
      }
      return <g clipPath={`url(#${clipId})`}>{lines}</g>;
    };
    if (t === "stadium_soccer" || t === "stadium_football" || t === "stadium_baseball") {
      let cx = 0, cy = 0;
      const n = l.polygon.length || 1;
      for (const p of l.polygon) { cx += p.x; cy += p.y; }
      cx /= n; cy /= n;
      let minR = Infinity;
      for (let i = 0; i < l.polygon.length; i++) {
        const a = l.polygon[i];
        const b = l.polygon[(i + 1) % l.polygon.length];
        const d = _pointToSegmentDist(cx, cy, a, b);
        if (d < minR) minR = d;
      }
      let fwM, fhM;
      if (t === "stadium_soccer")        { fwM = 105; fhM = 68; }
      else if (t === "stadium_football") { fwM = 109; fhM = 49; }
      else                                { fwM = 120; fhM = 120; }
      const maxSizePx = minR * 1.6;
      const scale = Math.min(maxSizePx / fwM, (minR * 1.4) / fhM);
      const fw = fwM * scale;
      const fh = fhM * scale;
      const rotDeg = (l.polygon[0].x + l.polygon[0].y) % 90 - 45;
      const fillBlock = <path d={l.path} fill={PAL.stadium} />;
      if (fw < 6 || fh < 4) return <g key={key} opacity={opacity}>{fillBlock}</g>;
      if (t === "stadium_baseball") {
        const half = fw / 2;
        const diamondSize = fh * 0.42;
        return (
          <g key={key} opacity={opacity} transform={`rotate(${rotDeg} ${cx} ${cy})`}>
            {fillBlock}
            <path
              d={`M ${cx - half} ${cy + half * 0.3}
                  A ${fw} ${fw} 0 0 1 ${cx + half} ${cy + half * 0.3}
                  L ${cx} ${cy + half * 0.3} Z`}
              fill={PAL.stadiumField}
            />
            <path
              d={`M ${cx} ${cy + half * 0.3}
                  L ${cx + diamondSize} ${cy + half * 0.3 - diamondSize}
                  L ${cx} ${cy + half * 0.3 - 2 * diamondSize}
                  L ${cx - diamondSize} ${cy + half * 0.3 - diamondSize} Z`}
              fill={PAL.diamond}
              stroke={PAL.fieldLine}
              strokeWidth={0.4}
            />
          </g>
        );
      }
      if (t === "stadium_football") {
        const x0 = cx - fw / 2, y0 = cy - fh / 2;
        const ezW = fw * 0.10;
        return (
          <g key={key} opacity={opacity} transform={`rotate(${rotDeg} ${cx} ${cy})`}>
            {fillBlock}
            <rect x={x0} y={y0} width={fw} height={fh} fill={PAL.stadiumField} />
            <rect x={x0} y={y0} width={ezW} height={fh} fill={PAL.stadium} opacity={0.55} />
            <rect x={x0 + fw - ezW} y={y0} width={ezW} height={fh} fill={PAL.stadium} opacity={0.55} />
            {[0.25, 0.5, 0.75].map((t, i) => (
              <line key={i}
                x1={x0 + ezW + (fw - 2 * ezW) * t} y1={y0 + 0.5}
                x2={x0 + ezW + (fw - 2 * ezW) * t} y2={y0 + fh - 0.5}
                stroke={PAL.fieldLine} strokeWidth={0.35}
              />
            ))}
          </g>
        );
      }
      const x0 = cx - fw / 2, y0 = cy - fh / 2;
      const pbW = fw * 0.12, pbH = fh * 0.55;
      const ccR = Math.min(fw, fh) * 0.13;
      return (
        <g key={key} opacity={opacity} transform={`rotate(${rotDeg} ${cx} ${cy})`}>
          {fillBlock}
          <rect x={x0} y={y0} width={fw} height={fh} fill={PAL.stadiumField} />
          <line x1={cx} y1={y0 + 0.5} x2={cx} y2={y0 + fh - 0.5} stroke={PAL.fieldLine} strokeWidth={0.4} />
          <circle cx={cx} cy={cy} r={ccR} fill="none" stroke={PAL.fieldLine} strokeWidth={0.4} />
          <rect x={x0} y={cy - pbH / 2} width={pbW} height={pbH} fill="none" stroke={PAL.fieldLine} strokeWidth={0.4} />
          <rect x={x0 + fw - pbW} y={cy - pbH / 2} width={pbW} height={pbH} fill="none" stroke={PAL.fieldLine} strokeWidth={0.4} />
        </g>
      );
    }
    if (t === "mall") {
      const clipId = `clip-${key}`;
      return (
        <g key={key} opacity={opacity}>
          <defs>
            <clipPath id={clipId}>
              <path d={l.path} />
            </clipPath>
          </defs>
          <path d={l.path} fill={PAL.mall} />
          {detailLines(clipId, PAL.mallAccent, 0.36)}
          <path d={l.path} fill="none" stroke={PAL.mallAccent} strokeWidth={0.38} opacity={0.75} />
        </g>
      );
    }
    if (t === "plaza") {
      const clipId = `clip-${key}`;
      return (
        <g key={key} opacity={opacity}>
          <defs>
            <clipPath id={clipId}>
              <path d={l.path} />
            </clipPath>
          </defs>
          <path d={l.path} fill={PAL.plaza} />
          {detailLines(clipId, PAL.fieldLine, 0.28)}
        </g>
      );
    }
    return <path key={key} d={l.path} fill={PAL.park} opacity={opacity} />;
  }

  function renderStreetsLayer({ showStreets, sortedCuts }) {
    if (!showStreets) return null;
    return (
      <g>
        {sortedCuts.map((cut, i) => {
          const style = streetStyle(cut.depth);
          if (cut.polyline) {
            return (
              <path
                key={`s-${i}`}
                d={_cutPath(cut)}
                fill="none"
                stroke={style.stroke}
                strokeWidth={style.width}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            );
          }
          return (
            <line
              key={`s-${i}`}
              x1={cut.p1.x} y1={cut.p1.y} x2={cut.p2.x} y2={cut.p2.y}
              stroke={style.stroke}
              strokeWidth={style.width}
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
      </g>
    );
  }

  function renderDocksLayer({ docks }) {
    return docks.map((dock, i) => (
      <path key={`dock-${i}`} d={dock.path} fill={PAL.bldgA} />
    ));
  }

  function renderIslandsLayer({ islands, showStreets, baseMapDimOpacity }) {
    if (!islands) return null;
    return islands.map((isl, i) => (
      <g key={`isl-${i}`}>
        {isl.paths.map((p, k) => <path key={`isl-land-${k}`} d={p} fill={PAL.land} />)}
        {isl.paths.map((p, k) => <path key={`isl-dim-${k}`} d={p} fill="black" opacity={baseMapDimOpacity} style={{ pointerEvents: "none" }} />)}
        {isl.buildings.map((b, j) => (
          b.round
            ? <path key={`ib-${j}`} d={b.path} fill={PAL.roundBldg} />
            : <path key={`ib-${j}`} d={b.path} fill={b.shade > 0.5 ? PAL.bldgA : PAL.bldgB} />
        ))}
        {isl.islandRoadPath && showStreets && (
          <path
            d={isl.islandRoadPath}
            fill="none"
            stroke={PAL.streetMain}
            strokeWidth={0.55}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        )}
        {isl.paths.map((p, k) => (
          <path key={`isl-outline-${k}`} d={p} fill="none" stroke={PAL.coastRoad}
            strokeWidth={0.9} strokeLinejoin="round" opacity={0.80}
            vectorEffect="non-scaling-stroke" />
        ))}
      </g>
    ));
  }

  function renderDistrictAlertsLayer({ districts, alertForDistrict }) {
    return districts.map(d => {
      const alert = districtAlertStyle(alertForDistrict(d));
      if (!alert) return null;
      return (
        <path
          key={`alert-${d.idx}`}
          d={d.polygonPath}
          fill={alert.fill}
          opacity={alert.opacity}
          style={{ mixBlendMode: alert.blend, pointerEvents: "none" }}
        />
      );
    });
  }

  function renderBuildingsLayer({ buildings }) {
    return (
      <g>
        {buildings.map((b, i) => {
          if (b.round) {
            return (
              <g key={`b-${i}`}>
                <path d={b.path} fill={PAL.roundBldg} />
                <path d={b.path} fill="none" stroke={PAL.streetMain} strokeWidth={0.5} opacity={0.48} />
              </g>
            );
          }
          const fill = b.shade < 0.5 ? PAL.bldgA : PAL.bldgB;
          return <path key={`b-${i}`} d={b.path} fill={fill} />;
        })}
      </g>
    );
  }

  function renderLandmarksLayer({ data, idBase }) {
    return (
      <>
        <g clipPath={`url(#${idBase}-land)`}>
          {data.ambientLandmarks.map((l, i) => renderLandmark(`amb-${i}`, l, 0.7))}
        </g>
        <g>
          {data.districts.flatMap((d, di) =>
            d.landmarks.map((l, li) => renderLandmark(`lm-${di}-${li}`, l, 0.9))
          )}
        </g>
      </>
    );
  }

  function renderDistrictOutlinesLayer({ districts, hoveredDistrict }) {
    return (
      <g>
        {districts.map(d => {
          const isHovered = hoveredDistrict === d.idx;
          return (
            <path
              key={`outline-${d.idx}`}
              d={d.outlinePath}
              fill="none"
              stroke={PAL.regionLine}
              strokeWidth={isHovered ? 1.45 : 0.75}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={isHovered ? 0.95 : 0.52}
              vectorEffect="non-scaling-stroke"
              style={{
                filter: isHovered
                  ? `drop-shadow(0 0 2px ${PAL.regionGlow}) drop-shadow(0 0 5px ${PAL.regionGlow}) drop-shadow(0 0 10px ${PAL.regionGlow})`
                  : "none",
                transition: "stroke-width 0.15s ease, opacity 0.15s ease, filter 0.15s ease",
                pointerEvents: "none"
              }}
            />
          );
        })}
      </g>
    );
  }

  function renderHighwaysLayer({ showStreets, hwyCuts }) {
    if (!showStreets) return null;
    return (
      <g>
        {hwyCuts.map((cut, i) => {
          const pts = _cutPoints(cut);
          const basePath = _straightPolylinePath(pts);
          if (!cut.dividedHighway) {
            return (
              <g key={`hwy-${i}`}>
                <path
                  d={basePath}
                  fill="none"
                  stroke={PAL.hwyOuter}
                  strokeWidth={3.3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={0.30}
                  vectorEffect="non-scaling-stroke"
                />
                <path
                  d={basePath}
                  fill="none"
                  stroke={PAL.hwyInner}
                  strokeWidth={1.15}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={0.92}
                  vectorEffect="non-scaling-stroke"
                />
              </g>
            );
          }
          const left = _straightPolylinePath(_offsetPolyline(pts, -0.72));
          const right = _straightPolylinePath(_offsetPolyline(pts, 0.72));
          return (
            <g key={`hwy-${i}`}>
              <path
                d={basePath}
                fill="none"
                stroke={PAL.hwyOuter}
                strokeWidth={4.2}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.34}
                vectorEffect="non-scaling-stroke"
              />
              <path
                d={basePath}
                fill="none"
                stroke={PAL.hwyOuter}
                strokeWidth={2.7}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.20}
                vectorEffect="non-scaling-stroke"
              />
              <path
                d={basePath}
                fill="none"
                stroke={PAL.land}
                strokeWidth={0.82}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.95}
                vectorEffect="non-scaling-stroke"
              />
              <path
                d={left}
                fill="none"
                stroke={PAL.hwyInner}
                strokeWidth={0.78}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d={right}
                fill="none"
                stroke={PAL.hwyInner}
                strokeWidth={0.78}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            </g>
          );
        })}
      </g>
    );
  }

  function renderRoundaboutsLayer({ showStreets, buildings }) {
    if (!showStreets) return null;
    return (
      <g>
        {buildings.filter(b => b.round).flatMap((b, i) => {
          const ring = b.ringRadius != null ? b.ringRadius : b.radius * 1.20;
          const mids = b.edgeMidpoints || [];
          const spurs = mids.map((m, j) => {
            const dx = m.x - b.cx;
            const dy = m.y - b.cy;
            const dist = Math.hypot(dx, dy);
            if (dist < ring + 0.5) return null;
            const ux = dx / dist, uy = dy / dist;
            const x1 = b.cx + ux * ring;
            const y1 = b.cy + uy * ring;
            return (
              <line
                key={`spur-${i}-${j}`}
                x1={x1} y1={y1} x2={m.x} y2={m.y}
                stroke={PAL.streetLocal}
                strokeWidth={0.32}
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            );
          });
          return [
            <g key={`spurs-${i}`}>{spurs}</g>,
            <g key={`rb-${i}`}>
              <circle
                cx={b.cx} cy={b.cy} r={ring}
                fill="none" stroke={PAL.streetLocal} strokeWidth={0.68}
                opacity={0.32}
                vectorEffect="non-scaling-stroke"
              />
              <circle
                cx={b.cx} cy={b.cy} r={ring}
                fill="none" stroke={PAL.streetLocal} strokeWidth={0.32}
                opacity={0.82}
                vectorEffect="non-scaling-stroke"
              />
            </g>
          ];
        })}
      </g>
    );
  }

  function renderBridgeLayer({ showStreets, data }) {
    if (!showStreets || !data.bridges) return null;
    return data.bridges.map((b, i) => {
      const baseW = b.offshore ? 320 : (b.depth === 0 ? 11 : (b.depth === 1 ? 9 : (b.depth === 2 ? 7 : 5.5)));
      const riverW = data.river ? data.river.outerWidth : 0;
      const w = b.offshore ? baseW : Math.max(baseW, riverW + 3);
      const h = b.depth === 0 ? 4.5 : (b.depth === 1 ? 3.6 : 3);
      return (
        <g key={`br-${i}`} transform={`translate(${b.x},${b.y}) rotate(${(b.angle || 0) * 180 / Math.PI})`}>
          <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={1} fill="rgba(20,40,65,0.92)" />
          <rect x={-w / 2 + 0.6} y={-h / 2 + 0.6} width={w - 1.2} height={h - 1.2} rx={0.6}
                fill={PAL.avenue} />
          <rect x={-w / 2} y={-h / 2 - 0.5} width={1.5} height={h + 1} fill="rgba(20,40,65,0.92)" />
          <rect x={ w / 2 - 1.5} y={-h / 2 - 0.5} width={1.5} height={h + 1} fill="rgba(20,40,65,0.92)" />
        </g>
      );
    });
  }

  function renderIslandBridgeLayer({ showStreets, islands }) {
    if (!showStreets || !islands) return null;
    return islands.map((isl, i) => {
      if (!isl.bridge) return null;
      const { bridge } = isl;
      const w = bridge.len;
      const h = 3.0;
      return (
        <g key={`isl-br-${i}`} transform={`translate(${bridge.x},${bridge.y}) rotate(${bridge.angle * 180 / Math.PI})`}>
          <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={0.8} fill="rgba(20,40,65,0.92)" />
          <rect x={-w / 2 + 0.5} y={-h / 2 + 0.5} width={w - 1} height={h - 1} rx={0.4}
                fill={PAL.avenue} opacity={0.85} />
          <rect x={-w / 2} y={-h / 2 - 0.4} width={1.2} height={h + 0.8} fill="rgba(20,40,65,0.90)" />
          <rect x={ w / 2 - 1.2} y={-h / 2 - 0.4} width={1.2} height={h + 0.8} fill="rgba(20,40,65,0.90)" />
        </g>
      );
    });
  }

  function renderCoastRoadLayer({ showStreets, coastRoadPath }) {
    if (!showStreets) return null;
    return (
      <path
        d={coastRoadPath}
        fill="none"
        stroke={PAL.coastRoad}
        strokeWidth={1.3}
        strokeLinejoin="round"
        opacity={0.94}
        vectorEffect="non-scaling-stroke"
      />
    );
  }

  function renderDimmerLayer({ landPath, baseMapDimOpacity, hoveredDistrict, idBase }) {
    return (
      <path
        d={landPath}
        fill="black"
        opacity={baseMapDimOpacity}
        mask={hoveredDistrict != null ? `url(#${idBase}-map-dim-mask)` : undefined}
        style={{ pointerEvents: "none" }}
      />
    );
  }

  function renderDebugDotsLayer({ showDots, districts }) {
    if (!showDots) return null;
    return (
      <g>
        {districts.flatMap(d => d.dots.map(p => (
          <circle key={p.id} cx={p.x} cy={p.y} r={1.6} fill={d.color} />
        )))}
      </g>
    );
  }

  function renderLabelsLayer({ showLabels, districts }) {
    if (!showLabels) return null;
    return (
      <g>
        {districts.map(d => (
          <text
            key={`lab-${d.idx}`}
            x={d.labelPos.x} y={d.labelPos.y}
            textAnchor="middle"
            dominantBaseline="middle"
            fontFamily="'Roboto Mono', 'Azeret Mono', 'JetBrains Mono', monospace"
            fontSize={9.4}
            fontWeight={500}
            letterSpacing={2.0}
            fill={PAL.label}
            stroke={PAL.labelStroke}
            strokeWidth={0.28}
            paintOrder="stroke"
            style={{
              pointerEvents: "none",
              fontStretch: "condensed",
              filter: `drop-shadow(0 0 2px ${PAL.labelGlow}) drop-shadow(0 0 5px ${PAL.labelGlow})`
            }}
          >
            {d.labelText || d.name}
          </text>
        ))}
      </g>
    );
  }

  function renderHoverCaptureLayer({ districts, setHoveredDistrict }) {
    return (
      <g>
        {districts.map(d => (
          <path
            key={`hover-${d.idx}`}
            d={d.polygonPath}
            fill="transparent"
            stroke="none"
            style={{ cursor: "pointer" }}
            onMouseEnter={() => setHoveredDistrict(d.idx)}
            onMouseLeave={() => setHoveredDistrict(prev => prev === d.idx ? null : prev)}
          />
        ))}
      </g>
    );
  }

  window.CityMapRenderV3 = {
    districtAlertStyle,
    streetStyle,
    renderLandmark,
    renderDocksLayer,
    renderIslandsLayer,
    renderDistrictAlertsLayer,
    renderBuildingsLayer,
    renderLandmarksLayer,
    renderDistrictOutlinesLayer,
    renderStreetsLayer,
    renderHighwaysLayer,
    renderRoundaboutsLayer,
    renderBridgeLayer,
    renderIslandBridgeLayer,
    renderCoastRoadLayer,
    renderDimmerLayer,
    renderDebugDotsLayer,
    renderLabelsLayer,
    renderHoverCaptureLayer
  };
})();
