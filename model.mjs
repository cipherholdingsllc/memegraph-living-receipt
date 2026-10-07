// MemeGraph Visual V1 - pure model layer, rebuild. Frozen data in, geometry/sets out. No DOM.
// copy.mjs is pure too (no DOM, no imports) - needed to size portrait blocks from real text.

import * as C from "./copy.mjs";

export const TRACE_RELS = ["source", "dependency", "supersedes"]; // lineage only - contradiction is opposition, not provenance

export function getFrame(data, index) {
  if (!data || !Array.isArray(data.frames)) return null;
  if (!Number.isInteger(index) || index < 0 || index >= data.frames.length) return null;
  return data.frames[index];
}

export function findNode(frame, id) {
  if (!frame || !Array.isArray(frame.nodes)) return null;
  return frame.nodes.find((n) => n.id === id) ?? null;
}

function walk(frame, id, dir) {
  const seen = new Set();
  const stack = [id];
  while (stack.length) {
    const cur = stack.pop();
    for (const e of frame.edges ?? []) {
      if (!TRACE_RELS.includes(e.rel)) continue;
      const next = dir === "up" ? (e.dst === cur ? e.src : null) : (e.src === cur ? e.dst : null);
      if (next && !seen.has(next)) {
        seen.add(next);
        stack.push(next);
      }
    }
  }
  seen.delete(id);
  return seen;
}

export function traceUpstream(frame, id) { return walk(frame, id, "up"); }
export function traceDownstream(frame, id) { return walk(frame, id, "down"); }

export function diffFrames(prev, next) {
  const p = new Set((prev?.nodes ?? []).map((n) => n.id));
  const n = new Set((next?.nodes ?? []).map((n) => n.id));
  return {
    added: [...n].filter((id) => !p.has(id)),
    removed: [...p].filter((id) => !n.has(id)),
  };
}

/* ----- families, timing, captions ----- */

export function familyOf(node) {
  const lab = node?.label ?? "";
  const m = /(p\d+)/.exec(lab);
  if (m) return m[1];
  if (/experiment/.test(lab)) return "exp";
  if (node?.kind === "recipe") return "recipe";
  if (node?.kind === "experiment") return "call";
  if (node?.kind === "outcome") return "outcome";
  if (node?.kind === "assessment") return "reservation";
  if (node?.kind === "source") return "source";
  return node?.kind ?? "misc";
}

// timing vs the frozen call: <= evidence_cutoff is before-side; > created_at is later-side.
// Date.parse, not lexicographic compare - fixture timestamps carry mixed precision.
export function timingOf(node, frame) {
  const cutoff = Date.parse(frame?.call?.evidence_cutoff ?? "2026-04-02T00:00:00Z");
  const created = Date.parse(frame?.call?.created_at ?? "2026-04-03T00:00:00Z");
  const t = Date.parse(node?.known_at ?? node?.recorded_at ?? "");
  if (!Number.isNaN(t) && t <= cutoff) return "before";
  if (!Number.isNaN(t) && t > created) return "later";
  return "at-call";
}

function hashOffset(id, range) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return (h % 1000) / 1000 * range - range / 2;
}

const D = {
  p01: { entity: [355, 185], feature: [540, 145], outcome: [540, 235] },
  p09: { entity: [355, 605], feature: [540, 560], outcome: [540, 655] },
  p04: { entity: [345, 400], feature0: [510, 320], feature1: [510, 465], outcome: [530, 395] },
  p07: { entity: [420, 715], feature: [575, 710], outcome: [1040, 610] },
  exp: { entity: [700, 665] },
  call: { call: [850, 390] },
  outcome: { outcome: [1160, 405] },
  reservation: { reservation: [1110, 105] },
};
const M = {
  p01: { entity: [120, 130], feature: [245, 115], outcome: [245, 180] },
  p09: { entity: [120, 335], feature: [245, 325], outcome: [245, 390] },
  p04: { entity: [120, 235], feature0: [245, 215], feature1: [245, 285], outcome: [255, 340] },
  p07: { entity: [130, 430], feature: [250, 420], outcome: [320, 745] },
  exp: { entity: [90, 700] },
  call: { call: [210, 545] },
  outcome: { outcome: [210, 880] },
  reservation: { reservation: [350, 105] },
};

export function projectionLayout(frame, opts = {}) {
  const A = opts.portrait ? M : D;
  const W = opts.portrait ? { sw: 420, sh: 1240 } : { sw: 1400, sh: 850 };
  const pos = new Map();
  if (!frame) return pos;
  const nodes = frame.nodes ?? [];
  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  const sources = nodes.filter((n) => n.kind === "source").sort((a, b) => a.id.localeCompare(b.id));
  const lateSrcs = sources.filter((s) => timingOf(s, frame) === "later");
  const earlySrcs = sources.filter((s) => timingOf(s, frame) !== "later");

  earlySrcs.forEach((s, i) => {
    const y = (opts.portrait ? 70 : 90) + i * ((opts.portrait ? 330 : 700) / Math.max(1, earlySrcs.length - 1 || 1));
    pos.set(s.id, { x: (opts.portrait ? 52 : 165) + hashOffset(s.id, opts.portrait ? 20 : 55), y });
  });
  lateSrcs.forEach((s, i) => {
    pos.set(s.id, { x: (opts.portrait ? 350 : 1290) + hashOffset(s.id, opts.portrait ? 12 : 30), y: (opts.portrait ? 620 : 300) + i * (opts.portrait ? 120 : 140) });
  });

  // p04 feature pair must be separated; order by known_at
  const p04feats = nodes
    .filter((n) => n.kind === "observation" && /p04/.test(n.label ?? "") && /feature/.test(n.label ?? ""))
    .sort((a, b) => (a.known_at ?? "").localeCompare(b.known_at ?? ""));

  let p04i = 0;
  for (const n of nodes) {
    if (pos.has(n.id)) continue;
    const fam = familyOf(n);
    const lab = n.label ?? "";
    if (n.kind === "entity") {
      const a = fam === "exp" ? A.exp.entity : A[fam]?.entity;
      pos.set(n.id, a ? { x: a[0], y: a[1] } : { x: W.sw * 0.25, y: W.sh * 0.45 });
    } else if (n.kind === "observation") {
      let slot;
      if (fam === "p04" && /feature/.test(lab)) {
        const a = p04i === 0 ? A.p04.feature0 : A.p04.feature1;
        pos.set(n.id, { x: a[0] + hashOffset(n.id, 10), y: a[1] + hashOffset(n.id, 8) });
        p04i++;
        continue;
      }
      slot = /outcome/.test(lab) ? "outcome" : "feature";
      const a = A[fam]?.[slot] ?? [W.sw * 0.38, W.sh * 0.45];
      pos.set(n.id, { x: a[0] + hashOffset(n.id, 16), y: a[1] + hashOffset(n.id, 10) });
    } else if (n.kind === "recipe") {
      pos.set(n.id, /v1/.test(lab) ? (opts.portrait ? { x: 210, y: 470 } : { x: 660, y: 295 }) : (opts.portrait ? { x: 210, y: 700 } : { x: 660, y: 515 }));
    } else if (n.kind === "experiment") {
      pos.set(n.id, { x: A.call.call[0], y: A.call.call[1] });
    } else if (n.kind === "outcome") {
      pos.set(n.id, { x: A.outcome.outcome[0], y: A.outcome.outcome[1] });
    } else if (n.kind === "assessment") {
      pos.set(n.id, { x: A.reservation.reservation[0], y: A.reservation.reservation[1] });
    } else {
      pos.set(n.id, { x: W.sw / 2 + hashOffset(n.id, 200), y: 100 + hashOffset(n.id, 80) });
    }
  }
  return pos;
}

/* ----- captions ----- */

const STAGE = [
  "Initial evidence on record",
  "A contradiction enters the record",
  "A candidate recipe is named",
  "The call is frozen",
  "A later failure lands",
  "The recipe is rejected",
  "The miss is preserved",
];
export function stageCaption(i) { return STAGE[i] ?? ""; }

const ROLE_WORD = {
  positive_comparable: "positive comparable",
  negative_comparable: "negative comparable",
  reserved_comparable: "reserved comparable",
};
export function roleDeclares(frame) {
  return Boolean(frame?.recipe || frame?.call);
}

export function captionOf(node, frame) {
  const lab = node.label ?? "";
  if (node.kind === "source") return "Source " + node.id.slice(7, 13);
  if (node.kind === "entity") return node.payload?.label ?? lab;
  if (node.kind === "observation") {
    const ent = (frame?.nodes ?? []).find((x) => x.kind === "entity" && x.label === ("project:" + (lab.match(/p\d+/)?.[0] ?? "")));
    const name = (ent?.payload?.label ?? lab.split("/")[0].trim()).replace(/\s*\(synthetic\)\s*/i, "");
    let bit = /outcome/.test(lab) ? "outcome" : "feature";
    if (/p04/.test(lab) && /feature/.test(lab)) {
      const explicit = node.payload?.value?.explicit_fiction;
      bit = explicit === true ? "fiction disclosed" : explicit === false ? "fiction not disclosed" : "fiction status unknown";
    }
    const role = roleDeclares(frame) && ROLE_WORD[node.role] ? " · " + ROLE_WORD[node.role] : "";
    return `${name} · ${bit}${role}`;
  }
  if (node.kind === "recipe") return lab + (node.stale ? " · retired" : "");
  if (node.kind === "experiment") return "The frozen call";
  if (node.kind === "outcome") return node.status === "resolved_miss" ? "MISS" : "Outcome";
  if (node.kind === "assessment") return "Fixture reservation";
  return lab || node.id.slice(0, 20);
}

/* ----- inspector + receipt ----- */

export function nodeInspector(node, frame) {
  if (!node) return null;
  const ids = new Set((frame?.nodes ?? []).map((n) => n.id));
  const contradictions = (frame?.edges ?? []).filter(
    (e) => e.rel === "contradicts" && (e.src === node.id || e.dst === node.id)
  );
  return {
    id: node.id,
    kind: node.kind,
    role: node.role ?? null,
    status: node.status ?? null,
    label: captionOf(node, frame),
    raw_label: node.label ?? null,
    observed_at: node.observed_at ?? null,
    available_at: node.available_at ?? null,
    recorded_at: node.recorded_at ?? null,
    known_at: node.known_at ?? null,
    captured_at: node.kind === "source" ? node.payload?.captured_at ?? null : null,
    uri: node.kind === "source" ? node.payload?.uri ?? null : null,
    sha256: node.kind === "source" ? node.payload?.sha256 ?? null : null,
    raw_omitted: node.raw_omitted === true,
    projection_note: node.projection_note ?? null,
    stale: node.stale === true,
    stale_reason: node.stale_reason ?? null,
    synthetic: node.synthetic === true,
    known_at_cutoff: !Number.isNaN(Date.parse(node.known_at ?? "")) && Date.parse(node.known_at) <= Date.parse(frame?.as_of ?? ""),
    omitted_value_fields: node.omitted_value_fields ?? [],
    assertion: node.payload?.assertion_kind ?? null,
    confidence_class: node.payload?.confidence_class ?? null,
    confidence_basis: node.payload?.confidence_basis ?? null,
    edge_debt: node.payload?.edge_debt ?? null,
    source_ids: (node.source_ids ?? []).map((id) => ({ id, in_frame: ids.has(id) })),
    parent_ids: (node.parent_ids ?? []).map((id) => ({ id, in_frame: ids.has(id) })),
    supersedes: node.supersedes ?? [],
    contradicts: contradictions.map((e) => ({ id: e.id, with: e.src === node.id ? e.dst : e.src, basis: e.basis ?? null })),
    obligations: node.obligations ?? null,
    payload: node.payload ?? {},
  };
}

export function exportReceipt(data, index) {
  const frame = getFrame(data, index);
  if (!frame) return null;
  const sources = (frame.nodes ?? [])
    .filter((n) => n.kind === "source")
    .map((s) => ({
      id: s.id,
      sha256: s.payload?.sha256 ?? null,
      captured_at: s.payload?.captured_at ?? null,
      uri: s.payload?.uri ?? null,
      observed_at: s.observed_at ?? null,
      available_at: s.available_at ?? null,
      recorded_at: s.recorded_at ?? null,
      raw_omitted: s.raw_omitted === true,
    }));
  return {
    schema: "memegraph.weave-receipt.v1",
    synthetic: data.synthetic === true,
    cutoff: frame.as_of,
    frame_index: index,
    stage: stageCaption(index),
    snapshot_digest: frame.snapshot_digest ?? null,
    projection_is_partial: frame.projection_is_partial === true,
    omitted_financial_references: frame.omitted_financial_references ?? 0,
    nodes: (frame.nodes ?? []).map((n) => ({ id: n.id, kind: n.kind, role: n.role ?? null, status: n.status ?? null })),
    edges: (frame.edges ?? []).map((e) => ({ id: e.id, rel: e.rel, src: e.src, dst: e.dst })),
    sources,
    call: frame.call
      ? {
          id: frame.call.id,
          prediction_hash: frame.call.prediction_hash,
          created_at: frame.call.created_at,
          evidence_cutoff: frame.call.evidence_cutoff,
          falsification_criteria: frame.call.falsification_criteria ?? null,
        }
      : null,
    outcome: frame.outcome
      ? {
          id: frame.outcome.id,
          outcome_status: frame.outcome.outcome_status,
          observed_metrics: frame.outcome.delta?.observed_metrics ?? null,
          shortfalls: frame.outcome.delta?.shortfalls ?? null,
          lesson: frame.outcome.lesson ?? null,
        }
      : null,
    unknowns: frame.unknowns ?? [],
    note: "Local receipt of a synthetic fixture frame. Hashes check byte consistency with stored records; they do not prove history was unedited, sources were true, or predictions were good.",
  };
}

/* ---------------------------------------------------------------------------
 * The Living Receipt - story layout.
 * Pure geometry: every native node gets a position; lanes are derived from
 * roles (positive comparables first, then negative, then reserved, then the
 * thinking lane). Columns are date-keyed and event-spaced per ART_DIRECTION.
 * Nothing here invents records; unknowns/WAITING stay annotations, not nodes.
 * -------------------------------------------------------------------------*/

// Desktop column x per calendar day (1400 x 620 world). Days absent from the
// table fall back to a linear interpolation between the bracketing columns so
// an unexpected record still lands in the right place on the time axis.
const STORY_COLUMNS = [
  ["2026-01-01", 120],
  ["2026-01-02", 240],
  ["2026-01-03", 360],
  ["2026-04-01", 560],
  ["2026-04-02", 660],
  ["2026-04-03", 790], // SEAL
  ["2026-04-10", 960],
  ["2026-04-11", 1070],
  ["2026-05-03", 1270],
];

export const STORY_GEO = {
  landscape: {
    w: 1400, h: 620,
    sealX: 790, sealTop: 48, sealBottom: 600,
    card: { x: 790, y: 300, w: 270, h: 172 },
    stamp: { x: 1270, y: 300 },
    waiting: { x: 1010, y: 300 },
    unknowns: { x: 1010, y: 76, w: 360, h: 96 },
    gapX: 450,
    laneBase: 120, laneStep: 80, forkDy: 55, thinkingY: 520,
    srcRowY: 585,
  },
  portrait: { w: 420, left: 64, right: 404, mid: 234, gutterX: 12, nameX: 118, entityX: 104 },
};

// Portrait project-block dot columns: entity=Jan 1, feature=Jan 2, outcome=Apr 1,
// interpolated between anchors so e.g. the Jan 3 claim sits just past col 2.
const PCOLS = [["2026-01-01", 104], ["2026-01-02", 300], ["2026-04-01", 372]];
const PCOL_TS = PCOLS.map(([d]) => Date.parse(d + "T00:00:00Z"));

const PCOL_IDX = new Map(PCOLS.map(([d, x]) => [d, x]));

export function portraitColX(day) {
  const hit = PCOL_IDX.get(day);
  if (hit != null) return hit;
  const t = Date.parse((day ?? "") + "T00:00:00Z");
  if (Number.isNaN(t)) return PCOLS[0][1];
  if (t <= PCOL_TS[0]) return PCOLS[0][1];
  if (t >= PCOL_TS[PCOL_TS.length - 1]) return PCOLS[PCOLS.length - 1][1];
  for (let i = 0; i < PCOL_TS.length - 1; i++) {
    if (t > PCOL_TS[i] && t < PCOL_TS[i + 1]) {
      const k = (t - PCOL_TS[i]) / (PCOL_TS[i + 1] - PCOL_TS[i]);
      return Math.round(PCOLS[i][1] + (PCOLS[i + 1][1] - PCOLS[i][1]) * k);
    }
  }
  return PCOLS[PCOLS.length - 1][1];
}

const dayOf = (iso) => (iso ? String(iso).slice(0, 10) : null);

// Parse-time ordered index of the column table.
const COL_IDX = new Map(STORY_COLUMNS.map(([d, x], i) => [d, { i, x }]));
const COL_TS = STORY_COLUMNS.map(([d]) => Date.parse(d + "T00:00:00Z"));

export function storyColumnX(day) {
  const hit = COL_IDX.get(day);
  if (hit) return hit.x;
  const t = Date.parse((day ?? "") + "T00:00:00Z");
  if (Number.isNaN(t)) return STORY_COLUMNS[0][1];
  for (let i = 0; i < COL_TS.length - 1; i++) {
    if (t > COL_TS[i] && t < COL_TS[i + 1]) {
      const k = (t - COL_TS[i]) / (COL_TS[i + 1] - COL_TS[i]);
      return Math.round(STORY_COLUMNS[i][1] + (STORY_COLUMNS[i + 1][1] - STORY_COLUMNS[i][1]) * k);
    }
  }
  return t <= COL_TS[0] ? STORY_COLUMNS[0][1] : STORY_COLUMNS[STORY_COLUMNS.length - 1][1];
}

// Lane order is derived, never hardcoded per project: positive comparables
// first (by entity id), then negative, then the reserved project, then
// "Our thinking" which is not a project at all.
export function storyLanes(frame) {
  const ents = (frame?.nodes ?? []).filter((n) => n.kind === "entity" && /^project:/.test(n.label ?? ""));
  const byRole = (role) =>
    ents.filter((n) => n.role === role).sort((a, b) => (a.label < b.label ? -1 : 1));
  return [...byRole("positive_comparable"), ...byRole("negative_comparable"), ...byRole("reserved_comparable")]
    .map((n) => /(p\d+)/.exec(n.label)?.[1] ?? null);
}

// Landscape lane y for lane index i: base + i*step, with the reserved lane
// pushed an extra half-step down so Halcyon's dispute fork has room.
function laneYOf(laneIdx, g) {
  const base = g.laneBase + laneIdx * g.laneStep;
  return laneIdx >= 3 ? base + 40 : base;
}

// A Halcyon feature observation that argues against the record drops to the
// dispute fork below its lane; the one that fit stays on the lane.
function isForkedObservation(node) {
  return node.kind === "observation"
    && node.role === "negative_comparable"
    && node.status === "conflict"
    && node.payload?.value?.explicit_fiction === false;
}

// Same wrap rule as the app's wrapWords, kept local so the layout can derive
// block heights from real copy without a DOM.
function wrapAt(s, width) {
  const words = String(s ?? "").split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > width && cur.trim()) { lines.push(cur.trim()); cur = w; }
    else cur += " " + w;
  }
  if (cur.trim()) lines.push(cur.trim());
  return lines.length ? lines : [""];
}

/* Portrait field: strict vertical time in a 420-wide world. A 64px left
   gutter carries only date labels; every block spans x 64..404 and gets a
   height derived from its real content, with >= 18px between blocks.
   Blocks: project rows -> reservation -> theory v1 -> seal + card ->
   Glass outcome -> theory v2 -> unknowns -> stamp / WAITING. */
export function portraitGeometry(frame, opts = {}) {
  const P = STORY_GEO.portrait;
  const L = P.left, R = P.right, MID = P.mid;
  const nodes = frame?.nodes ?? [];
  const lanes = storyLanes(frame);
  const geo = {
    w: P.w, left: L, right: R, mid: MID, gutterX: P.gutterX,
    entityX: P.entityX, nameX: P.nameX,
    gutter: [], rows: new Map(), colHeaderY: null,
    card: null, stamp: null, waiting: null, unknowns: null,
    claim: null, glassOut: null, srcRowY: 0, h: 500,
  };
  const lab = (n) => n.label ?? "";
  let y = 24;

  // a) project block: column headers, one row per project lane, Halcyon claim sub-row
  const claim = nodes.find((n) => isForkedObservation(n));
  const projRows = lanes.filter((pid) => nodes.some((n) => familyOf(n) === pid));
  if (projRows.length) {
    // no gutter date here — the column headers carry Jan 1 / Jan 2 / Apr 1
    geo.colHeaderY = y + 22;
    let ry = y + 62;
    for (const pid of projRows) {
      geo.rows.set(pid, ry);
      if (claim && familyOf(claim) === pid) {
        // sub-row directly under the disputed lane's row: diamond, then the
        // caption wrapped to the full block width beneath it. The 58px drop
        // keeps the diamond's hit pad clear of the feature dot's pad above.
        const capN = wrapAt(copyHuman(claim, frame), 44).length;
        geo.claim = { x: portraitColX("2026-01-03"), y: ry + 58, capX: L, capY: ry + 88, capLines: capN };
        ry += 58 + 30 + capN * 22 + 8;
      }
      ry += 56;
    }
    y = ry - 56 + 34;
  }

  // b) reservation chip, "Our thinking" label on its own line above it
  const reserv = nodes.find((n) => n.kind === "assessment");
  if (reserv) {
    const chipH = 20 + wrapAt(copyShort(reserv, frame), 34).length * 17;
    geo.gutter.push({ day: "2026-01-01", y: y + 16 });
    geo.thinkingLabelY = y + 20;
    geo.reservation = { x: MID, y: geo.thinkingLabelY + chipH / 2 + 16 };
    y = geo.reservation.y + chipH / 2 + 18;
  }

  // c) theory v1 chip
  const v1 = nodes.find((n) => n.kind === "recipe" && /v1/.test(lab(n)));
  if (v1) {
    const chipH = 22 + wrapAt(copyShort(v1, frame), 34).length * 17;
    geo.gutter.push({ day: "2026-04-02", y: y + 16 });
    geo.recipe1 = { x: MID, y: y + chipH / 2 + 16 };
    y = geo.recipe1.y + chipH / 2 + 18;
  }

  // d) seal line + full-width call card; height derived from wrapped text
  const call = nodes.find((n) => n.kind === "experiment");
  if (call) {
    const humanN = wrapAt(copyCallHuman(), 36).length;
    const cardH = 150 + humanN * 22;
    geo.gutter.push({ day: "2026-04-03", y: y + 16 });
    geo.sealY = y + 34;
    geo.card = { x: MID, y: geo.sealY + 22 + cardH / 2, w: 340, h: cardH };
    y = geo.card.y + cardH / 2 + 22;
  }

  // e) Glass counterexample outcome
  const gout = nodes.find((n) => n.kind === "observation" && /p07/.test(lab(n)) && /outcome/.test(lab(n)));
  if (gout) {
    const capN = wrapAt(copyHuman(gout, frame), 44).length;
    geo.gutter.push({ day: "2026-04-10", y: y + 16 });
    geo.glassOut = { x: MID, y: y + 42, capY: y + 42 + 30, capLines: capN };
    y = geo.glassOut.y + 30 + capN * 22 + 18;
  }

  // f) theory v2 chip
  const v2 = nodes.find((n) => n.kind === "recipe" && /v2/.test(lab(n)));
  if (v2) {
    const chipH = 22 + wrapAt(copyShort(v2, frame), 34).length * 17;
    geo.gutter.push({ day: "2026-04-11", y: y + 16 });
    geo.recipe2 = { x: MID, y: y + chipH / 2 + 16 };
    y = geo.recipe2.y + chipH / 2 + 18;
  }

  // g) unknowns box, full width, title + lines all inside
  const unkList = opts.expert ? (frame?.unknowns ?? []) : copyUnknowns(frame);
  if (unkList.length) {
    // widths must match drawUnknowns' portrait wrap so the derived height fits
    const titleN = wrapAt(copyUnknownsTitle(), 26).length;
    const lineN = unkList.reduce((a, l) => a + wrapAt(l, 30).length, 0);
    const h = 26 + titleN * 26 + lineN * 22;
    geo.unknowns = { x: L, y, w: R - L, h, titleLines: titleN };
    y += h + 22;
  }

  // h) stamp + result lines, or the WAITING outline
  const hasOutcome = nodes.some((n) => n.kind === "outcome");
  const isWaiting = copyResultState(frame) === "unresolved";
  if (hasOutcome || isWaiting) {
    geo.gutter.push({ day: "2026-05-03", y: y + 16 });
    const cy = y + 58;
    geo.stamp = { x: MID, y: cy };
    geo.waiting = { x: MID, y: cy };
    y = cy + 45 + (hasOutcome ? 4 * 24 : 30) + 26;
  }

  geo.srcRowY = y + 10;
  geo.h = y + 56;
  return geo;
}

// Copy lookups routed through one place so model.mjs stays DOM-free but can
// still size blocks from real text.
const copyHuman = (n, f) => C.humanCaption(n, f);
const copyShort = (n, f) => C.shortCaption(n, f);
const copyCallHuman = () => C.CALL_CARD.human;
const copyUnknowns = (f) => C.unknownsHuman(f);
const copyUnknownsTitle = () => C.UNKNOWNS.title;
const copyResultState = (f) => C.resultState(f);

export function storyLayout(frame, opts = {}) {
  const pos = new Map();
  if (!frame) return pos;
  const nodes = frame.nodes ?? [];
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const g = opts.portrait ? STORY_GEO.portrait : STORY_GEO.landscape;
  const lanes = storyLanes(frame);
  const laneIdx = new Map(lanes.map((pid, i) => [pid, i]));
  const nodeDay = (n) => dayOf(n.known_at ?? n.recorded_at ?? n.observed_at);

  if (!opts.portrait) {
    // ---- landscape: time on x, lanes on y ----
    for (const n of nodes) {
      const lab = n.label ?? "";
      const fam = familyOf(n);
      const li = laneIdx.get(fam);
      const day = nodeDay(n);
      const x = storyColumnX(day);
      if (n.kind === "source") continue; // anchored after everything else
      if (n.kind === "entity") {
        if (/experiment/.test(lab)) {
          // "Call #001" strip lives on the fingerprint baseline, bottom-right inside the card
          pos.set(n.id, { x: g.card.x + g.card.w / 2 - 18, y: g.card.y + g.card.h / 2 - 16 });
        } else {
          pos.set(n.id, { x: storyColumnX(day ?? "2026-01-01"), y: li != null ? laneYOf(li, g) : 120 });
        }
      } else if (n.kind === "observation") {
        const laneY = li != null ? laneYOf(li, g) : 280;
        pos.set(n.id, { x, y: isForkedObservation(n) ? laneY + g.forkDy : laneY });
      } else if (n.kind === "assessment") {
        pos.set(n.id, { x: 150, y: g.thinkingY });
      } else if (n.kind === "recipe") {
        pos.set(n.id, { x, y: g.thinkingY });
      } else if (n.kind === "experiment") {
        pos.set(n.id, { x: g.card.x, y: g.card.y });
      } else if (n.kind === "outcome") {
        pos.set(n.id, { x: g.stamp.x, y: g.stamp.y });
      } else {
        pos.set(n.id, { x, y: g.thinkingY });
      }
    }
    // sources: 12px below-right of the first node that references them via a
    // native source edge; unreferenced ones sit at the bottom of their column.
    const anchored = new Set();
    const firstRef = new Map();
    for (const e of frame.edges ?? []) {
      if (e.rel !== "source") continue;
      if (!firstRef.has(e.src)) firstRef.set(e.src, e.dst);
    }
    const colCount = new Map();
    for (const n of nodes) {
      if (n.kind !== "source") continue;
      const dst = firstRef.get(n.id);
      const dp = dst ? pos.get(dst) : null;
      if (dp) {
        anchored.add(n.id);
        pos.set(n.id, { x: dp.x + 16, y: dp.y + 16 });
      } else {
        const day = nodeDay(n);
        const cx = storyColumnX(day);
        const k = colCount.get(day) ?? 0;
        colCount.set(day, k + 1);
        pos.set(n.id, { x: cx - 24 + (k % 5) * 14, y: g.srcRowY + Math.floor(k / 5) * 10 });
      }
    }
  } else {
    // ---- portrait: strict vertical time, block layout from portraitGeometry ----
    const geo = portraitGeometry(frame, opts);
    const P = STORY_GEO.portrait;
    for (const n of nodes) {
      const lab = n.label ?? "";
      const fam = familyOf(n);
      if (n.kind === "source") continue;
      if (n.kind === "entity") {
        if (/experiment/.test(lab)) {
          // "Call #001" bottom-right inside the card, on its own row — the
          // 340px card can't fit it on the fingerprint baseline
          pos.set(n.id, { x: geo.card.x + geo.card.w / 2 - 18, y: geo.card.y + geo.card.h / 2 - 38 });
        } else {
          pos.set(n.id, { x: P.entityX, y: geo.rows.get(fam) ?? 78 });
        }
      } else if (n.kind === "observation") {
        if (/outcome/.test(lab) && fam === "p07") {
          pos.set(n.id, { x: geo.glassOut.x, y: geo.glassOut.y });
        } else if (isForkedObservation(n)) {
          pos.set(n.id, { x: geo.claim.x, y: geo.claim.y });
        } else {
          pos.set(n.id, { x: portraitColX(nodeDay(n)), y: geo.rows.get(fam) ?? 78 });
        }
      } else if (n.kind === "assessment") {
        pos.set(n.id, { ...geo.reservation });
      } else if (n.kind === "recipe") {
        pos.set(n.id, /v1/.test(lab) ? { ...geo.recipe1 } : { ...geo.recipe2 });
      } else if (n.kind === "experiment") {
        pos.set(n.id, { x: geo.card.x, y: geo.card.y });
      } else if (n.kind === "outcome") {
        pos.set(n.id, { x: geo.stamp.x, y: geo.stamp.y });
      } else {
        pos.set(n.id, { x: P.mid, y: 520 });
      }
    }
    const firstRef = new Map();
    for (const e of frame.edges ?? []) {
      if (e.rel !== "source") continue;
      if (!firstRef.has(e.src)) firstRef.set(e.src, e.dst);
    }
    const rowCount = new Map();
    const dstCount = new Map();
    // nodes whose captions stay visible on portrait carry their source stubs
    // below the caption block instead of inside it
    const captionedDst = (dn) => dn && dn.kind === "observation" &&
      (isForkedObservation(dn) || (/p07/.test(dn.label ?? "") && /outcome/.test(dn.label ?? "")));
    for (const n of nodes) {
      if (n.kind !== "source") continue;
      const dst = firstRef.get(n.id);
      const dp = dst ? pos.get(dst) : null;
      // +40 keeps the stub's hit pad clear of the record's 52px pad — nested
      // pads made touch disambiguation open the source instead of the record
      if (dp) {
        const k = dstCount.get(dst) ?? 0;
        dstCount.set(dst, k + 1);
        const dn = byId.get(dst);
        const yOff = captionedDst(dn)
          ? 34 + wrapAt(copyHuman(dn, frame), 44).length * 22
          : 16;
        pos.set(n.id, { x: Math.min(388, dp.x + 40), y: dp.y + yOff + k * 18 });
      } else {
        const day = nodeDay(n);
        const k = rowCount.get(day) ?? 0;
        rowCount.set(day, k + 1);
        pos.set(n.id, { x: 76 + (k % 12) * 26, y: geo.srcRowY });
      }
    }
  }
  return pos;
}
