/* global React */
const { useState, useEffect, useRef, useMemo } = React;

// ----------------------------- DATA -----------------------------

const LANE_POOL = [
  { id: "streets",   name: "STREETS",     sub: "Neo-Kyoto · 2087" },
  { id: "rooftops",  name: "ROOFTOPS",    sub: "Lvl 47 · Skydeck" },
  { id: "sewers",    name: "SEWERS",      sub: "Sub-grid · D-9" },
  { id: "net",       name: "THE NET",     sub: "Stack 0xA1" },
  { id: "slums",     name: "SLUMS",       sub: "Free Sector" },
  { id: "tower",     name: "CORP TOWER",  sub: "Arasawa Plz" },
  { id: "grid",      name: "THE GRID",    sub: "Mainframe" },
  { id: "under",     name: "UNDERGROUND", sub: "Maglev D-2" },
];

const CARD_POOL = [
  { name: "NETRUNNER",    role: "INTRUDER", stealth: 5, power: 2, vis: 2, text: "On reveal: jack into nearest enemy." },
  { name: "GHOST",        role: "AGENT",    stealth: 6, power: 1, vis: 1, text: "Cannot be detected by Eye ≤ 3." },
  { name: "ENFORCER",     role: "BRUTE",    stealth: 1, power: 6, vis: 3, text: "On reveal: stun adjacent." },
  { name: "DRONE-SWARM",  role: "RECON",    stealth: 2, power: 1, vis: 5, text: "Sweeps the lane on entry." },
  { name: "CHROME-DOG",   role: "HUNTER",   stealth: 2, power: 4, vis: 4, text: "Detection ignores 1 stealth." },
  { name: "WIREHEAD",     role: "DECKER",   stealth: 3, power: 2, vis: 4, text: "Sees through one wall." },
  { name: "CIPHER",       role: "FIXER",    stealth: 4, power: 3, vis: 3, text: "Reveal: tag a target." },
  { name: "MIRRORSHADE",  role: "SCOUT",    stealth: 4, power: 2, vis: 5, text: "First to reveal each turn." },
  { name: "JUNKER",       role: "GRUNT",    stealth: 1, power: 3, vis: 2, text: "Cheap. Loud. Hits hard." },
  { name: "SIRENA",       role: "BARD",     stealth: 3, power: 2, vis: 3, text: "Reveal: lower stealth of foes by 1." },
  { name: "VOIDWALKER",   role: "PHASE",    stealth: 5, power: 4, vis: 2, text: "Phases past 1 obstacle." },
  { name: "BLACKICE",     role: "DAEMON",   stealth: 4, power: 5, vis: 3, text: "Reveal: brick the visible enemy." },
  { name: "HALCYON",      role: "MEDIC",    stealth: 3, power: 1, vis: 2, text: "Restores ally on reveal." },
  { name: "TANKER",       role: "MECH",     stealth: 0, power: 6, vis: 4, text: "Always visible. Always present." },
  { name: "WHISPER",      role: "INFIL",    stealth: 6, power: 0, vis: 6, text: "Marks but never strikes." },
  { name: "RIPPER",       role: "BLADE",    stealth: 3, power: 5, vis: 2, text: "Adjacent reveal triggers strike." },
  { name: "PROXY",        role: "DECOY",    stealth: 4, power: 1, vis: 1, text: "Reveal: spawn a phantom." },
  { name: "SOLITAIRE",    role: "GHOST",    stealth: 5, power: 3, vis: 4, text: "Quiet. Patient. Lethal." },
  { name: "ARCHIVIST",    role: "DATA",     stealth: 2, power: 2, vis: 6, text: "Sees the whole lane on reveal." },
  { name: "RAVEN-7",      role: "BIRD",     stealth: 4, power: 3, vis: 5, text: "Lifts a tag from any card." },
];

// 16 cards in deck
function buildDeck(rng) {
  const out = [];
  const pool = [...CARD_POOL];
  for (let i = 0; i < 16; i++) {
    const idx = Math.floor(rng() * pool.length);
    const proto = pool[idx];
    out.push({ ...proto, uid: `c${i}-${Math.floor(rng()*1e6)}` });
  }
  return out;
}

// Mulberry32 seeded PRNG so layouts are deterministic per session
function makeRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ----------------------------- LAYOUT -----------------------------

// Logical stage 360x640 (9:16). Multiples of 8.
// header 64 + board 384 + footer 192 = 640. 
const STAGE_W = 360;
const STAGE_H = 640;
const HEADER_H = 64;
const FOOTER_H = 192;
const BOARD_H = STAGE_H - HEADER_H - FOOTER_H; // 384
const SIDE_PAD = 16;
const LANE_GAP = 8;
const LANE_W = (STAGE_W - SIDE_PAD * 2 - LANE_GAP * 2) / 3; // (360-32-16)/3 = 104
const LANE_H = BOARD_H - 16; // 368, leave 8px top/bottom; close to 2.9:16 ratio
// 104:368 ~= 2.83:10 ~= 4.5:16 — actually trying for 2.9:16 means w/h = 0.18125; 104/368 = 0.282. That's wider than 2.9:16. Let's make taller? cap at BOARD_H. Accept current ratio (~2.83:10 ≈ 4.5:16) — close enough.

// Dot grid per lane: 4 cols x 8 rows = 32 cells; we sample N dots from this
const LANE_COLS = 4;
const LANE_ROWS = 8;

function generateDots(laneIdx, density, rng) {
  // pick `density` cells from the 32 grid, biased to spread out
  const cells = [];
  for (let r = 0; r < LANE_ROWS; r++) {
    for (let c = 0; c < LANE_COLS; c++) {
      cells.push({ r, c });
    }
  }
  // shuffle via rng
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }
  // To avoid clusters, sort picked by row staggering:
  const picked = cells.slice(0, density);
  return picked.map((cell, i) => ({
    id: `L${laneIdx}-${cell.r}-${cell.c}`,
    laneIdx,
    row: cell.r,
    col: cell.c,
  }));
}

function dotPos(dot) {
  // returns {x,y} in lane-local coordinates
  const cellW = LANE_W / LANE_COLS;
  const cellH = LANE_H / LANE_ROWS;
  return {
    x: cellW * (dot.col + 0.5),
    y: cellH * (dot.row + 0.5),
  };
}

function dotDistance(a, b) {
  // Chebyshev on the lane sub-grid
  if (a.laneIdx !== b.laneIdx) return Infinity;
  return Math.max(Math.abs(a.row - b.row), Math.abs(a.col - b.col));
}

// ----------------------------- DETECTION ALGOS -----------------------------

const DETECTION_ALGOS = {
  subtract: {
    label: "V − S",
    desc: "Range = max(0, Eye − Stealth)",
    range: (v, s) => Math.max(0, v - s),
  },
  binary: {
    label: "Binary",
    desc: "If Stealth ≥ Eye → invisible, else range = Eye",
    range: (v, s) => (s >= v ? 0 : v),
  },
  half: {
    label: "Halved",
    desc: "Range = max(0, Eye − ⌈S/2⌉)",
    range: (v, s) => Math.max(0, v - Math.ceil(s / 2)),
  },
};

// Compute which dots a card at `dot` with vis V can see, given placed cards
function whoCanThisCardSee(dot, vis, placedCards, algo) {
  const range = algo.range(vis, 0); // before stealth modifier per-target
  const seen = [];
  for (const other of placedCards) {
    if (other.dot.id === dot.id) continue;
    const d = dotDistance(dot, other.dot);
    if (d === Infinity) continue;
    const effRange = algo.range(vis, other.stealth);
    if (d <= effRange) seen.push(other);
  }
  return seen;
}

// Compute which placed enemy cards CAN SEE `dot` (i.e. dot is exposed to them)
function whoCanSeeMe(dot, myStealth, placedCards, algo) {
  const seers = [];
  for (const other of placedCards) {
    if (other.dot.id === dot.id) continue;
    const d = dotDistance(dot, other.dot);
    if (d === Infinity) continue;
    const effRange = algo.range(other.vis, myStealth);
    if (d <= effRange) seers.push(other);
  }
  return seers;
}

// ----------------------------- COMPONENTS -----------------------------

// Canonical card. Always renders at the same logical size (110x154).
// Callers wrap in a sized container and use CSS transform: scale(...) to fit.
function GameCard({ card, faceDown, dragging, glow, owner, onPointerDown, onClick }) {
  if (faceDown) {
    return (
      <div
        className={`card card--back ${owner === "them" ? "card--back-enemy" : ""}`}
        onPointerDown={onPointerDown}
        onClick={onClick}
      >
        <div className="card-back-pattern" />
        <div className="card-back-mark">◆</div>
      </div>
    );
  }
  return (
    <div
      className={`card ${dragging ? "card--dragging" : ""} ${glow ? "card--glow" : ""} ${owner === "them" ? "card--enemy" : ""}`}
      onPointerDown={onPointerDown}
      onClick={onClick}
    >
      <div className="card-corner card-corner--tl">
        <div className="corner-num">{card.stealth}</div>
        <div className="corner-label">STL</div>
      </div>
      <div className="card-corner card-corner--tr">
        <div className="corner-num">{card.power}</div>
        <div className="corner-label">PWR</div>
      </div>
      <div className="card-art">
        <div className="card-art-stripes" />
        <div className="card-art-label">{card.role}</div>
      </div>
      <div className="card-vis">
        <div className="vis-eye">◉</div>
        <div className="vis-num">{card.vis}</div>
      </div>
      <div className="card-name">{card.name}</div>
      <div className="card-text">{card.text}</div>
    </div>
  );
}

// Card width/height are 110x154 — exposed for scaling math
const CARD_W = 110;
const CARD_H = 154;
window.CARD_W = CARD_W;
window.CARD_H = CARD_H;

window.GameCard = GameCard;
window.LANE_POOL = LANE_POOL;
window.CARD_POOL = CARD_POOL;
window.buildDeck = buildDeck;
window.makeRng = makeRng;
window.STAGE_W = STAGE_W;
window.STAGE_H = STAGE_H;
window.HEADER_H = HEADER_H;
window.FOOTER_H = FOOTER_H;
window.BOARD_H = BOARD_H;
window.SIDE_PAD = SIDE_PAD;
window.LANE_GAP = LANE_GAP;
window.LANE_W = LANE_W;
window.LANE_H = LANE_H;
window.LANE_COLS = LANE_COLS;
window.LANE_ROWS = LANE_ROWS;
window.generateDots = generateDots;
window.dotPos = dotPos;
window.dotDistance = dotDistance;
window.DETECTION_ALGOS = DETECTION_ALGOS;
window.whoCanThisCardSee = whoCanThisCardSee;
window.whoCanSeeMe = whoCanSeeMe;
