// MemeGraph — The Living Receipt. Story-first renderer over the frozen weave.
// All human-facing strings come from copy.mjs; all positions from
// model.storyLayout. DOM record elements carry data-node-id / data-edge-id /
// data-rel and mirror the native frame exactly - never fabricated.
import {
  getFrame, findNode, traceUpstream, traceDownstream, diffFrames,
  storyLayout, storyLanes, storyColumnX, STORY_GEO, portraitGeometry, portraitColX,
  nodeInspector, exportReceipt, timingOf, familyOf, TRACE_RELS,
} from "./model.mjs";
import * as C from "./copy.mjs";

const NS = "http://www.w3.org/2000/svg";
const $ = (id) => document.getElementById(id);
const svgEl = (tag, attrs = {}) => {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
};
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
};
const rm = matchMedia("(prefers-reduced-motion: reduce)").matches;
const portraitMQ = matchMedia("(max-width: 760px)");
const isPortrait = () => portraitMQ.matches;

const S = {
  data: null,
  frameIndex: 6,
  pos: new Map(),
  focus: null, // "why" | "against"
  selected: null,
  panelMode: null, // "node" | "receipt" | "share"
  playing: null,
  playedOnce: false,
  expert: sessionStorage.getItem("mg2.expert") === "1",
  view: null,
  base: null,
  prevIds: new Set(),
  fontCache: null,
  pinch: null,
  geo: null,
  userZoom: false,
};

/* ---------- small helpers ---------- */

function wrapWords(s, width) {
  const words = String(s ?? "").split(/\s+/);
  const lines = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > width) { if (cur.trim()) lines.push(cur.trim()); cur = w; }
    else cur += " " + w;
  }
  if (cur.trim()) lines.push(cur.trim());
  return lines;
}

function textLines(txt, { x, y, lh = 20, anchor = "middle", cls = "" }) {
  const t = svgEl("text", { x, y, "text-anchor": anchor, class: cls });
  txt.forEach((line, i) => {
    const ts = svgEl("tspan", { x, dy: i === 0 ? 0 : lh });
    ts.textContent = line;
    t.append(ts);
  });
  return t;
}

function fpShort(hash) {
  if (!hash || hash.length < 12) return hash ?? "";
  return `${hash.slice(0, 8)}…${hash.slice(-4)}`;
}

/* ---------- geometry ---------- */

function edgeEnds(e, port) {
  // Visual endpoints: dependency edges into the call land on the card's LEFT
  // edge; into recipe chips on the chip edge; the scar is drawn explicitly.
  const a = S.pos.get(e.src);
  const b = S.pos.get(e.dst);
  if (!a || !b) return null;
  const g = port ? (S.geo ?? portraitGeometry(getFrame(S.data, S.frameIndex), { expert: S.expert })) : STORY_GEO.landscape;
  const dstNode = findNode(getFrame(S.data, S.frameIndex), e.dst);
  let a2 = { ...a };
  let b2 = { ...b };
  if (e.rel === "dependency" && dstNode?.kind === "experiment") {
    if (port) b2 = { x: Math.min(Math.max(a.x, g.card.x - 130), g.card.x + 130), y: g.card.y - g.card.h / 2 };
    else b2 = { x: g.card.x - g.card.w / 2, y: g.card.y + (Math.sign(a.y - g.card.y) * 44) };
  } else if (e.rel === "dependency" && dstNode?.kind === "recipe") {
    b2 = port ? { x: b.x, y: b.y - 18 } : { x: b.x - 86, y: b.y };
  } else if (e.rel === "dependency" && dstNode?.kind === "outcome" && port) {
    a2 = { x: a.x, y: g.card.y + g.card.h / 2 };
    b2 = { x: b.x, y: b.y - 44 };
  }
  return { a: a2, b: b2 };
}

function edgePath(e, port) {
  const ends = edgeEnds(e, port);
  if (!ends) return "";
  const { a, b } = ends;
  const f = getFrame(S.data, S.frameIndex);
  const dst = findNode(f, e.dst);
  const src = findNode(f, e.src);

  if (e.rel === "source") {
    return `M ${a.x - 2} ${a.y - 3} L ${b.x} ${b.y - 6}`;
  }
  if (e.rel === "contradicts") {
    // coral zigzag bracket, 3 segments, with a notch break in the middle
    const steps = 7;
    const dx = (b.x - a.x) / steps;
    const dy = (b.y - a.y) / steps;
    const px = -(b.y - a.y), py = b.x - a.x;
    const len = Math.hypot(px, py) || 1;
    const ux = (px / len) * 9, uy = (py / len) * 9;
    let d = `M ${a.x} ${a.y}`;
    for (let i = 1; i < steps; i++) {
      const s = i % 2 === 0 ? -1 : 1;
      d += ` L ${a.x + dx * i + ux * s} ${a.y + dy * i + uy * s}`;
    }
    d += ` L ${b.x} ${b.y}`;
    return d;
  }
  if (e.rel === "supersedes") {
    if (port) return `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
    const my = Math.max(a.y, b.y) + 60;
    return `M ${a.x} ${a.y} C ${a.x} ${my}, ${b.x} ${my}, ${b.x} ${b.y}`;
  }
  // dependency
  if (dst?.kind === "outcome") {
    if (port) return `M ${a.x} ${a.y} L ${b.x} ${b.y}`; // portrait: straight, faint (see CSS)
    // the scar: slightly jagged coral line from card edge to the stamp
    const x1 = a.x + 120, y1 = a.y;
    const x2 = b.x - 86, y2 = b.y - 42;
    const kk = [0.25, 0.45, 0.62, 0.8];
    let d = `M ${x1} ${y1}`;
    for (const k of kk) {
      const px = x1 + (x2 - x1) * k;
      const py = y1 + (y2 - y1) * k;
      d += ` L ${px + (k % 0.5 < 0.3 ? -7 : 7)} ${py}`;
    }
    d += ` L ${x2} ${y2}`;
    return d;
  }
  if (port) {
    // portrait: dependency/supersedes recede as straight hairlines
    return `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
  }
  // generic 1.5px converge curve
  const mx = (a.x + b.x) / 2;
  return `M ${a.x} ${a.y} C ${mx} ${a.y}, ${mx} ${b.y}, ${b.x} ${b.y}`;
}

/* ---------- captions ---------- */

function captionDefaultVisible(n) {
  const lab = n.label ?? "";
  if (n.kind === "entity" || n.kind === "recipe" || n.kind === "assessment") return true;
  if (n.kind === "observation") {
    if (/outcome/.test(lab)) return true;
    if (/p04/.test(lab) && /feature/.test(lab)) return true;
  }
  return false;
}

function captionPos(n, p, port) {
  // {dx, dy, anchor, width} relative to node centre
  const lab = n.label ?? "";
  if (port) {
    // Portrait rows are tight; most observations carry their caption in the
    // inspector. Two must stay on the field, each on its own block row:
    // the Halcyon source-claim caption (block-width, under the diamond) and
    // the Glass counterexample outcome caption (centred under the diamond).
    if (n.kind === "observation" && /p07/.test(lab) && /outcome/.test(lab))
      return { dx: 0, dy: 30, anchor: "middle", width: 44 };
    if (n.kind === "observation" && /p04/.test(lab) && /feature/.test(lab)
        && n.payload?.value?.explicit_fiction === false)
      // anchored to the block's left edge: dx from node x back to the gutter edge
      return { dx: 64 - p.x, dy: 30, anchor: "start", width: 44 };
    return null;
  }
  if (n.kind === "entity") {
    if (/experiment/.test(lab)) return null;
    return { dx: 0, dy: 28, anchor: "middle", width: 30 };
  }
  if (/p04/.test(lab) && /feature/.test(lab)) {
    // the disputed claim sits below its diamond; the other Halcyon record goes
    // above its dot — high enough to clear the lane rail, the contra mark, and
    // the outcome caption that flips to the left of its dot near the card
    if (n.payload?.value?.explicit_fiction === false) return { dx: 0, dy: 22, anchor: "middle", width: 21 };
    // single line, above-right of the dot: the band between this lane and the
    // one above is ~47px deep between the neighbours' captions — one line at
    // -30 clears both, the rail, and the contra mark
    return { dx: 16, dy: -30, anchor: "start", width: 46 };
  }
  if (n.kind === "observation") return { dx: 18, dy: -6, anchor: "start", width: 22 };
  return null;
}

/* ---------- node glyphs ---------- */

function drawNode(gEl, n, frame, p, port) {
  const stance = C.stanceOf(n, frame);
  const kind = n.kind;
  const body = svgEl("g", { class: "node-body" });
  const hitPad = kind === "experiment" ? [g().card.w, g().card.h]
    : kind === "entity" && /experiment/.test(n.label ?? "") ? [92, 24]
    : kind === "outcome" ? [180, 110]
    : kind === "source" ? [18, 18]
    : [52, 52];
  gEl.append(svgEl("rect", {
    x: -hitPad[0] / 2, y: -hitPad[1] / 2, width: hitPad[0], height: hitPad[1],
    fill: "transparent", class: "node-hit",
  }));

  if (kind === "entity" && !/experiment/.test(n.label ?? "")) {
    body.append(svgEl("circle", { cx: 0, cy: 0, r: 8, class: "ent-circle" }));
    body.append(svgEl("circle", { cx: 0, cy: 0, r: 16, class: "sel-ring" }));
    gEl.append(body);
    const cap = svgEl("text", {
      x: port ? 16 : 0, y: port ? 5 : 26,
      "text-anchor": port ? "start" : "middle", class: "lane-name",
    });
    cap.textContent = C.humanCaption(n, frame);
    gEl.append(cap);
    addExpertId(gEl, n, port ? 30 : 42);
  } else if (kind === "observation") {
    if (stance === "against") {
      body.append(svgEl("rect", { x: -8, y: -8, width: 16, height: 16, transform: "rotate(45)", class: "obs-dot obs-diamond" }));
    } else {
      body.append(svgEl("circle", { cx: 0, cy: 0, r: 7.5, class: "obs-dot" }));
    }
    body.append(svgEl("circle", { cx: 0, cy: 0, r: 15, class: "sel-ring" }));
    gEl.append(body);
    addCaption(gEl, n, frame, p, port);
    addExpertId(gEl, n, 20);
  } else if (kind === "assessment") {
    const label = C.shortCaption(n, frame);
    const lines = wrapWords(label, port ? 18 : 22);
    const w = Math.max(...lines.map((l) => l.length)) * (port ? 9.4 : 7.2) + 30;
    const h = lines.length * 16 + 16;
    body.append(svgEl("rect", { x: -w / 2, y: -h / 2, width: w, height: h, rx: h / 2, class: "chip-rect-reserv" }));
    const t = textLines(lines, { x: 0, y: 0 - (lines.length - 1) * 8 + 5, lh: 16, cls: "chip-text chip-text-cream" });
    body.append(t);
    body.append(svgEl("rect", { x: -w / 2 - 6, y: -h / 2 - 6, width: w + 12, height: h + 12, rx: h / 2 + 6, class: "sel-ring" }));
    gEl.append(body);
    addExpertId(gEl, n, h / 2 + 18);
  } else if (kind === "recipe") {
    const rejected = frame?.recipe?.id === n.id && frame.recipe.state === "rejected";
    const label = C.shortCaption(n, frame);
    const lines = wrapWords(label, port ? 18 : 22);
    const w = Math.max(...lines.map((l) => l.length)) * (port ? 9.4 : 7.2) + 32;
    const h = lines.length * 16 + 18;
    const cls = rejected ? "chip-rect-against" : n.stale ? "chip-rect-stale" : "chip-rect-paper";
    body.append(svgEl("rect", { x: -w / 2, y: -h / 2, width: w, height: h, rx: 9, class: "chip-rect " + cls }));
    const t = textLines(lines, { x: 0, y: 0 - (lines.length - 1) * 8 + 5, lh: 16, cls: "chip-text chip-text-cream" });
    body.append(t);
    if (rejected) {
      body.append(svgEl("line", { x1: -w / 2 - 8, y1: 6, x2: w / 2 + 8, y2: -6, class: "chip-strike" }));
    }
    body.append(svgEl("rect", { x: -w / 2 - 6, y: -h / 2 - 6, width: w + 12, height: h + 12, rx: 12, class: "sel-ring" }));
    gEl.append(body);
    addExpertId(gEl, n, h / 2 + 18);
  } else if (kind === "entity" && /experiment/.test(n.label ?? "")) {
    // "Call #001" sits bottom-right inside the card, on the fingerprint baseline
    const t = svgEl("text", { x: 0, y: 0, "text-anchor": "end", class: "card-callid" });
    t.textContent = C.humanCaption(n, frame);
    gEl.append(t);
  } else if (kind === "experiment") {
    drawCard(gEl, n, frame, port);
  } else if (kind === "outcome") {
    drawStamp(gEl, n, frame, port);
  } else if (kind === "source") {
    body.append(svgEl("rect", { x: -5, y: -3.5, width: 10, height: 7, rx: 1.5, class: "src-stub" }));
    body.append(svgEl("circle", { cx: 0, cy: 0, r: 10, class: "sel-ring" }));
    gEl.append(body);
    const hov = svgEl("text", { x: 10, y: -8, class: "src-hover" });
    hov.textContent = `${C.INSPECTOR.from} · ${C.MISC.savedLine(C.humanDate(n.payload?.captured_at))}`;
    gEl.append(hov);
    const eh = svgEl("text", { x: 0, y: 13, "text-anchor": "middle", class: "src-hash" });
    eh.textContent = (n.payload?.sha256 ?? "").slice(0, 8);
    gEl.append(eh);
  } else {
    body.append(svgEl("circle", { cx: 0, cy: 0, r: 6, class: "obs-dot" }));
    gEl.append(body);
  }
}

function addExpertId(gEl, n, dy) {
  const t = svgEl("text", { x: 0, y: dy, "text-anchor": "middle", class: "eid" });
  t.textContent = n.id.slice(0, 22);
  gEl.append(t);
}

function addCaption(gEl, n, frame, p, port) {
  let spec = captionPos(n, p, port);
  if (!spec) return;
  const lines = wrapWords(C.humanCaption(n, frame), spec.width);
  // If a start-anchored caption would slide under the call card's left edge —
  // checked vertically too — anchor it to the left of the dot instead.
  if (!port && spec.anchor === "start" && n.kind === "observation") {
    const card = STORY_GEO.landscape.card;
    const maxW = Math.max(...lines.map((l) => l.length)) * 7.9;
    const capTop = p.y + spec.dy - 16;
    const capBot = p.y + spec.dy + (lines.length - 1) * 19 + 4;
    const xHits = p.x + spec.dx + maxW > card.x - card.w / 2 - 8 && p.x < card.x - card.w / 2;
    const yHits = capTop < card.y + card.h / 2 && capBot > card.y - card.h / 2;
    if (xHits && yHits) {
      spec = { dx: -18, dy: spec.dy, anchor: "end", width: spec.width };
    }
  }
  const t = textLines(lines, {
    x: spec.dx, y: spec.dy, lh: port ? 22 : 19, anchor: spec.anchor,
    cls: "node-label" + (captionDefaultVisible(n) ? "" : " cap-hover"),
  });
  gEl.append(t);
}

/* ---------- the call card ---------- */

function g() {
  if (S.geo) return S.geo;
  return isPortrait()
    ? portraitGeometry(getFrame(S.data, S.frameIndex), { expert: S.expert })
    : STORY_GEO.landscape;
}

function drawCard(gEl, n, frame, port) {
  const geo = g().card;
  const w = geo.w, h = geo.h;
  const call = frame.call ?? {};
  const hash = call.prediction_hash ?? "";
  const card = svgEl("g", { class: "card-art" });

  card.append(svgEl("rect", { x: -w / 2, y: -h / 2, width: w, height: h, rx: 6, class: "card-rect" }));
  card.append(svgEl("rect", { x: -w / 2 + 6, y: -h / 2 + 6, width: w - 12, height: h - 12, rx: 3, class: "card-inner" }));

  // padlock glyph, top-left
  const lock = svgEl("g", { class: "card-lock-wrap", transform: `translate(${-w / 2 + 22}, ${-h / 2 + 22})` });
  lock.append(svgEl("path", { d: "M -5 0 L -5 -6 A 5 5 0 0 1 5 -6 L 5 0", class: "card-lock" }));
  lock.append(svgEl("rect", { x: -8, y: -1, width: 16, height: 12, rx: 2.5, class: "card-lock-fill" }));
  lock.append(svgEl("line", { x1: -4, y1: 3, x2: 4, y2: 8, class: "card-glint" }));
  card.append(lock);

  const kick = svgEl("text", { x: -w / 2 + 40, y: -h / 2 + 24, class: "kicker card-kicker" });
  kick.textContent = C.CALL_CARD.kicker;
  card.append(kick);
  const locked = svgEl("text", { x: w / 2 - 16, y: -h / 2 + 24, "text-anchor": "end", class: "card-locklabel" });
  locked.textContent = C.CALL_CARD.lockedLabel(C.humanDate(call.created_at));
  card.append(locked);

  const humanLines = wrapWords(C.CALL_CARD.human, port ? 36 : 34);
  card.append(textLines(humanLines, { x: 0, y: -h / 2 + (port ? 56 : 52), lh: port ? 22 : 19, cls: "card-human" }));

  const crit = svgEl("text", { x: 0, y: h / 2 - (port ? 60 : 30), "text-anchor": "middle", class: "card-criteria" });
  crit.textContent = C.criteriaShort(call.falsification_criteria);
  card.append(crit);
  // left-aligned so the "Call #001" strip clears it (own row on portrait)
  const fp = svgEl("text", { x: -w / 2 + 16, y: h / 2 - (port ? 14 : 16), class: "card-fp" });
  fp.textContent = `${C.CALL_CARD.fingerprint} ${fpShort(hash)}`;
  card.append(fp);
  gEl.append(card);
}

/* ---------- the stamp (outcome) ---------- */

function drawStamp(gEl, n, frame, port) {
  const state = C.resultState(frame);
  const word = C.RESULT.stamp[state ?? "resolved_miss"] ?? "";
  const sw = port ? 170 : 150, sh = port ? 70 : 64;
  const rot = svgEl("g", { transform: "rotate(-8)", class: "stamp-rot" });
  rot.append(svgEl("rect", { x: -sw / 2, y: -sh / 2, width: sw, height: sh, rx: 5, class: "stamp-rect" }));
  rot.append(svgEl("rect", { x: -sw / 2 + 4, y: -sh / 2 + 4, width: sw - 8, height: sh - 8, rx: 3, class: "stamp-inner" }));
  const wt = svgEl("text", { x: 0, y: sh * 0.24, "text-anchor": "middle", class: "stamp-word" });
  wt.textContent = word;
  rot.append(wt);
  gEl.append(rot);
  const lines = C.RESULT.lines(frame.outcome, frame.call);
  const rlh = port ? 24 : 19; // 17px portrait glyphs need more than 19px between baselines
  lines.forEach((line, i) => {
    const t = svgEl("text", { x: 0, y: sh / 2 + 26 + i * rlh, "text-anchor": "middle", class: "stamp-line" });
    t.textContent = line;
    gEl.append(t);
  });
  gEl.append(svgEl("rect", { x: -sw / 2 - 8, y: -sh / 2 - 8, width: sw + 16, height: sh + 16, rx: 8, class: "sel-ring" }));
}

/* ---------- annotations (not nodes) ---------- */

function drawZones(layer, frame, port) {
  const geo = g();
  const hasCall = !!frame.call;
  if (port) {
    if (hasCall) {
      layer.append(svgEl("rect", { x: 0, y: geo.sealY, width: geo.w, height: geo.h - geo.sealY, fill: "url(#hatch)" }));
      const seal = svgEl("g", { class: "seal-g" });
      seal.append(svgEl("line", { x1: 0, y1: geo.sealY, x2: geo.w, y2: geo.sealY, class: "seal-line" }));
      // lock + label stay out of the 64px date gutter (lock body >= x 64)
      const lock = svgEl("g", { transform: `translate(${geo.left + 10}, ${geo.sealY - 12})` });
      lock.append(svgEl("path", { d: "M -5 0 L -5 -6 A 5 5 0 0 1 5 -6 L 5 0", class: "card-lock" }));
      lock.append(svgEl("rect", { x: -8, y: -1, width: 16, height: 12, rx: 2.5, class: "card-lock-fill" }));
      seal.append(lock);
      const lab = svgEl("text", { x: geo.left + 26, y: geo.sealY - 8, class: "kicker seal-label" });
      lab.textContent = C.FIELD.sealLabel;
      seal.append(lab);
      const aft = svgEl("text", { x: geo.w - 10, y: geo.sealY + 20, "text-anchor": "end", class: "zone-label" });
      aft.textContent = C.FIELD.afterLabel;
      seal.append(aft);
      layer.append(seal);
    }
    return;
  }
  // landscape
  const sx = geo.sealX;
  if (hasCall) {
    layer.append(svgEl("rect", { x: sx, y: geo.sealTop, width: geo.w - sx, height: geo.sealBottom - geo.sealTop, fill: "url(#hatch)" }));
    const bef = svgEl("text", { x: 14, y: geo.sealTop + 18, class: "zone-label" });
    bef.textContent = C.FIELD.beforeLabel;
    layer.append(bef);
    const seal = svgEl("g", { class: "seal-g" });
    seal.append(svgEl("line", { x1: sx, y1: geo.sealTop, x2: sx, y2: geo.sealBottom, class: "seal-line" }));
    const lock = svgEl("g", { transform: `translate(${sx}, ${geo.sealTop + 12})` });
    lock.append(svgEl("path", { d: "M -5 0 L -5 -6 A 5 5 0 0 1 5 -6 L 5 0", class: "card-lock" }));
    lock.append(svgEl("rect", { x: -8, y: -1, width: 16, height: 12, rx: 2.5, class: "card-lock-fill" }));
    lock.append(svgEl("line", { x1: -4, y1: 3, x2: 4, y2: 8, class: "card-glint" }));
    seal.append(lock);
    const lab = svgEl("text", { x: sx + 12, y: geo.sealTop + 16, class: "kicker seal-label" });
    lab.textContent = C.FIELD.sealLabel;
    seal.append(lab);
    const aft = svgEl("text", { x: geo.w - 12, y: geo.sealTop + 18, "text-anchor": "end", class: "zone-label" });
    aft.textContent = C.FIELD.afterLabel;
    seal.append(aft);
    layer.append(seal);
  }
}

function drawAxis(layer, frame, port) {
  const days = new Set();
  for (const n of frame.nodes ?? []) {
    const d = (n.known_at ?? n.recorded_at ?? "").slice(0, 10);
    if (d) days.add(d);
  }
  if (port) {
    // left gutter carries only date labels — one per block, at the block's top
    const geo = g();
    for (const entry of geo.gutter) {
      if (!days.has(entry.day)) continue;
      const t = svgEl("text", { x: geo.gutterX, y: entry.y, class: "date-label" });
      t.textContent = C.humanDate(entry.day + "T00:00:00Z");
      layer.append(t);
    }
    // column headers over the project block's three dot columns
    if (geo.colHeaderY != null) {
      for (const d of ["2026-01-01", "2026-01-02", "2026-04-01"]) {
        const t = svgEl("text", { x: portraitColX(d), y: geo.colHeaderY, "text-anchor": "middle", class: "date-label" });
        t.textContent = C.humanDate(d + "T00:00:00Z");
        layer.append(t);
      }
    }
    return;
  }
  const geo = STORY_GEO.landscape;
  let hasApr = false;
  for (const d of days) {
    const x = storyColumnX(d);
    if (x >= geo.gapX) hasApr = true;
    const t = svgEl("text", { x, y: 28, "text-anchor": "middle", class: "date-label" });
    t.textContent = C.humanDate(d + "T00:00:00Z");
    layer.append(t);
  }
  if (hasApr) {
    const gx = geo.gapX;
    layer.append(svgEl("line", { x1: gx - 56, y1: 31, x2: gx - 42, y2: 31, class: "gap-dash", stroke: "rgba(239,230,210,.35)", "stroke-width": 2 }));
    layer.append(svgEl("line", { x1: gx + 42, y1: 31, x2: gx + 56, y2: 31, class: "gap-dash", stroke: "rgba(239,230,210,.35)", "stroke-width": 2 }));
    const t = svgEl("text", { x: gx, y: 32, "text-anchor": "middle", class: "gap-label" });
    t.textContent = C.FIELD.gapLabel;
    layer.append(t);
  }
}

function drawRails(layer, frame, port) {
  if (port) {
    // per-row guide rails behind the dots: entity column -> last dot column
    const geo = g();
    for (const [pid, y] of geo.rows) {
      const rail = svgEl("line", {
        x1: geo.entityX - 4, y1: y,
        x2: (pid === "p07" ? portraitColX("2026-01-02") : portraitColX("2026-04-01")) + 12, y2: y,
        class: "lane-rail", stroke: "rgba(233,185,73,.35)",
        "stroke-width": 2.5,
      });
      layer.append(rail);
    }
    if (geo.thinkingLabelY != null) {
      const tl = svgEl("text", { x: geo.left, y: geo.thinkingLabelY, class: "zone-label", id: "thinking-label" });
      tl.textContent = C.FIELD.thinkingLane;
      layer.append(tl);
    }
    return;
  }
  const geo = STORY_GEO.landscape;
  const lanes = storyLanes(frame);
  lanes.forEach((pid, i) => {
    const laneNodes = (frame.nodes ?? []).filter((n) => familyOf(n) === pid);
    if (!laneNodes.length) return;
    const xs = laneNodes.map((n) => S.pos.get(n.id)?.x ?? 0);
    const y = i < 3 ? geo.laneBase + i * geo.laneStep : geo.laneBase + 3 * geo.laneStep + 40;
    const x1 = Math.min(...xs) - 12;
    const x2 = Math.max(...xs) + 12;
    const glassSplit = pid === "p07" && laneNodes.some((n) => /outcome/.test(n.label ?? ""));
    const rail = svgEl("line", {
      x1, y1: y, x2: glassSplit ? storyColumnX("2026-04-10") - 8 : x2, y2: y,
      class: "lane-rail", stroke: "rgba(233,185,73,.35)", "stroke-width": 2.5,
      style: `animation-delay:${i * 1.1}s`,
    });
    layer.append(rail);
    if (glassSplit) {
      layer.append(svgEl("line", {
        x1: storyColumnX("2026-04-10") - 8, y1: y, x2, y2: y,
        class: "lane-rail", stroke: "rgba(255,107,74,.45)", "stroke-width": 2.5,
        style: `animation-delay:${i * 1.1}s`,
      }));
    }
  });
  const tl = svgEl("text", { x: 14, y: geo.thinkingY - 36, class: "zone-label" });
  tl.textContent = C.FIELD.thinkingLane;
  layer.append(tl);
}

function drawUnknowns(layer, frame, port) {
  const list = S.expert ? (frame.unknowns ?? []) : C.unknownsHuman(frame);
  if (!list.length) return;
  const u = g().unknowns;
  const grp = svgEl("g", { class: "annot unknowns-annot", id: "unknowns-box" });
  // wrap every line inside the dashed border; over-long lines break near the
  // middle so a lone word never orphans on the last line
  // portrait: 30 chars ≈ 285px at the phone font — stays inside x<=404; the
  // kicker title's wider glyphs get 26. Keep in sync with portraitGeometry.
  const fit = port ? 30 : Math.floor((u.w - 30) / 7.6);
  const balanced = (line) =>
    wrapWords(line, line.length <= fit ? fit : Math.min(fit, Math.ceil(line.length / 2) + 4));
  const titleLines = port ? wrapWords(C.UNKNOWNS.title, 26) : [C.UNKNOWNS.title];
  const wrapped = list.flatMap(balanced);
  const lh = port ? 22 : 18; // portrait bumps the font to 17px; 18px baselines collide
  const titleLh = port ? 26 : 20;
  const titleH = titleLines.length * titleLh;
  const linesY = u.y + 20 + titleH + 10;
  const h = Math.max(u.h ?? 0, linesY + wrapped.length * lh - u.y - 4);
  // landscape: bottom-anchor so a content-grown box still clears the stamp's
  // top edge (its hit pad reaches ~56px above the stamp centre)
  const stampTop = port ? Infinity : STORY_GEO.landscape.stamp.y - 56;
  const uy = Math.min(u.y, stampTop - 14 - h);
  grp.append(svgEl("rect", { x: u.x, y: uy, width: u.w, height: h, rx: 10, class: "unknowns-box" }));
  titleLines.forEach((ln, i) => {
    const t = svgEl("text", { x: u.x + 14, y: uy + 20 + i * titleLh, class: "kicker unknowns-title" });
    t.textContent = ln;
    grp.append(t);
  });
  wrapped.forEach((line, i) => {
    const t = svgEl("text", { x: u.x + 14, y: uy + (linesY - u.y) + i * lh, class: "unknowns-line" });
    t.textContent = line;
    grp.append(t);
  });
  layer.append(grp);
}

function drawWaiting(layer, frame, port) {
  const state = C.resultState(frame);
  if (state !== "unresolved") return;
  const wp = g().waiting;
  const sw = port ? 170 : 150, sh = port ? 70 : 64;
  const grp = svgEl("g", { class: "annot waiting-annot", transform: `translate(${wp.x},${wp.y})`, id: "waiting-annot" });
  grp.append(svgEl("rect", { x: -sw / 2, y: -sh / 2, width: sw, height: sh, rx: 5, class: "waiting-box" }));
  const wt = svgEl("text", { x: 0, y: 5, "text-anchor": "middle", class: "waiting-word" });
  wt.textContent = C.RESULT.stamp.unresolved;
  grp.append(wt);
  const sub = svgEl("text", { x: 0, y: sh / 2 + 20, "text-anchor": "middle", class: "waiting-sub" });
  const subParts = C.CALL_CARD.waitingSub(
    frame.call?.falsification_criteria?.minimum_observation_days ?? "",
    C.humanDate(C.earliestAnswerDate(frame)),
  ).split(" · ");
  subParts.forEach((ln, i) => {
    const t = svgEl("tspan", { x: 0 });
    if (i) t.setAttribute("dy", "1.25em");
    t.textContent = ln;
    sub.append(t);
  });
  grp.append(sub);
  layer.append(grp);
}

/* ---------- frame render ---------- */

function renderFrame() {
  const frame = getFrame(S.data, S.frameIndex);
  const port = isPortrait();
  const layers = {
    zone: $("zone-layer"), rails: $("rails-layer"), edges: $("edges-layer"),
    nodes: $("nodes-layer"), annot: $("annot-layer"),
  };
  // outgoing elements get an exit animation, then are removed entirely
  const removedIds = new Set([...S.prevIds].filter((id) => !(frame?.nodes ?? []).some((n) => n.id === id)));
  for (const layer of Object.values(layers)) layer.textContent = "";
  if (!frame) return;
  S.geo = port ? portraitGeometry(frame, { expert: S.expert }) : STORY_GEO.landscape;
  S.pos = storyLayout(frame, { portrait: port, expert: S.expert });
  $("graph").classList.toggle("portrait", port);
  // world height is content-derived on portrait, so the base view changes per
  // frame; a user's manual zoom survives the frame change
  S.base = { x: 0, y: 0, w: S.geo.w, h: S.geo.h };
  if (!S.view || !S.userZoom) S.view = { ...S.base };
  applyView();

  drawZones(layers.zone, frame, port);
  drawAxis(layers.zone, frame, port);
  drawRails(layers.rails, frame, port);

  const entering = new Set([...frame.nodes.map((n) => n.id)].filter((id) => S.prevIds.size && !S.prevIds.has(id)));
  const prevEdgeIds = S.prevEdgeIds ?? new Set();

  for (const e of frame.edges ?? []) {
    const d = edgePath(e, port);
    if (!d) continue;
    const dst = findNode(frame, e.dst);
    const stance = C.stanceOf(dst, frame);
    let cls = "record-edge ";
    if (e.rel === "source") cls += "edge-src";
    else if (e.rel === "contradicts") cls += "edge-contra";
    else if (e.rel === "supersedes") cls += "edge-sup";
    else if (dst?.kind === "outcome") cls += "edge-scar";
    else cls += "edge-dep" + (stance === "against" ? " edge-dep-against" : "");
    const isNew = prevEdgeIds.size && !prevEdgeIds.has(e.id);
    if (dst?.kind === "outcome" && isNew && !rm) cls += " scar-enter";
    const pathEl = svgEl("path", {
      d, class: cls + (isNew && !(dst?.kind === "outcome") ? (S.lastDir === "back" ? " enter-b" : " enter-f") : ""),
      "data-edge-id": e.id, "data-src": e.src, "data-dst": e.dst, "data-rel": e.rel,
    });
    layers.edges.append(pathEl);
    if (e.rel === "contradicts") {
      const ends = edgeEnds(e, port);
      const mx = (ends.a.x + ends.b.x) / 2, my = (ends.a.y + ends.b.y) / 2;
      const mark = svgEl("text", {
        x: port ? mx - 20 : mx, y: port ? my - 2 : my - 12,
        "text-anchor": "middle", class: "contra-mark",
      });
      mark.textContent = "≠";
      layers.edges.append(mark);
    }
  }

  // the experiment entity renders last so its "Call #001" strip paints ON the card
  const drawOrder = [...frame.nodes].sort((a, b) =>
    (a.kind === "entity" && /experiment/.test(a.label ?? "") ? 1 : 0) -
    (b.kind === "entity" && /experiment/.test(b.label ?? "") ? 1 : 0));
  for (const n of drawOrder) {
    const p = S.pos.get(n.id);
    if (!p) continue;
    const stance = C.stanceOf(n, frame);
    const gEl = svgEl("g", {
      class: `record-node node-${n.kind} stance-${stance}${entering.has(n.id) ? (S.lastDir === "back" ? " enter-b" : " enter-f") : ""}${n.kind === "experiment" && entering.has(n.id) ? " card-enter" : ""}`,
      transform: `translate(${p.x},${p.y})`,
      "data-node-id": n.id,
      tabindex: "0", role: "button",
      "aria-label": C.humanCaption(n, frame) || n.label || n.id,
    });
    const t = svgEl("title");
    t.textContent = C.humanCaption(n, frame) || n.label || n.id;
    gEl.append(t);
    drawNode(gEl, n, frame, p, port);
    const hot = (on) => {
      if (S.focus) return;
      for (const e of [...layers.edges.querySelectorAll(".record-edge")]) {
        if (e.dataset.src === n.id || e.dataset.dst === n.id) e.classList.toggle("edge-hot", on);
      }
    };
    gEl.addEventListener("pointerenter", () => hot(true));
    gEl.addEventListener("pointerleave", () => hot(false));
    gEl.addEventListener("focus", () => hot(true));
    gEl.addEventListener("blur", () => hot(false));
    gEl.addEventListener("click", () => openPanel("node", n.id));
    gEl.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); openPanel("node", n.id); }
    });
    layers.nodes.append(gEl);
  }

  drawUnknowns(layers.annot, frame, port);
  drawWaiting(layers.annot, frame, port);
  if (port) drawChapterStack();

  S.prevIds = new Set(frame.nodes.map((n) => n.id));
  S.prevEdgeIds = new Set(frame.edges.map((e) => e.id));
  updateRail();
  applyFocusClasses();
}

function drawChapterStack() {
  const wrap = $("chapters");
  wrap.textContent = "";
  C.CHAPTERS.forEach((ch, i) => {
    if (i <= S.frameIndex) {
      const card = el("div", "chapter-card");
      card.append(el("h3", "", ch.title), el("p", "", ch.line));
      wrap.append(card);
    }
  });
  if (S.frameIndex < C.CHAPTERS.length - 1) {
    const fut = el("div", "chapter-card future");
    fut.append(el("p", "", C.MISC.chapterFuture));
    wrap.append(fut);
  }
  // receipt + share live at the end of the stack on phone (the rail is compact)
  const frame = getFrame(S.data, S.frameIndex);
  const rc = el("button", "btn-pill", C.ACTIONS.receipt);
  rc.type = "button";
  rc.addEventListener("click", () => openPanel("receipt"));
  const sh = el("button", "btn-pill", C.ACTIONS.share);
  sh.type = "button";
  sh.disabled = !frame?.call;
  sh.title = frame?.call ? "" : C.MISC.noCallYet;
  sh.addEventListener("click", () => openPanel("share"));
  wrap.append(rc, sh);
}

/* ---------- rail ---------- */

function updateNowLine() {
  const ch = C.CHAPTERS[S.frameIndex];
  if (isPortrait()) {
    $("now-line").textContent = `${ch.date} · ${ch.title}`;
  } else {
    $("now-line").textContent = `${C.ACTIONS.nowPrefix} ${ch.date} — ${ch.line}`;
  }
}

function updateRail() {
  const frame = getFrame(S.data, S.frameIndex);
  const i = S.frameIndex;
  if (S.focus) {
    $("now-line").textContent = S.focus === "why" ? C.FOCUS.whyCaption : C.FOCUS.againstCaption;
  } else {
    updateNowLine();
  }
  $("cutoff").value = String(i);
  for (const st of document.querySelectorAll(".stop")) {
    const si = Number(st.dataset.idx);
    st.classList.toggle("future", si > i);
    st.classList.toggle("active", si === i);
  }
  document.querySelector(".scrub-track").classList.toggle("locked", i >= 3);
  // phone: the active stop's date floats above the handle — clamp it inside
  // the viewport at the first/last stops so it never clips off the edge
  const sd = document.querySelector(".stop.active .s-date");
  if (sd) {
    sd.style.transform = "";
    const r = sd.getBoundingClientRect();
    const dx = r.left < 8 ? 8 - r.left : (r.right > innerWidth - 8 ? innerWidth - 8 - r.right : 0);
    if (dx) sd.style.transform = `translateX(${dx}px)`;
  }
  for (const id of ["btn-share", "btn-share-hero"]) {
    const b = $(id);
    if (!b) continue;
    b.disabled = !frame.call;
    b.title = frame.call ? "" : C.MISC.noCallYet;
  }
  // play label: "Play it again" only after a playthrough completed this session
  const label = rm
    ? (S.playedOnce && S.frameIndex >= 6 ? C.ACTIONS.replay : C.ACTIONS.next)
    : (S.playedOnce && S.frameIndex >= 6 ? C.ACTIONS.replay : C.ACTIONS.play);
  for (const id of ["btn-play", "btn-play-hero"]) {
    const pb = $(id);
    if (!pb || S.playing) continue;
    pb.innerHTML = "";
    pb.append(el("span", "tri", "▶"), el("span", "lbl", label));
    pb.setAttribute("aria-label", label);
  }
}

/* ---------- focus modes ---------- */

function setFocus(mode) {
  S.focus = S.focus === mode ? null : mode;
  pausePlay();
  applyFocusClasses();
  for (const [id, m] of [["btn-why", "why"], ["btn-why-hero", "why"], ["btn-against", "against"], ["btn-against-hero", "against"]]) {
    $(id)?.setAttribute("aria-pressed", String(S.focus === m));
  }
  $("btn-clearfocus").hidden = !S.focus;
  const hf = $("btn-clearfocus-hero");
  if (hf) hf.hidden = !S.focus;
  updateRail(); // restores or sets the now-line under focus
}

function applyFocusClasses() {
  const frame = getFrame(S.data, S.frameIndex);
  const svg = $("graph");
  for (const n of [...svg.querySelectorAll(".record-node")]) n.classList.remove("lit", "dim");
  for (const e of [...svg.querySelectorAll(".record-edge")]) e.classList.remove("lit", "dim");
  for (const a of [...svg.querySelectorAll(".annot, .unknowns-annot, .waiting-annot")]) a.classList.remove("lit", "dim");
  if (!S.focus || !frame) return;

  const keep = new Set();
  if (S.focus === "why") {
    const call = frame.nodes.find((n) => n.kind === "experiment");
    if (call) {
      keep.add(call.id);
      for (const id of traceUpstream(frame, call.id)) keep.add(id);
    }
  } else {
    for (const n of frame.nodes ?? []) {
      if (C.stanceOf(n, frame) === "against") {
        keep.add(n.id);
        // their own edge neighbourhood (one hop, native edges only)
        for (const e of frame.edges ?? []) {
          if (e.src === n.id) keep.add(e.dst);
          if (e.dst === n.id) keep.add(e.src);
        }
      }
    }
  }
  for (const n of [...svg.querySelectorAll(".record-node")]) {
    n.classList.toggle("dim", !keep.has(n.dataset.nodeId));
    n.classList.toggle("lit", keep.has(n.dataset.nodeId));
  }
  for (const e of [...svg.querySelectorAll(".record-edge")]) {
    const endpointsLit = keep.has(e.dataset.src) && keep.has(e.dataset.dst);
    const traceEdge = TRACE_RELS.includes(e.dataset.rel);
    const on = S.focus === "why" ? (endpointsLit && traceEdge) : endpointsLit;
    e.classList.toggle("dim", !on);
    e.classList.toggle("lit", on);
  }
  // unknowns box stays lit in against mode (it argued silently against the call)
  const unk = $("unknowns-box");
  if (unk) {
    unk.classList.toggle("lit", S.focus === "against");
    unk.classList.toggle("dim", S.focus === "why");
  }
  $("now-line").textContent = S.focus === "why" ? C.FOCUS.whyCaption : C.FOCUS.againstCaption;
}

/* ---------- inspector / panel ---------- */

function closePanel() {
  $("inspector").hidden = true;
  $("inspect-body").textContent = "";
  S.panelMode = null;
  S.selected = null;
  for (const gEl of [...$("graph").querySelectorAll(".record-node")]) gEl.classList.remove("selected");
}

function openPanel(mode, id) {
  pausePlay();
  S.panelMode = mode;
  const body = $("inspect-body");
  body.textContent = "";
  if (mode === "node") renderNodePanel(body, id);
  else if (mode === "receipt") renderReceiptPanel(body);
  else if (mode === "share") renderSharePanel(body);
  else if (mode === "expert") renderExpertPanel(body);
  $("inspector").hidden = false;
}

function renderExpertPanel(body) {
  body.append(el("p", "i-kicker", C.INSPECTOR.expert));
  body.append(el("h2", "i-title", C.ACTIONS.expertOn));
  const tbl = el("table", "i-gloss");
  for (const [term, human] of C.GLOSSARY) {
    const tr = el("tr");
    tr.append(el("td", "", term), el("td", "", human));
    tbl.append(tr);
  }
  body.append(tbl);
}

function renderNodePanel(body, id) {
  const frame = getFrame(S.data, S.frameIndex);
  const node = findNode(frame, id);
  const info = nodeInspector(node, frame);
  if (!info) { closePanel(); return; }
  S.selected = id;
  for (const gEl of [...$("graph").querySelectorAll(".record-node")]) gEl.classList.remove("selected");
  document.querySelector(`[data-node-id="${CSS.escape(id)}"]`)?.classList.add("selected");

  const kindWord = C.INSPECTOR.kindWord[info.status] ?? C.INSPECTOR.kindWord[info.kind] ?? info.kind;
  const roleWord = C.INSPECTOR.roleWord[info.role] ?? C.INSPECTOR.roleWord[info.kind] ?? "";
  body.append(el("p", "i-kicker", kindWord));
  body.append(el("h2", "i-title", C.humanCaption(node, frame) || info.label));
  if (roleWord) body.append(el("p", "i-role", roleWord));
  body.append(el("p", "i-body", C.humanExplain(node, frame)));

  // when table
  const tbl = el("table", "i-when");
  const row = (k, iso) => {
    const tr = el("tr");
    tr.append(el("td", "", k), el("td", "", C.humanDate(iso, true) || "—"));
    tbl.append(tr);
  };
  row(C.INSPECTOR.when.happened, info.observed_at);
  row(C.INSPECTOR.when.known, info.available_at);
  row(C.INSPECTOR.when.written, info.recorded_at);
  body.append(tbl);

  body.append(el("span", "i-label", C.INSPECTOR.knownAtCall));
  body.append(el("div", "i-value", timingOf(node, frame) === "later" ? C.INSPECTOR.no : C.INSPECTOR.yes));

  if (info.source_ids.length) {
    body.append(el("span", "i-label", C.INSPECTOR.from));
    const wrap = el("div", "i-src");
    for (const s of info.source_ids) {
      const snode = s.in_frame ? findNode(frame, s.id) : null;
      // each ref is two lines: saved date, then the fingerprint on its own nowrap line
      const mkRef = (tag, cls) => {
        const b = el(tag, cls);
        if (snode) {
          b.append(el("span", "i-ref-date", C.MISC.savedLine(C.humanDate(snode.payload?.captured_at, true))));
          b.append(el("span", "i-ref-hash", `${C.INSPECTOR.fingerprint} ${fpShort(snode.payload?.sha256)}`));
        } else {
          b.append(el("span", "i-ref-date", `${s.id.slice(0, 18)}…`));
          b.append(el("span", "i-ref-hash", C.MISC.notInView));
        }
        return b;
      };
      if (s.in_frame) {
        const b = mkRef("button", "i-ref");
        b.type = "button";
        b.addEventListener("click", () => openPanel("node", s.id));
        wrap.append(b);
      } else {
        wrap.append(mkRef("span", "i-ref plain"));
      }
    }
    body.append(wrap);
  }
  if (info.contradicts.length) {
    body.append(el("span", "i-label", C.INSPECTOR.against));
    const ul = el("ul", "i-against");
    for (const cn of info.contradicts) {
      const other = findNode(frame, cn.with);
      ul.append(el("li", "", (other ? C.humanCaption(other, frame) : cn.with) + (cn.basis ? ` — ${cn.basis}` : "")));
    }
    body.append(ul);
  }
  if (info.stale) {
    // superseding record's known_at when resolvable
    let when = "";
    const supEdge = (frame.edges ?? []).find((e) => e.rel === "supersedes" && e.src === node.id);
    const sup = supEdge ? findNode(frame, supEdge.dst) : null;
    if (sup) when = C.humanDate(sup.known_at, true);
    body.append(el("p", "i-body", C.INSPECTOR.older(when)));
  }
  if (info.synthetic) body.append(el("p", "i-body", C.INSPECTOR.madeUp));

  // expert section
  const det = el("details", "i-expert");
  if (S.expert) det.open = true;
  det.append(el("summary", "", C.INSPECTOR.expert));
  const et = el("table");
  const erow = (k, v) => {
    if (v === null || v === undefined || v === "") return;
    const tr = el("tr");
    tr.append(el("td", "", k), el("td", "", String(v)));
    et.append(tr);
  };
  const F = C.INSPECTOR.expertFields;
  erow(F.id, info.id);
  erow(F.raw_label, info.raw_label);
  erow(F.role, info.role);
  erow(F.status, info.status);
  erow(F.confidence_class, info.confidence_class);
  erow(F.assertion, info.assertion);
  erow(F.edge_debt, info.edge_debt);
  if (info.obligations?.length) {
    erow(F.obligations, info.obligations.map((o) =>
      [o.kind, o.reason ?? (o.related_record_ids ?? []).map((x) => x.slice(0, 20) + "…").join(", ")].filter(Boolean).join(" — ")
    ).join("\n"));
  }
  if (info.omitted_value_fields?.length) erow(F.omitted_value_fields, info.omitted_value_fields.join(", "));
  if (info.parent_ids.length) erow(F.parent_ids, info.parent_ids.map((p) => p.id + (p.in_frame ? "" : ` (${C.MISC.notInView})`)).join("\n"));
  if (info.source_ids.length) erow(F.source_ids, info.source_ids.map((s) => s.id).join("\n"));
  det.append(et);
  const pre = el("pre", "i-json");
  pre.textContent = JSON.stringify(info.payload, null, 1);
  det.append(el("span", "i-label", F.payload), pre);
  body.append(det);
}

function renderReceiptPanel(body) {
  const frame = getFrame(S.data, S.frameIndex);
  body.append(el("p", "i-kicker", C.RECEIPT.title));
  body.append(el("h2", "i-title", C.RECEIPT.title));
  body.append(el("p", "i-body", C.RECEIPT.what));
  body.append(el("span", "i-label", C.RECEIPT.provesTitle));
  body.append(el("p", "i-body", C.RECEIPT.proves));
  body.append(el("span", "i-label", C.RECEIPT.notTitle));
  const ul = el("ul", "i-against");
  for (const n of C.RECEIPT.not) ul.append(el("li", "", n));
  body.append(ul);
  body.append(el("p", "i-body", C.RECEIPT.frameNote(C.humanDate(frame?.as_of, true))));
  const save = el("button", "btn-paper", C.ACTIONS.saveReceipt);
  save.type = "button";
  save.addEventListener("click", downloadReceipt);
  const share = el("button", "btn-ghost", C.ACTIONS.share);
  share.type = "button";
  share.disabled = !frame.call;
  share.title = frame.call ? "" : C.MISC.noCallYet;
  share.addEventListener("click", () => openPanel("share"));
  body.append(save, share);
}

function downloadReceipt() {
  const r = exportReceipt(S.data, S.frameIndex);
  if (!r) return;
  const blob = new Blob([JSON.stringify(r, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "memegraph-weave-receipt.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ---------- share card (1080 x 1350 SVG -> PNG, zero network) ---------- */

async function fontFaceCSS() {
  if (S.fontCache) return S.fontCache;
  const faces = [
    ["Newsreader", "fonts/newsreader-var.woff2", "200 800", "normal"],
    ["Newsreader", "fonts/newsreader-var-italic.woff2", "200 800", "italic"],
    ["Atkinson Hyperlegible", "fonts/atkinson-hyperlegible-400.woff2", "400", "normal"],
    ["Atkinson Hyperlegible", "fonts/atkinson-hyperlegible-700.woff2", "700", "normal"],
    ["Anton", "fonts/anton-400.woff2", "400", "normal"],
    ["IBM Plex Mono", "fonts/ibm-plex-mono-400.woff2", "400", "normal"],
  ];
  let css = "";
  for (const [fam, url, w, st] of faces) {
    try {
      const buf = await fetch(url).then((r) => r.arrayBuffer());
      const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
      css += `@font-face{font-family:'${fam}';src:url(data:font/woff2;base64,${b64}) format('woff2');font-weight:${w};font-style:${st};}`;
    } catch { /* face missing - fallback fonts render */ }
  }
  S.fontCache = css;
  return css;
}

function esc(s) { return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

function svgTextLines(lines, x, y, lh, style) {
  return lines.map((l, i) => `<text x="${x}" y="${y + i * lh}" ${style}>${esc(l)}</text>`).join("");
}

async function buildShareSVG() {
  const frame = getFrame(S.data, S.frameIndex);
  const css = await fontFaceCSS();
  const state = C.resultState(frame);
  const waiting = state === "unresolved";
  const call = frame?.call ?? {};
  const hash = call.prediction_hash ?? "";
  const stampWord = waiting ? C.RESULT.stamp.unresolved : (C.RESULT.stamp[state] ?? "");
  const resLines = waiting ? [] : C.RESULT.lines(frame.outcome, call).slice(0, 2);
  const callLines = wrapWords(C.CALL_CARD.human, 38);
  // lesson: never truncate — up to 4 lines at 24px, step down to 22px if needed
  let lessonFont = 24, lessonLines = wrapWords(C.LESSON.plain, 58);
  if (lessonLines.length > 4) { lessonFont = 22; lessonLines = wrapWords(C.LESSON.plain, 64); }

  const W = 1080, H = 1350;
  const paper = { x: 80, y: 60, w: 920, h: 1120 };
  let y = paper.y + 96;
  const parts = [];
  parts.push(`<rect width="${W}" height="${H}" fill="#0f1a15"/>`);
  parts.push(`<rect x="0" y="${H * 0.7}" width="${W}" height="${H * 0.3}" fill="rgba(239,230,210,0.03)"/>`);
  parts.push(`<rect x="${paper.x}" y="${paper.y}" width="${paper.w}" height="${paper.h}" rx="10" fill="#f4ecd8"/>`);
  parts.push(`<rect x="${paper.x + 14}" y="${paper.y + 14}" width="${paper.w - 28}" height="${paper.h - 28}" rx="6" fill="none" stroke="#1a1a17" stroke-width="2"/>`);
  parts.push(`<text x="${paper.x + 40}" y="${paper.y + 62}" font-family="Newsreader,Georgia,serif" font-weight="600" font-size="40" fill="#1a1a17">${esc(C.BRAND.name)}</text>`);
  parts.push(`<text x="${paper.x + paper.w - 40}" y="${paper.y + 58}" text-anchor="end" font-family="'Atkinson Hyperlegible',sans-serif" font-size="16" fill="rgba(26,26,23,0.6)">${esc(C.SHARE_CARD.example)}</text>`);
  parts.push(`<text x="${paper.x + 40}" y="${y}" font-family="'Atkinson Hyperlegible',sans-serif" font-weight="700" font-size="20" letter-spacing="4" fill="rgba(26,26,23,0.6)">${esc(C.SHARE_CARD.calledIt(C.humanDate(call.created_at)))}</text>`);
  y += 46;
  parts.push(svgTextLines(callLines, paper.x + 40, y, 58, `font-family="Newsreader,Georgia,serif" font-style="italic" font-size="52" fill="#1a1a17"`));
  y += callLines.length * 58 + 44;
  parts.push(`<text x="${paper.x + 40}" y="${y}" font-family="'Atkinson Hyperlegible',sans-serif" font-weight="700" font-size="20" letter-spacing="4" fill="rgba(26,26,23,0.6)">${esc(C.SHARE_CARD.knew)}</text>`);
  y += 40;
  for (const fact of C.SHARE_CARD.knewFacts) {
    parts.push(`<circle cx="${paper.x + 48}" cy="${y - 8}" r="6" fill="#e9b949"/>`);
    parts.push(`<text x="${paper.x + 66}" y="${y}" font-family="'Atkinson Hyperlegible',sans-serif" font-size="26" fill="#1a1a17">${esc(fact)}</text>`);
    y += 40;
  }
  y += 36;
  const happen = waiting ? "WHAT HAPPENED" : C.SHARE_CARD.happened(C.humanDate(frame.outcome?.result?.observed_at ?? frame.as_of));
  parts.push(`<text x="${paper.x + 40}" y="${y}" font-family="'Atkinson Hyperlegible',sans-serif" font-weight="700" font-size="20" letter-spacing="4" fill="rgba(26,26,23,0.6)">${esc(happen)}</text>`);
  y += 60;
  const stampFill = waiting ? "#5b6b66" : (state === "resolved_miss" ? "#9e1f1a" : "#2f7d4d");
  parts.push(`<g transform="translate(${paper.x + 260}, ${y + 56}) rotate(-8)">`);
  parts.push(`<rect x="-230" y="-56" width="460" height="112" rx="8" fill="none" stroke="${stampFill}" stroke-width="5" stroke-dasharray="10 2.5"/>`);
  parts.push(`<rect x="-222" y="-48" width="444" height="96" rx="5" fill="none" stroke="${stampFill}" stroke-width="2"/>`);
  parts.push(`<text x="0" y="38" text-anchor="middle" font-family="Anton,'Atkinson Hyperlegible',sans-serif" font-size="120" fill="${stampFill}">${esc(stampWord)}</text>`);
  parts.push(`</g>`);
  resLines.forEach((l, i) => {
    parts.push(`<text x="${paper.x + 520}" y="${y + 48 + i * 40}" font-family="'Atkinson Hyperlegible',sans-serif" font-size="28" fill="#1a1a17">${esc(l)}</text>`);
  });
  if (waiting) {
    parts.push(`<text x="${paper.x + 520}" y="${y + 48}" font-family="'Atkinson Hyperlegible',sans-serif" font-size="28" fill="#1a1a17">${esc(C.CALL_CARD.waiting)}</text>`);
  }
  y += 170;
  if (waiting) {
    // pre-outcome: the card shows the test we set, never the lesson (that text is about the miss)
    parts.push(`<text x="${paper.x + 40}" y="${y}" font-family="'Atkinson Hyperlegible',sans-serif" font-weight="700" font-size="20" letter-spacing="4" fill="rgba(26,26,23,0.6)">${esc(C.SHARE_CARD.willCount)}</text>`);
    y += 38;
    const wcLines = wrapWords(C.SHARE_CARD.willCountLine(call.falsification_criteria), 62);
    parts.push(svgTextLines(wcLines, paper.x + 40, y, 34, `class="share-lesson" font-family="'Atkinson Hyperlegible',sans-serif" font-size="24" fill="#1a1a17"`));
  } else {
    parts.push(`<text x="${paper.x + 40}" y="${y}" font-family="'Atkinson Hyperlegible',sans-serif" font-weight="700" font-size="20" letter-spacing="4" fill="rgba(26,26,23,0.6)">${esc(C.SHARE_CARD.learned)}</text>`);
    y += 38;
    parts.push(svgTextLines(lessonLines, paper.x + 40, y, 34, `class="share-lesson" font-family="'Atkinson Hyperlegible',sans-serif" font-size="${lessonFont}" fill="#1a1a17"`));
  }
  // footer band on ground
  parts.push(`<text x="60" y="${H - 60}" font-family="'Atkinson Hyperlegible',sans-serif" font-weight="700" font-size="22" letter-spacing="5" fill="#efe6d2">${esc(waiting ? C.SHARE_CARD.waitingFooter : C.SHARE_CARD.footer)}</text>`);
  parts.push(`<text x="${W - 60}" y="${H - 60}" text-anchor="end" font-family="'IBM Plex Mono',monospace" font-size="16" fill="rgba(239,230,210,0.62)">${esc(fpShort(hash))}</text>`);

  return `<svg xmlns="${NS}" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><style>${css}</style>${parts.join("")}</svg>`;
}

async function renderSharePanel(body) {
  body.append(el("p", "i-kicker", C.ACTIONS.share));
  const svgText = await buildShareSVG();
  const prev = el("div", "share-preview");
  prev.innerHTML = svgText;
  body.append(prev);
  const dl = el("button", "btn-paper", C.ACTIONS.shareSaving);
  dl.type = "button";
  dl.disabled = true;
  body.append(dl);
  try {
    const blobUrl = await shareToPNG(svgText);
    const a = document.createElement("a");
    a.href = blobUrl;
    const f = getFrame(S.data, S.frameIndex);
    a.download = `memegraph-call-001-${(f?.as_of ?? "").slice(0, 10)}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 4000);
    dl.disabled = false;
    dl.textContent = C.ACTIONS.share;
    dl.addEventListener("click", () => a.click());
  } catch {
    dl.textContent = C.ACTIONS.share;
    dl.disabled = true;
  }
}

async function shareToPNG(svgText) {
  const img = new Image();
  const blob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
  const canvas = document.createElement("canvas");
  canvas.width = 1080; canvas.height = 1350;
  canvas.getContext("2d").drawImage(img, 0, 0, 1080, 1350);
  URL.revokeObjectURL(url);
  return canvas.toDataURL("image/png");
}

/* ---------- zoom ---------- */

function applyView() {
  const v = S.view;
  $("graph").setAttribute("viewBox", `${v.x} ${v.y} ${v.w} ${v.h}`);
  const zoomed = Math.abs(v.w - S.base.w) > 1 || Math.abs(v.x - S.base.x) > 1 || Math.abs(v.y - S.base.y) > 1;
  $("btn-zoom-reset").hidden = !zoomed;
}
function clampView() {
  const v = S.view, b = S.base;
  v.w = Math.min(b.w * 1.6, Math.max(b.w / 3.5, v.w));
  v.h = v.w * (b.h / b.w);
  v.x = Math.min(b.x + b.w - 100, Math.max(b.x - 200, v.x));
  v.y = Math.min(b.y + b.h - 80, Math.max(b.y - 120, v.y));
}
function svgPoint(x, y) {
  const ctm = $("graph").getScreenCTM();
  if (!ctm) return { x, y };
  return new DOMPoint(x, y).matrixTransform(ctm.inverse());
}

/* ---------- play ---------- */

function pausePlay() {
  if (S.playing) {
    clearInterval(S.playing);
    S.playing = null;
    updateRail();
  }
}
function togglePlay() {
  if (rm) {
    if (S.frameIndex >= 6) setFrame(0);
    else setFrame(S.frameIndex + 1);
    if (S.frameIndex >= 6) S.playedOnce = true;
    updateRail();
    return;
  }
  if (S.playing) { pausePlay(); return; }
  S.playing = setInterval(() => {
    if (S.frameIndex >= 6) { S.playedOnce = true; pausePlay(); return; }
    setFrame(S.frameIndex + 1);
  }, 2400);
  if (S.frameIndex >= 6) setFrame(0);
  for (const id of ["btn-play", "btn-play-hero"]) {
    const pb = $(id);
    if (pb) { pb.innerHTML = ""; pb.append(el("span", "tri", "◼"), el("span", "lbl", C.ACTIONS.pause)); }
  }
}

/* ---------- frame switching ---------- */

function setFrame(i) {
  const next = getFrame(S.data, i);
  if (!next || i === S.frameIndex) {
    if (i === S.frameIndex) updateRail();
    return;
  }
  S.lastDir = i < S.frameIndex ? "back" : "fwd";
  S.frameIndex = i;
  renderFrame();
  // inspector regression: rebuild if still visible, clear if removed
  if (S.selected && S.panelMode === "node") {
    const sel = S.selected;
    if (next.nodes.some((n) => n.id === sel)) {
      openPanel("node", sel); // rebuild - stale/status may differ in the new frame
    } else {
      closePanel();
    }
  }
  applyFocusClasses();
}

/* ---------- expert ---------- */

function applyExpert() {
  document.body.classList.toggle("expert", S.expert);
  $("btn-expert").textContent = S.expert ? C.ACTIONS.expertOff : C.ACTIONS.expertOn;
  $("btn-expert").setAttribute("aria-pressed", String(S.expert));
}

/* ---------- boot ---------- */

function fail(msg) {
  const n = el("div", "", msg);
  n.style.cssText = "position:absolute;inset:40% 12%;text-align:center;font-family:var(--sans);font-size:16px;color:var(--cream-60)";
  document.querySelector(".fieldwrap").append(n);
}

async function main() {
  let data;
  try {
    const res = await fetch("data/weave.json");
    if (!res.ok) throw new Error(String(res.status));
    data = await res.json();
    if (!data || !Array.isArray(data.frames)) throw new Error("schema");
  } catch {
    fail("The saved story did not load. Nothing is rendered rather than guessed.");
    return;
  }
  S.data = data;

  // static copy
  $("brand-word").textContent = C.BRAND.name;
  $("brand-tag").textContent = C.BRAND.tagline;
  $("badge-example").textContent = C.BRAND.exampleBadge;
  $("hero-q").textContent = C.HERO.question;
  $("hero-sub").textContent = C.HERO.sub;
  $("hero-explainer").textContent = C.HERO.explainer;
  $("hero-truth").textContent = C.HERO.truthLine;
  $("btn-expert").textContent = C.ACTIONS.expertOn;
  $("btn-receipt").textContent = C.ACTIONS.receipt;
  $("btn-share").textContent = C.ACTIONS.share;
  for (const [id, t] of [["btn-why", C.ACTIONS.why], ["btn-why-hero", C.ACTIONS.why],
    ["btn-against", C.ACTIONS.against], ["btn-against-hero", C.ACTIONS.against],
    ["btn-clearfocus", C.ACTIONS.clearFocus], ["btn-clearfocus-hero", C.ACTIONS.clearFocus],
    ["btn-receipt-hero", C.ACTIONS.receipt], ["btn-share-hero", C.ACTIONS.share]]) {
    $(id).textContent = t;
  }
  $("btn-zoom-reset").textContent = C.MISC.resetView;
  $("inspector-close").textContent = C.ACTIONS.close;
  $("inspector-close").setAttribute("aria-label", C.ACTIONS.close);

  // scrubber stops
  const stops = $("stops");
  C.CHAPTERS.forEach((ch, i) => {
    const st = el("button", "stop");
    st.type = "button";
    st.dataset.idx = String(i);
    st.style.left = `calc(${(i / 6) * 100}% )`;
    // account for thumb travel: thumb centre moves within 13px margins
    st.style.left = `calc(13px + ${(i / 6) * 100}% - ${(i / 6) * 26}px)`;
    st.append(el("span", "s-date", ch.date.replace(", 2026", "")));
    st.append(el("span", "dot"));
    st.append(el("span", "s-title", ch.title));
    st.setAttribute("aria-hidden", "true");
    st.tabIndex = -1;
    st.addEventListener("click", () => setFrame(i));
    stops.append(st);
  });

  const setViewport = () => {
    S.userZoom = false;
    S.view = null; // renderFrame derives the base view from the frame's geometry
    renderFrame();
    if (S.selected && S.panelMode === "node") openPanel("node", S.selected);
  };
  portraitMQ.addEventListener?.("change", setViewport);

  $("cutoff").addEventListener("input", (e) => { pausePlay(); if (S.focus) setFocus(S.focus); setFrame(Number(e.target.value)); });
  $("btn-play").addEventListener("click", togglePlay);
  $("btn-play-hero").addEventListener("click", togglePlay);
  for (const [id, m] of [["btn-why", "why"], ["btn-why-hero", "why"], ["btn-against", "against"], ["btn-against-hero", "against"]]) {
    $(id).addEventListener("click", () => setFocus(m));
  }
  $("btn-clearfocus").addEventListener("click", () => setFocus(S.focus));
  $("btn-clearfocus-hero").addEventListener("click", () => setFocus(S.focus));
  $("btn-receipt").addEventListener("click", () => openPanel("receipt"));
  $("btn-receipt-hero").addEventListener("click", () => openPanel("receipt"));
  $("btn-share").addEventListener("click", () => openPanel("share"));
  $("btn-share-hero").addEventListener("click", () => openPanel("share"));
  $("btn-zoom-reset").addEventListener("click", () => { S.userZoom = false; S.view = { ...S.base }; applyView(); });
  $("btn-expert").addEventListener("click", () => {
    S.expert = !S.expert;
    sessionStorage.setItem("mg2.expert", S.expert ? "1" : "0");
    applyExpert();
    renderFrame();
    if (S.expert) openPanel("expert");
    else if (S.panelMode === "expert") closePanel();
    else if (S.selected && S.panelMode === "node") openPanel("node", S.selected);
  });
  $("inspector-close").addEventListener("click", closePanel);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { closePanel(); if (S.focus) setFocus(S.focus); }
  });

  // zoom: wheel + pinch (bounded); no pan
  const g = $("graph");
  const pointers = new Map();
  g.addEventListener("wheel", (e) => {
    e.preventDefault();
    pausePlay();
    const p = svgPoint(e.clientX, e.clientY);
    const k = e.deltaY > 0 ? 1.12 : 0.89;
    const v = S.view;
    v.x = p.x - (p.x - v.x) * k;
    v.y = p.y - (p.y - v.y) * k;
    v.w *= k;
    S.userZoom = true;
    clampView();
    applyView();
  }, { passive: false });
  g.addEventListener("pointerdown", (e) => { pointers.set(e.pointerId, e); pausePlay(); });
  g.addEventListener("pointermove", (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, e);
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      if (S.pinch) {
        const k = S.pinch / (dist || 1);
        const v = S.view;
        const p = svgPoint((a.clientX + b.clientX) / 2, (a.clientY + b.clientY) / 2);
        v.x = p.x - (p.x - v.x) * k;
        v.y = p.y - (p.y - v.y) * k;
        v.w *= k;
        S.userZoom = true;
        clampView();
        applyView();
      }
      S.pinch = dist;
    }
  });
  const ptrEnd = (e) => { pointers.delete(e.pointerId); S.pinch = null; };
  g.addEventListener("pointerup", ptrEnd);
  g.addEventListener("pointercancel", ptrEnd);

  applyExpert();
  setViewport();

  // mobile bottom-sheet offset: sheet sits above the rail
  const setRailH = () => {
    document.documentElement.style.setProperty("--rail-h", `${$("rail").offsetHeight}px`);
  };
  setRailH();
  addEventListener("resize", setRailH);
  new ResizeObserver(setRailH).observe($("rail"));
  document.fonts?.ready?.then(setRailH);
}

main();
