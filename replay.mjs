// MemeGraph — Instant Replay event engine (pure; no DOM).
// Turns the frozen weave into an ordered event tape. Every event derives from
// a native node, a native contradiction edge, or a deterministic 14-day
// chapter boundary — nothing is invented.
//
// Kinds (spec §2):
//   source -> "watcher-report"      assessment -> "no-peek-set"
//   recipe v1 -> "theory-formed"    recipe v2+ -> "theory-replaced"
//   experiment -> "call-locked"     outcome -> "reality"
//   observation stance for -> "signal-fit" / against -> "signal-against"
//   entity positive -> "signal-fit" / negative -> "signal-against"
//   entity reserved -> "unknown-noted" (the test case we promised not to know)
//   entity context (the call's own label) -> "call-locked"
//   contradiction edge -> "contradiction" (t = later endpoint's t)
//   14-day boundary -> "chapter-closed"
//
// Deltas are sized so the running tallies at the last event equal the frame-6
// stance counts: every stance-for node contributes fit+1 exactly once
// (7 observations + theory v1), every stance-against node against+1
// (2 observations + theory v2 + the outcome). The contradiction edge adds
// nothing — its endpoints already carry the count. The call-locked event
// carries unknown:+N where N is that frame's recorded unknowns — locking is
// when "what we couldn't know" was written down. Context entities and
// chapter/watcher events contribute zero.

import * as C from "./copy.mjs";

const DAY_MS = 86400000;

// node time = "known to us" — the same field model.mjs uses (known_at first).
export function eventTime(n) {
  const t = Date.parse(n?.known_at ?? n?.recorded_at ?? n?.observed_at ?? "");
  return Number.isNaN(t) ? null : t;
}

// first frame whose as_of >= t; nodes absent from every frame fall to the last.
function frameIndexAt(weave, t) {
  const frames = weave?.frames ?? [];
  for (let i = 0; i < frames.length; i++) {
    if (Date.parse(frames[i].as_of) >= t) return i;
  }
  return Math.max(0, frames.length - 1);
}

function kindFor(node, frame) {
  switch (node.kind) {
    case "source": return "watcher-report";
    case "assessment": return "no-peek-set";
    case "recipe": return /v1/.test(node.label ?? "") ? "theory-formed" : "theory-replaced";
    case "experiment": return "call-locked";
    case "outcome": return "reality";
    case "observation": return C.stanceOf(node, frame) === "against" ? "signal-against" : "signal-fit";
    case "entity": {
      if (node.role === "reserved_comparable") return "unknown-noted";
      if (node.role === "positive_comparable") return "signal-fit";
      if (node.role === "negative_comparable") return "signal-against";
      return "call-locked"; // experiment:001 — the call's own label record
    }
    default: return "unknown-noted";
  }
}

const KIND_STANCE = {
  "signal-fit": "for",
  "signal-against": "against",
  "unknown-noted": "unknown",
  contradiction: "against",
  "theory-formed": "for",
  "theory-replaced": "against",
  "call-locked": "paper",
  reality: "against", // overridden from the outcome's stance below
  "watcher-report": "neutral",
  "no-peek-set": "neutral",
  "chapter-closed": "neutral",
};

function deltaFor(node, kind, frame) {
  const d = { fit: 0, against: 0, unknown: 0 };
  if (kind === "signal-fit" && node.kind === "observation") d.fit = 1;
  else if (kind === "signal-against" && node.kind === "observation") d.against = 1;
  else if (kind === "theory-formed") d.fit = 1;       // v1 counts once: it is stance "for"
  else if (kind === "theory-replaced") d.against = 1; // v2 rejected = argued against
  else if (kind === "reality") d[C.stanceOf(node, frame) === "for" ? "fit" : "against"] = 1;
  else if (kind === "call-locked" && node.kind === "experiment") {
    d.unknown = (frame?.unknowns ?? []).length; // the call's known_unknowns were written at the lock
  }
  return d;
}

// Display order inside one timestamp: context first, then watcher reports,
// evidence, reservations, theories, the lock, contradictions, reality,
// chapter closes last. Deterministic and narrative-sane.
const KIND_ORDER = [
  "signal-fit", "signal-against", "unknown-noted", "watcher-report",
  "no-peek-set", "theory-formed", "call-locked", "contradiction",
  "theory-replaced", "reality", "chapter-closed",
];
const rank = (k) => KIND_ORDER.indexOf(k);

export function eventsFromWeave(weave) {
  const frames = weave?.frames ?? [];
  if (!frames.length) return [];
  const last = frames[frames.length - 1];

  // union of nodes across frames; first frame containing each node
  const firstFrame = new Map();
  const nodeById = new Map();
  frames.forEach((f, i) => {
    for (const n of f.nodes ?? []) {
      if (!firstFrame.has(n.id)) firstFrame.set(n.id, i);
      nodeById.set(n.id, n);
    }
  });

  const events = [];
  for (const [id, n] of nodeById) {
    const t = eventTime(n) ?? Date.parse(frames[firstFrame.get(id)].as_of);
    const frameIndex = firstFrame.get(id);
    const frame = frames[frameIndex];
    const kind = kindFor(n, frame);
    events.push({
      id: `ev:${id}`,
      t,
      kind,
      nodeId: id,
      edgeId: null,
      title: C.humanCaption(n, frame) || n.label || id,
      oneLiner: C.humanExplain(n, frame),
      delta: deltaFor(n, kind, frame),
      frameIndex,
      stance: kind === "reality" ? C.stanceOf(n, frame) : KIND_STANCE[kind],
      chapter: null,
    });
  }

  // one event per native contradiction edge; t = later endpoint's t
  const contraSeen = new Set();
  for (const f of frames) {
    for (const e of f.edges ?? []) {
      if (e.rel !== "contradicts" || contraSeen.has(e.id)) continue;
      contraSeen.add(e.id);
      const a = nodeById.get(e.src), b = nodeById.get(e.dst);
      const ta = eventTime(a) ?? 0, tb = eventTime(b) ?? 0;
      const later = tb >= ta ? b : a;
      const t = Math.max(ta, tb);
      const frame = frames[frameIndexAt(weave, t)];
      events.push({
        id: `ev:${e.id}`,
        t,
        kind: "contradiction",
        nodeId: later?.id ?? null,
        edgeId: e.id,
        title: later ? (C.humanCaption(later, frame) || later.label || e.id) : e.id,
        oneLiner: later ? C.humanExplain(later, frame) : "",
        delta: { fit: 0, against: 0, unknown: 0 }, // endpoints already carry the count
        frameIndex: frameIndexAt(weave, t),
        stance: "against",
        chapter: null,
      });
    }
  }

  // chapter boundaries: every 14 days from the first event's day to the last as_of
  const t0 = Math.min(...events.map((e) => e.t));
  const tEnd = Date.parse(last.as_of);
  for (let k = 1; t0 + k * DAY_MS * 14 <= tEnd; k++) {
    const t = t0 + k * 14 * DAY_MS;
    events.push({
      id: `ev:chapter:${k}`,
      t,
      kind: "chapter-closed",
      nodeId: null,
      edgeId: null,
      title: `Chapter ${k}`,
      oneLiner: C.EPOCH.sub,
      delta: { fit: 0, against: 0, unknown: 0 },
      frameIndex: frameIndexAt(weave, t),
      stance: "neutral",
      chapter: k,
    });
  }

  events.sort((a, b) => a.t - b.t || rank(a.kind) - rank(b.kind) || a.id.localeCompare(b.id));
  events.forEach((e, i) => { e.index = i; });
  return events;
}

// Running state after event i (i = -1 => empty). Tallies are sums of deltas;
// nodes/edges are the visible unions; theory tracks the latest recipe event;
// locked after call-locked; result set when reality lands.
export function stateAt(events, i) {
  const s = {
    fit: 0, against: 0, unknown: 0, theory: null, locked: false, result: null,
    nodes: new Set(), edges: new Set(), event: null, chapter: 0,
  };
  for (let k = 0; k <= i && k < events.length; k++) {
    const e = events[k];
    s.fit += e.delta.fit;
    s.against += e.delta.against;
    s.unknown += e.delta.unknown;
    if (e.nodeId) s.nodes.add(e.nodeId);
    if (e.edgeId) s.edges.add(e.edgeId);
    if (e.kind === "theory-formed" || e.kind === "theory-replaced") s.theory = e.nodeId;
    if (e.kind === "call-locked") s.locked = true;
    if (e.kind === "reality") s.result = e.stance === "for" ? "resolved_hit" : "resolved_miss";
    s.event = e;
  }
  if (s.event && events.length) {
    s.chapter = Math.floor((s.event.t - events[0].t) / (14 * DAY_MS)) + 1;
  }
  return s;
}

// The event cursor lands on this many ms into the replay timeline per step
// (900ms per event at 1x) — used for the deck's elapsed counter, not a clock.
export function replayElapsed(cursor) {
  const s = Math.round((Math.max(0, cursor) + 1) * 0.9);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

// Booth clock day = elapsed days since the first event's day (Apr 3 -> DAY 092).
export function boothDay(events, t) {
  if (!events.length) return 0;
  return Math.floor((t - events[0].t) / DAY_MS);
}

// Last event index whose frameIndex <= i — the chapter stop's jump target.
export function lastEventOfFrame(events, i) {
  let out = 0;
  events.forEach((e, k) => { if (e.frameIndex <= i) out = k; });
  return out;
}

// Stats for the chapter window containing event index i (14-day buckets from
// the tape's first day). Everything counts native events only.
export function epochStats(events, i) {
  if (!events.length || i < 0) return null;
  const t0 = events[0].t;
  const ch = Math.floor((events[i].t - t0) / (14 * DAY_MS));
  const lo = t0 + ch * 14 * DAY_MS, hi = lo + 14 * DAY_MS;
  const inWin = events.filter((e) => e.t >= lo && e.t < hi);
  const reality = inWin.filter((e) => e.kind === "reality");
  const contra = inWin.find((e) => e.kind === "contradiction");
  const calls = inWin.filter((e) => e.kind === "call-locked" && e.nodeId && e.nodeId.startsWith("experiment"));
  return {
    chapter: ch + 1,
    from: new Date(lo).toISOString(),
    to: new Date(hi).toISOString(),
    callsMade: calls.length,
    resolved: reality.length,
    hits: reality.filter((e) => e.stance === "for").length,
    misses: reality.filter((e) => e.stance === "against").length,
    waiting: calls.length - reality.length > 0 ? calls.length - reality.length : 0,
    contradiction: contra?.title ?? null,
    theoryRetired: inWin.some((e) => e.kind === "theory-replaced"),
  };
}
