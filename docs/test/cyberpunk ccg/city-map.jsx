/* global React */
// CityMap — procedurally generated cyberpunk digital street map.
// Drawn into a single fixed-size SVG that fills the stage. The map uses a
// dim, cool palette (deep blue/teal, dimmed) so the gameplay rectangles
// (cyan + magenta) stay visually dominant.
//
// Hierarchy of road types, brightest → dimmest:
//   - HIGHWAY        : 4 great arterials slicing the grid (thickest, brightest)
//   - AVENUE         : major streets within districts (medium)
//   - STREET         : minor connector streets (thin)
//   - ALLEY          : back alleys / capillaries (dimmest, sparse)
// Plus: district polygons, water/park blocks, building footprints, POI markers,
// district labels, scanline overlay.

const { useMemo: useMemoMap } = React;

// Seeded RNG (mulberry32) — local so we don't depend on cards.jsx loading first
function mapRng(seed) {
  let t = seed >>> 0;
  return function () {
    t = (t + 0x6D2B79F5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

// Build a city. Returns geometry to draw.
function buildCity(seed, W, H) {
  const rng = mapRng(seed);

  // ---- Highways: 2 horizontal + 2 vertical, with slight angle ----
  const highways = [];
  // horizontal arterials
  for (let i = 0; i < 2; i++) {
    const y = H * (0.28 + i * 0.42) + (rng() - 0.5) * 30;
    const slope = (rng() - 0.5) * 0.12;
    highways.push({
      kind: "h",
      pts: [
        [0, y],
        [W * 0.5, y + slope * W * 0.5],
        [W, y + slope * W],
      ],
    });
  }
  // vertical arterials
  for (let i = 0; i < 2; i++) {
    const x = W * (0.27 + i * 0.44) + (rng() - 0.5) * 30;
    const slope = (rng() - 0.5) * 0.12;
    highways.push({
      kind: "v",
      pts: [
        [x, 0],
        [x + slope * H * 0.5, H * 0.5],
        [x + slope * H, H],
      ],
    });
  }

  // ---- Diagonal: a single bold diagonal "corridor" cuts the city ----
  const diagAngle = (rng() < 0.5 ? 1 : -1) * (0.18 + rng() * 0.1);
  const diagY0 = H * (0.15 + rng() * 0.1);
  const diagY1 = diagY0 + W * Math.tan(diagAngle);
  highways.push({
    kind: "d",
    pts: [[0, diagY0], [W, diagY1]],
  });

  // ---- Avenues: a denser orthogonal grid ----
  const avenues = [];
  // verticals
  const numVAve = 8;
  for (let i = 0; i <= numVAve; i++) {
    const x = (W / numVAve) * i + (rng() - 0.5) * 18;
    avenues.push({ kind: "v", x1: x + (rng() - 0.5) * 5, y1: 0, x2: x + (rng() - 0.5) * 5, y2: H });
  }
  // horizontals
  const numHAve = 5;
  for (let i = 0; i <= numHAve; i++) {
    const y = (H / numHAve) * i + (rng() - 0.5) * 14;
    avenues.push({ kind: "h", x1: 0, y1: y, x2: W, y2: y + (rng() - 0.5) * 6 });
  }

  // ---- Streets: many thin connectors filling each block ----
  const streets = [];
  // verticals — between every avenue, drop 2-3 streets
  for (let i = 0; i < numVAve; i++) {
    const x0 = (W / numVAve) * i;
    const x1 = (W / numVAve) * (i + 1);
    const cnt = 2 + Math.floor(rng() * 3);
    for (let k = 1; k <= cnt; k++) {
      const x = x0 + ((x1 - x0) * k) / (cnt + 1) + (rng() - 0.5) * 6;
      // chunked street (occasional gap to feel organic)
      const gapY = H * (0.2 + rng() * 0.6);
      const gapH = 30 + rng() * 60;
      streets.push({ x1: x, y1: 0, x2: x, y2: gapY });
      streets.push({ x1: x, y1: gapY + gapH, x2: x, y2: H });
    }
  }
  // horizontals
  for (let i = 0; i < numHAve; i++) {
    const y0 = (H / numHAve) * i;
    const y1 = (H / numHAve) * (i + 1);
    const cnt = 3 + Math.floor(rng() * 3);
    for (let k = 1; k <= cnt; k++) {
      const y = y0 + ((y1 - y0) * k) / (cnt + 1) + (rng() - 0.5) * 4;
      const gapX = W * (0.2 + rng() * 0.6);
      const gapW = 40 + rng() * 80;
      streets.push({ x1: 0, y1: y, x2: gapX, y2: y });
      streets.push({ x1: gapX + gapW, y1: y, x2: W, y2: y });
    }
  }

  // ---- Alleys: tiny segments scattered in each block ----
  const alleys = [];
  for (let i = 0; i < numVAve; i++) {
    for (let j = 0; j < numHAve; j++) {
      const x0 = (W / numVAve) * i;
      const x1 = (W / numVAve) * (i + 1);
      const y0 = (H / numHAve) * j;
      const y1 = (H / numHAve) * (j + 1);
      const count = 3 + Math.floor(rng() * 4);
      for (let k = 0; k < count; k++) {
        const horiz = rng() < 0.5;
        if (horiz) {
          const y = y0 + rng() * (y1 - y0);
          const sx = x0 + rng() * (x1 - x0) * 0.3;
          const ex = sx + (x1 - x0) * (0.15 + rng() * 0.35);
          alleys.push({ x1: sx, y1: y, x2: ex, y2: y });
        } else {
          const x = x0 + rng() * (x1 - x0);
          const sy = y0 + rng() * (y1 - y0) * 0.3;
          const ey = sy + (y1 - y0) * (0.15 + rng() * 0.35);
          alleys.push({ x1: x, y1: sy, x2: x, y2: ey });
        }
      }
    }
  }

  // ---- Buildings: tiny rectangle footprints scattered along streets ----
  const buildings = [];
  for (let i = 0; i < 220; i++) {
    const bx = rng() * W;
    const by = rng() * H;
    const bw = 4 + rng() * 14;
    const bh = 4 + rng() * 14;
    buildings.push({ x: bx, y: by, w: bw, h: bh, lit: rng() < 0.18 });
  }

  // ---- Water / park polygons ----
  const water = [];
  // a single river-ish polygon near the bottom-left
  if (rng() < 0.7) {
    const wx = rng() * W * 0.4;
    const wy = H * (0.55 + rng() * 0.35);
    const ww = 80 + rng() * 140;
    const wh = 40 + rng() * 80;
    water.push({ x: wx, y: wy, w: ww, h: wh, kind: "water" });
  }
  // a park
  const parks = [];
  parks.push({
    x: W * (0.55 + rng() * 0.2),
    y: H * (0.1 + rng() * 0.15),
    w: 70 + rng() * 60,
    h: 50 + rng() * 50,
    kind: "park",
  });

  // ---- POIs (point of interest pins) ----
  const pois = [];
  const poiNames = ["MRKT", "DTA-CTR", "HUB", "CHKPT", "DEPOT", "TRMNL", "BNK", "RLY", "GRID", "NODE"];
  for (let i = 0; i < 7; i++) {
    pois.push({
      x: 30 + rng() * (W - 60),
      y: 30 + rng() * (H - 60),
      label: poiNames[Math.floor(rng() * poiNames.length)] + "-" + (10 + Math.floor(rng() * 89)),
    });
  }

  // ---- District labels — placed in coarse grid cells, big serif-y mono ----
  const districtNames = [
    "AKIRA-7", "GINZA EAST", "SHIBUYA-LO", "NAKANO·UNDR",
    "MINATO-X", "ROPPONGI-N", "EBISU·BLK", "SUMIDA-13",
    "DAITO-NORD", "KANDA·OLD", "UENO-RIM",
  ];
  const labels = [];
  for (let i = 0; i < numVAve; i++) {
    for (let j = 0; j < numHAve; j++) {
      if (rng() < 0.55) continue;
      const cx = (W / numVAve) * (i + 0.5) + (rng() - 0.5) * 30;
      const cy = (H / numHAve) * (j + 0.5) + (rng() - 0.5) * 14;
      labels.push({
        x: cx, y: cy,
        text: districtNames[(i * 13 + j * 7) % districtNames.length],
        sub: "S-" + (10 + i) + "·" + (j + 1),
      });
    }
  }

  return { highways, avenues, streets, alleys, buildings, water, parks, pois, labels };
}

function CityMap({ seed = 1, width = 1200, height = 800, opacity = 1 }) {
  const city = useMemoMap(() => buildCity(seed, width, height), [seed, width, height]);

  // Map palette — DESATURATED, COOL, DIM. Foreground gameplay uses cyan+magenta,
  // so the map sits in deep blue / dim teal so it never competes.
  // Brightness ladder: highway > avenue > street > alley.
  // Map palette uses a deep blue / teal so the foreground rectangles
  // (cyan + magenta gameplay) read as the dominant figure.
  // Brightness ladder is what tells the eye "this is a road network":
  //   highway >> avenue > street > alley
  const C = {
    bg0: "#070d15",
    bg1: "#0c1622",
    block: "rgba(60, 100, 145, 0.18)",   // subtle district fill
    blockAlt: "rgba(75, 130, 170, 0.10)",
    water: "rgba(40, 75, 120, 0.55)",
    waterEdge: "rgba(90, 160, 210, 0.7)",
    park: "rgba(55, 110, 80, 0.40)",
    parkEdge: "rgba(95, 170, 120, 0.65)",
    highway: "rgba(150, 200, 240, 1.0)",     // brightest road
    avenue:  "rgba(105, 155, 200, 0.85)",
    street:  "rgba(75, 120, 165, 0.65)",
    alley:   "rgba(60, 100, 140, 0.40)",     // dimmest
    building: "rgba(85, 130, 170, 0.30)",
    buildingLit: "rgba(170, 220, 245, 0.75)",
    poi: "rgba(180, 225, 250, 0.95)",
    label: "rgba(140, 185, 225, 0.75)",
    sublabel: "rgba(105, 150, 190, 0.55)",
  };

  return (
    <svg
      className="city-map-svg"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ opacity }}
      preserveAspectRatio="none"
    >
      <defs>
        <pattern id="cityHatch" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke="rgba(80,130,170,0.06)" strokeWidth="1" />
        </pattern>
        <radialGradient id="cityVignette" cx="50%" cy="50%" r="80%">
          <stop offset="0%" stopColor="rgba(0,0,0,0)" />
          <stop offset="80%" stopColor="rgba(0,0,0,0)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.45)" />
        </radialGradient>
        <filter id="cityGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Background base */}
      <rect x="0" y="0" width={width} height={height} fill={C.bg0} />
      <rect x="0" y="0" width={width} height={height} fill="url(#cityHatch)" />

      {/* Subtle district blocks — alternating tone, derived from avenue grid */}
      <g opacity="0.9">
        {(() => {
          const cells = [];
          const nv = 8, nh = 5;
          for (let i = 0; i < nv; i++) {
            for (let j = 0; j < nh; j++) {
              const fill = ((i + j) % 2 === 0) ? C.block : C.blockAlt;
              cells.push(
                <rect
                  key={`blk-${i}-${j}`}
                  x={(width / nv) * i}
                  y={(height / nh) * j}
                  width={width / nv}
                  height={height / nh}
                  fill={fill}
                />
              );
            }
          }
          return cells;
        })()}
      </g>

      {/* Water */}
      {city.water.map((w, i) => (
        <g key={`wt-${i}`}>
          <rect x={w.x} y={w.y} width={w.w} height={w.h} fill={C.water} />
          <rect x={w.x} y={w.y} width={w.w} height={w.h} fill="none" stroke={C.waterEdge} strokeWidth="0.7" strokeDasharray="2 3" />
          {/* a few wavy lines */}
          {Array.from({ length: 4 }).map((_, k) => (
            <path
              key={k}
              d={`M ${w.x + 6} ${w.y + 8 + k * (w.h / 5)} q ${w.w * 0.25} -3 ${w.w * 0.5} 0 t ${w.w * 0.5} 0`}
              fill="none"
              stroke="rgba(110,170,210,0.25)"
              strokeWidth="0.5"
            />
          ))}
        </g>
      ))}

      {/* Parks */}
      {city.parks.map((p, i) => (
        <g key={`pk-${i}`}>
          <rect x={p.x} y={p.y} width={p.w} height={p.h} fill={C.park} />
          <rect x={p.x} y={p.y} width={p.w} height={p.h} fill="none" stroke={C.parkEdge} strokeWidth="0.6" strokeDasharray="1 2" />
        </g>
      ))}

      {/* Buildings (tiny block footprints) */}
      <g>
        {city.buildings.map((b, i) => (
          <rect
            key={`bd-${i}`}
            x={b.x} y={b.y} width={b.w} height={b.h}
            fill={b.lit ? C.buildingLit : C.building}
            opacity={b.lit ? 0.85 : 0.5}
          />
        ))}
      </g>

      {/* Alleys — dimmest */}
      <g stroke={C.alley} strokeWidth="0.5" strokeLinecap="butt">
        {city.alleys.map((a, i) => (
          <line key={`al-${i}`} x1={a.x1} y1={a.y1} x2={a.x2} y2={a.y2} />
        ))}
      </g>

      {/* Streets — minor */}
      <g stroke={C.street} strokeWidth="1" strokeLinecap="round">
        {city.streets.map((s, i) => (
          <line key={`st-${i}`} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} />
        ))}
      </g>

      {/* Avenues — major */}
      <g stroke={C.avenue} strokeWidth="2" strokeLinecap="round">
        {city.avenues.map((a, i) => (
          <line key={`av-${i}`} x1={a.x1} y1={a.y1} x2={a.x2} y2={a.y2} />
        ))}
      </g>

      {/* Highways — brightest, with glow */}
      <g stroke={C.highway} strokeWidth="3.5" strokeLinecap="round" fill="none" filter="url(#cityGlow)">
        {city.highways.map((hw, i) => (
          <polyline
            key={`hw-${i}`}
            points={hw.pts.map((p) => p.join(",")).join(" ")}
          />
        ))}
      </g>
      {/* Highway centerline dashes */}
      <g stroke="rgba(180, 220, 255, 0.4)" strokeWidth="0.6" strokeDasharray="6 8" fill="none">
        {city.highways.map((hw, i) => (
          <polyline
            key={`hwc-${i}`}
            points={hw.pts.map((p) => p.join(",")).join(" ")}
          />
        ))}
      </g>

      {/* District labels */}
      <g fontFamily="JetBrains Mono, monospace" textAnchor="middle">
        {city.labels.map((l, i) => (
          <g key={`lb-${i}`}>
            <text x={l.x} y={l.y} fill={C.label} fontSize="9" fontWeight="600" letterSpacing="0.18em">
              {l.text}
            </text>
            <text x={l.x} y={l.y + 9} fill={C.sublabel} fontSize="6" letterSpacing="0.22em">
              {l.sub}
            </text>
          </g>
        ))}
      </g>

      {/* POI markers */}
      <g fontFamily="JetBrains Mono, monospace">
        {city.pois.map((p, i) => (
          <g key={`po-${i}`} opacity="0.85">
            <circle cx={p.x} cy={p.y} r="2.5" fill="none" stroke={C.poi} strokeWidth="0.8" />
            <circle cx={p.x} cy={p.y} r="0.8" fill={C.poi} />
            <line x1={p.x} y1={p.y - 4} x2={p.x} y2={p.y - 8} stroke={C.poi} strokeWidth="0.5" />
            <text x={p.x + 5} y={p.y - 5} fill={C.poi} fontSize="6" letterSpacing="0.14em">
              {p.label}
            </text>
          </g>
        ))}
      </g>

      {/* Coordinate axes / scale ticks at edges */}
      <g fontFamily="JetBrains Mono, monospace" fill="rgba(110, 155, 195, 0.45)" fontSize="6" letterSpacing="0.14em">
        {Array.from({ length: 12 }).map((_, i) => (
          <text key={`tx-${i}`} x={(width / 12) * i + 4} y={10}>
            {String((i * 37) % 100).padStart(2, "0")}·{String((i * 13) % 100).padStart(2, "0")}
          </text>
        ))}
        {Array.from({ length: 8 }).map((_, i) => (
          <text key={`ty-${i}`} x={4} y={(height / 8) * i + 18}>
            {String((i * 41) % 100).padStart(2, "0")}·N
          </text>
        ))}
      </g>

      {/* Compass */}
      <g transform={`translate(${width - 36}, 28)`} fontFamily="JetBrains Mono, monospace" fill="rgba(140, 185, 220, 0.6)">
        <circle cx="0" cy="0" r="14" fill="none" stroke="rgba(90, 135, 175, 0.45)" strokeWidth="0.6" />
        <circle cx="0" cy="0" r="9" fill="none" stroke="rgba(90, 135, 175, 0.3)" strokeWidth="0.4" />
        <line x1="0" y1="-14" x2="0" y2="14" stroke="rgba(90, 135, 175, 0.3)" strokeWidth="0.4" />
        <line x1="-14" y1="0" x2="14" y2="0" stroke="rgba(90, 135, 175, 0.3)" strokeWidth="0.4" />
        <polygon points="0,-10 -2.5,3 0,1 2.5,3" fill="rgba(150, 200, 230, 0.85)" />
        <text x="0" y="-16" fontSize="6" textAnchor="middle" letterSpacing="0.2em">N</text>
      </g>

      {/* Vignette so edges don't draw the eye */}
      <rect x="0" y="0" width={width} height={height} fill="url(#cityVignette)" />

      {/* Scanline overlay */}
      <g opacity="0.35">
        {Array.from({ length: Math.floor(height / 3) }).map((_, i) => (
          <line key={`sc-${i}`} x1="0" y1={i * 3} x2={width} y2={i * 3} stroke="rgba(0,20,40,0.5)" strokeWidth="0.5" />
        ))}
      </g>
    </svg>
  );
}

window.CityMap = CityMap;
