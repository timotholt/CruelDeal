/* global React */
(function () {
  "use strict";

  const { useMemo } = React;
  const { VIEW_W, VIEW_H, PAL } = window.CityMapConfigV3;
  const { polygonToPath } = window.CityMapPathsV3;

  function kindColor(kind) {
    if (kind === "highway") return PAL.hwyInner;
    if (kind === "avenue") return PAL.avenue;
    if (kind === "local") return PAL.streetLocal;
    return PAL.streetMain;
  }

  function kindWidth(kind) {
    if (kind === "highway") return 1.5;
    if (kind === "avenue") return 0.9;
    if (kind === "local") return 0.28;
    return 0.42;
  }

  function buildingFill(building) {
    if (building.render.lodGroup === "tower") return PAL.bldgB;
    if (building.render.lodGroup === "midrise") return PAL.bldgA;
    return "hsla(215, 54%, 34%, 0.38)";
  }

  function districtLabel(district) {
    const text = district.name || district.id;
    const maxLen = district.bbox && district.bbox.w < 70 ? 4 : 9;
    return text.length > maxLen ? text.slice(0, maxLen) : text;
  }

  function CityMapV4Preview({
    seed,
    width,
    height,
    opacity = 1,
    showCells = false,
    showLabels = true,
    showBuildings = true
  }) {
    const data = useMemo(
      () => window.CityMapV4.buildCityV4(seed || 1),
      [seed]
    );
    const idBase = `cv4-${seed || 1}`;

    return (
      <svg
        className="city-map-v4-preview-svg"
        width={width || VIEW_W}
        height={height || VIEW_H}
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="none"
        style={{ opacity, display: "block", position: "absolute", left: 0, top: 0 }}
      >
        <defs>
          <clipPath id={`${idBase}-mainland`}>
            <path d={data.terrain.mainland.path} />
          </clipPath>
        </defs>

        <rect x={0} y={0} width={VIEW_W} height={VIEW_H} fill={PAL.water} />

        {data.terrain.landmasses.map((landmass) => (
          <g key={landmass.id}>
            <path d={landmass.path} fill={PAL.land} />
            <path
              d={landmass.path}
              fill="none"
              stroke={PAL.coastRoad}
              strokeWidth={0.75}
              opacity={0.68}
              vectorEffect="non-scaling-stroke"
            />
          </g>
        ))}

        {data.terrain.waterBodies.map((body) => {
          if (body.kind === "ocean") return null;
          if (body.kind === "river") {
            return (
              <path
                key={body.id}
                d={body.path}
                fill="none"
                stroke={PAL.water}
                strokeWidth={(body.outerWidth || 7) + 2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            );
          }
          if (body.polygon) {
            return <path key={body.id} d={body.path || polygonToPath(body.polygon)} fill={PAL.water} />;
          }
          return null;
        })}

        {showCells && (
          <g opacity={0.48}>
            {data.cells.map((cell) => (
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

        {showBuildings && (
          <g>
            {data.buildingPlan.buildings.map((building) => {
              const dx = Math.cos(data.buildingPlan.staticScene.shadowAzimuth) * building.shadow.length;
              const dy = Math.sin(data.buildingPlan.staticScene.shadowAzimuth) * building.shadow.length;
              return (
                <g key={building.id}>
                  <path
                    d={building.path}
                    fill="black"
                    opacity={building.shadow.opacity}
                    transform={`translate(${dx.toFixed(2)} ${dy.toFixed(2)})`}
                  />
                  <path d={building.path} fill={buildingFill(building)} />
                </g>
              );
            })}
            {data.buildingPlan.openSpaces.filter(s => s.kind === "park").map((space) => {
              const cell = data.cells.find(c => c.id === space.cellId);
              return cell ? <path key={space.id} d={cell.path} fill={PAL.park} opacity={0.5} /> : null;
            })}
          </g>
        )}

        <g>
          {data.roadGraph.edges.map((edge) => (
            <path
              key={edge.id}
              d={edge.path}
              fill="none"
              stroke={kindColor(edge.kind)}
              strokeWidth={kindWidth(edge.kind)}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={edge.kind === "local" ? 0.55 : 0.92}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </g>

        <g>
          {data.bridgePlan.bridges.map((bridge) => (
            <path
              key={bridge.id}
              d={bridge.path}
              fill="none"
              stroke={PAL.hwyInner}
              strokeWidth={bridge.deckWidth}
              strokeLinecap="butt"
              opacity={0.9}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </g>

        <g opacity={0.86}>
          {data.districts.map((district) => (
            <g key={district.id}>
              <path
                d={district.displayOutlinePath}
                fill="none"
                stroke={district.color}
                strokeWidth={0.55}
                opacity={0.58}
                vectorEffect="non-scaling-stroke"
              />
            </g>
          ))}
        </g>

        {showLabels && (
          <g>
            {data.districts.map((district) => (
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
                {districtLabel(district)}
              </text>
            ))}
          </g>
        )}
      </svg>
    );
  }

  window.CityMapV4Preview = CityMapV4Preview;
})();
