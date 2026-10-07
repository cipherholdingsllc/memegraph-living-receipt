// MemeGraph - human-first copy system. Lead-authored (Fable 5.1). Pure functions, no DOM.
// Every sentence here is derived from a native record field; nothing is invented.
// Technical vocabulary lives only under EXPERT_* keys and in the inspector's expert section.

export const BRAND = {
  name: "MemeGraph",
  tagline: "It remembers what we knew. And keeps the receipt.",
  exampleBadge: "Example story · made-up data",
  exampleNote: "A worked example with made-up data. No real audience, no real win.",
  liveStatus: "Live experiment running · results kept out of this demo",
};

export const HERO = {
  question: "Will people keep coming back to a meme that admits it's fiction?",
  sub: "One call, locked on Apr 3, 2026. Everything we knew. What happened next.",
  explainer:
    "MemeGraph is a memory for predictions. It saves what we knew when we made a call, locks the call so nobody can quietly edit it, then records what actually happened — hit or miss.",
  truthLine: "Receipts prove the record is consistent — not that we were right.",
};

export const ACTIONS = {
  play: "Play the story",
  pause: "Pause",
  replay: "Play it again",
  why: "Why did we think this?",
  against: "What argued against it?",
  clearFocus: "Show everything",
  receipt: "See the receipt",
  saveReceipt: "Save the receipt (JSON)",
  share: "Share this call",
  shareSaving: "Making your image…",
  expertOn: "Expert view",
  expertOff: "Simple view",
  close: "Close",
  next: "Next",
  back: "Back",
  timeLabel: "Move through time",
  nowPrefix: "You're seeing what was known on",
};

// Seven chapter stops = seven native frames, in order. Index == frame index.
export const CHAPTERS = [
  {
    date: "Jan 2, 2026",
    title: "What we knew",
    line: "We'd looked at four similar projects: North Star, Aligned Control, Halcyon and Glass. We set Glass aside as a test case we promised not to peek at.",
  },
  {
    date: "Jan 3, 2026",
    title: "What worried us",
    line: "A new source said Halcyon never admitted it was fiction. That clashes with what we had. We kept both records.",
  },
  {
    date: "Apr 2, 2026",
    title: "Our theory",
    line: "Three months in: North Star and Aligned Control kept people for 90 days; Halcyon collapsed. Our theory: if a project is open about being fiction and is useful, people stay.",
  },
  {
    date: "Apr 3, 2026",
    title: "Our call — locked",
    line: "We locked the call. From here on it can't be edited. Now we wait at least 30 days.",
  },
  {
    date: "Apr 10, 2026",
    title: "A test case comes back",
    line: "Glass — the case we didn't peek at — came back. It was open about being fiction and it was useful, and people still didn't stick around.",
  },
  {
    date: "Apr 11, 2026",
    title: "Our theory breaks",
    line: "Glass broke the theory, so we rejected it. The call stayed exactly as written.",
  },
  {
    date: "May 3, 2026",
    title: "What happened",
    line: "The result: 2 people joined, 1 came back. We needed 10 and 3. A miss — kept, not deleted.",
  },
];

export const CALL_CARD = {
  kicker: "OUR CALL",
  lockedLabel: (date) => `Locked ${date}`,
  // Lead paraphrase of call.hypothesis; the original sentence is shown in the expert layer.
  human:
    "A meme that openly admits it's fiction, remembers things and shows its receipts will earn repeat participation — with no money promised.",
  inOurWords: "in plain words · original wording in Expert view",
  // from call.falsification_criteria
  criteriaTitle: "Counts as a hit if, within 30 days:",
  criteria: (c) => [
    `at least ${c.minimum_unique_participants} people join`,
    `at least ${c.minimum_repeat_participants} come back`,
  ],
  evidenceCutoff: (date) => `Last evidence counted: ${date}`,
  fingerprint: "Fingerprint",
  waiting: "We don't know yet",
  waitingSub: (days, date) => `${days}-day minimum · earliest answer ${date}`,
};

export const UNKNOWNS = {
  title: "What we couldn't know when we called it",
  // Keyed by the native known_unknowns strings. Unmapped strings fall back to the native text.
  map: {
    "All comparables are synthetic": "Our four comparison projects are made-up examples",
    "No empirical audience response": "We had no real audience data",
    "No calibrated probabilities": "We didn't put a number on how confident we were",
    "No causal or market-prediction validity": "This says nothing about markets or prices",
  },
};

export const RESULT = {
  stamp: { resolved_miss: "MISS", resolved_hit: "HIT", unresolved: "WAITING" },
  title: { resolved_miss: "We were wrong", resolved_hit: "We were right", unresolved: "We don't know yet" },
  // from outcome.delta.observed_metrics + shortfalls + call.falsification_criteria
  lines: (o, call) => {
    const c = call?.falsification_criteria ?? call ?? {};
    const m = o?.delta?.observed_metrics ?? o?.result?.metrics ?? {};
    const out = [];
    if (m.unique_opt_in_participants != null)
      out.push(`${m.unique_opt_in_participants} ${m.unique_opt_in_participants === 1 ? "person" : "people"} joined (needed ${c.minimum_unique_participants})`);
    if (m.repeat_opt_in_participants != null)
      out.push(`${m.repeat_opt_in_participants} came back (needed ${c.minimum_repeat_participants})`);
    if (m.useful_interactions != null) out.push(`${m.useful_interactions} useful interactions`);
    if (Array.isArray(m.trust_incidents)) out.push(`${m.trust_incidents.length} trust problems`);
    return out;
  },
  windowLine: (o) => (o?.result?.window_days ? `Checked after ${o.result.window_days} days` : ""),
  keptLine: "The miss is kept. Nothing above it was edited.",
};

export const LESSON = {
  title: "What we learned",
  recordLabel: "What we wrote down",
  plainLabel: "In plain words",
  // Lead paraphrase of outcome.lesson + recipe v2 (rejected, known_counterexamples [p07]).
  plain:
    "We were wrong, inside the window we set ourselves. Being open about fiction and being useful wasn't enough on its own — Glass did both and people still left. We keep the miss and rethink the theory.",
};

export const RECEIPT = {
  title: "The receipt",
  what: "A saved copy of the call, the date it was locked, every piece of evidence we had, and the result — each with a fingerprint (a hash) so you can check this record matches itself.",
  provesTitle: "What it proves",
  proves: "That this record is consistent with its fingerprints: the call you see is the call that was saved.",
  notTitle: "What it does not prove",
  not: [
    "that our sources were right",
    "that nobody edited history before it was saved",
    "that we're good at predicting",
  ],
  frameNote: (date) => `This receipt covers what was known on ${date}.`,
};

export const SHARE_CARD = {
  calledIt: (date) => `WE CALLED IT · ${date}`,
  knew: "WHAT WE KNEW",
  happened: (date) => `WHAT HAPPENED · ${date}`,
  learned: "WHAT WE LEARNED",
  // WAITING state only: nothing has been learned yet, so the card shows the test we set instead.
  willCount: "WHAT WOULD PROVE US WRONG",
  willCountLine: (c) =>
    `Fewer than ${c.minimum_unique_participants} people joining, or fewer than ${c.minimum_repeat_participants} coming back, within ${c.minimum_observation_days} days. We wrote that down before we knew.`,
  footer: "MEMEGRAPH KEPT THE RECEIPT.",
  waitingFooter: "MEMEGRAPH IS KEEPING THE RECEIPT.",
  example: "Example story · made-up data",
  // Three plain facts available at the lock (frame 3). Fixed to this fixture's records.
  knewFacts: [
    "North Star and Aligned Control kept people for 90 days",
    "Halcyon collapsed — and one source disputed what we had on it",
    "We set Glass aside as a test we wouldn't peek at",
  ],
};

export const FIELD = {
  sealLabel: "LOCKED HERE",
  afterLabel: "AFTER THE LOCK",
  beforeLabel: "BEFORE THE LOCK",
  gapLabel: "3 months",
  thinkingLane: "Our thinking",
  stanceFor: "Evidence for",
  stanceAgainst: "Evidence against",
  legendSimple: [
    ["for", "Evidence that fit our thinking"],
    ["against", "Evidence that argued against it"],
    ["paper", "The locked call"],
    ["stamp", "What reality said"],
    ["unknown", "Things we couldn't know"],
  ],
};

export const INSPECTOR = {
  kindWord: {
    observed: "Something we saw",
    claimed: "Something a source said",
    conflict: "Contested — two records disagree",
    inferred: "Our best read",
    preregistered: "The locked call",
    resolved_miss: "The result: a miss",
    resolved_hit: "The result: a hit",
    reservation: "A promise not to peek",
    archived: "Where this came from",
    context: "A project we compared",
  },
  roleWord: {
    positive_comparable: "a project that fit our thinking",
    negative_comparable: "a project that went the other way",
    reserved_comparable: "a test case we promised not to peek at",
    recipe: "our theory at the time",
    experiment: "our call",
    outcome: "what reality said",
    assessment: "a promise we made to ourselves",
    source: "where a record came from",
    context: "a label",
  },
  when: { happened: "Happened", known: "Known to us", written: "Written down" },
  knownAtCall: "Known when we made the call?",
  yes: "Yes",
  no: "No — this arrived after the lock",
  from: "Where this came from",
  fingerprint: "Fingerprint",
  against: "Clashes with",
  older: (date) => `Older thinking — replaced ${date}`,
  madeUp: "Part of the made-up example",
  expert: "Expert details",
  expertFields: {
    id: "Record ID",
    raw_label: "Internal label",
    role: "Role",
    status: "Status",
    confidence_class: "Confidence class",
    assertion: "Assertion kind",
    edge_debt: "Edge debt",
    obligations: "Obligations",
    omitted_value_fields: "Omitted fields",
    parent_ids: "Parent records",
    source_ids: "Source records",
    payload: "Full record",
  },
};

// Old technical term -> new human wording. Rendered in Expert view legend and used in docs.
export const GLOSSARY = [
  ["cutoff", "What we knew on [date]"],
  ["preregistered", "Locked before the result"],
  ["provenance", "Where this came from"],
  ["contradiction", "Evidence against it / clashes with"],
  ["unresolved", "We don't know yet"],
  ["stale", "Older thinking (replaced)"],
  ["observed", "Something we saw"],
  ["claimed", "Something a source said"],
  ["inferred", "Our best read"],
  ["receipt", "The receipt (what it proves, what it doesn't)"],
  ["holdout reservation", "A test case we promised not to peek at"],
  ["recipe", "Our theory"],
  ["rejected recipe", "Theory rejected"],
  ["falsification criteria", "What counts as a hit / a miss"],
  ["evidence cutoff", "Last evidence counted"],
  ["prediction hash", "Fingerprint"],
  ["synthetic fixture", "Example story · made-up data"],
  ["known unknowns", "What we couldn't know"],
  ["replay", "Play the story"],
  ["trace lineage", "Why did we think this?"],
  ["isolate opposition", "What argued against it?"],
  ["export receipt", "Save the receipt"],
];

/* ---------- derivation helpers (pure) ---------- */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function humanDate(iso, withYear = false) {
  const t = Date.parse(iso ?? "");
  if (Number.isNaN(t)) return "";
  const d = new Date(t);
  const s = `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
  return withYear ? `${s}, ${d.getUTCFullYear()}` : s;
}

export function projectName(frame, pid) {
  const ent = (frame?.nodes ?? []).find((n) => n.kind === "entity" && n.label === `project:${pid}`);
  const raw = ent?.payload?.label ?? pid;
  return raw.replace(/\s*\(synthetic\)\s*/i, "").trim();
}

function pidOf(node) {
  return /(p\d+)/.exec(node?.label ?? "")?.[1] ?? null;
}

// Stance relative to the call's thinking. Colour follows this, never time.
//   for      - fits the theory / the call
//   against  - argues against it (contradiction, counterexample, the miss)
//   neutral  - sources, labels, reservation, the call itself
export function stanceOf(node, frame) {
  if (!node) return "neutral";
  if (node.kind === "outcome") return node.status === "resolved_hit" ? "for" : "against";
  if (node.kind === "recipe") return frame?.recipe?.id === node.id && frame.recipe.state === "rejected" ? "against" : "for";
  if (node.kind === "observation") {
    if (node.status === "conflict" && node.payload?.value?.explicit_fiction === false) return "against";
    if (/outcome/.test(node.label ?? "")) {
      const v = node.payload?.value ?? {};
      if (node.role === "reserved_comparable" && v.persistent_participation === false) return "against";
    }
    return "for";
  }
  return "neutral";
}

// Short field label (default-visible or on hover). Plain words, derived from fields.
export function humanCaption(node, frame) {
  if (!node) return "";
  const pid = pidOf(node);
  const name = pid ? projectName(frame, pid) : "";
  switch (node.kind) {
    case "source":
      return "Where this came from";
    case "entity":
      if (/experiment/.test(node.label ?? "")) return "Call #001";
      return node.payload?.label?.replace(/\s*\(synthetic\)\s*/i, "").trim() ?? node.label;
    case "observation": {
      const v = node.payload?.value ?? {};
      if (/feature/.test(node.label ?? "")) {
        if (node.payload?.assertion_kind === "source_claim" && v.explicit_fiction === false)
          return `A source says ${name} never admitted it was fiction`;
        const bits = [];
        if (v.explicit_fiction === true) bits.push("open about being fiction");
        else if (v.explicit_fiction === false) bits.push("not open about being fiction");
        if (v.has_utility === true) bits.push("useful");
        else if (v.has_utility === false) bits.push("not useful");
        return `${name}: ${bits.join(", ") || "what it looked like at launch"}`;
      }
      if (/outcome/.test(node.label ?? "")) {
        if (v.persistent_participation === true) return `${name} kept people for ${v.survival_days ?? 90} days`;
        if (v.later_collapse === true) return `${name} collapsed — fit our theory`;
        if (v.persistent_participation === false) return `${name}: people didn't stick around`;
        return `${name}: what happened later`;
      }
      return node.label ?? "";
    }
    case "recipe": {
      const rejected = frame?.recipe?.id === node.id && frame.recipe.state === "rejected";
      if (rejected) {
        const cx = (node.payload?.known_counterexamples ?? []).map((id) => projectName(frame, id.replace(/^project:/, "")));
        return cx.length ? `Theory rejected — ${cx.join(", ")} broke it` : "Theory rejected";
      }
      return "Our theory: open about fiction + useful → people stay" + (node.stale ? " (later replaced)" : "");
    }
    case "experiment":
      return `Our call — locked ${humanDate(node.known_at)}`;
    case "outcome":
      return node.status === "resolved_miss" ? "Miss" : node.status === "resolved_hit" ? "Hit" : "Result";
    case "assessment": {
      const ids = node.payload?.project_ids ?? [];
      const named = ids.map((id) => projectName(frame, id.replace(/^project:/, "")));
      const inFrame = named.filter((n) => !/^p\d+$/.test(n));
      const others = named.length - inFrame.length;
      const who = inFrame.join(" and ") + (others ? ` (and ${others} other project${others > 1 ? "s" : ""})` : "");
      return `Set aside ${who} as test cases we won't peek at`;
    }
    default:
      return node.label ?? node.id;
  }
}

// Short form for chips/pills on the field (<= ~34 chars). Falls back to humanCaption.
export function shortCaption(node, frame) {
  if (!node) return "";
  if (node.kind === "assessment") {
    const ids = node.payload?.project_ids ?? [];
    const named = ids.map((id) => projectName(frame, id.replace(/^project:/, ""))).filter((n) => !/^p\d+$/.test(n));
    return named.length ? `Set aside ${named[0]} as a no-peek test` : "A no-peek test, set aside";
  }
  if (node.kind === "recipe") {
    const rejected = frame?.recipe?.id === node.id && frame.recipe.state === "rejected";
    if (rejected) return humanCaption(node, frame);
    return node.stale ? "Our theory (later replaced)" : "Our theory: open + useful → people stay";
  }
  return humanCaption(node, frame);
}

// One-sentence human explanation for the inspector body.
export function humanExplain(node, frame) {
  const cap = humanCaption(node, frame);
  const pid = pidOf(node);
  const name = pid ? projectName(frame, pid) : "";
  if (node.kind === "source") {
    return `The saved file this record came from, captured ${humanDate(node.payload?.captured_at)}. Its fingerprint lets you check the bytes haven't changed since we saved them.`;
  }
  if (node.kind === "observation" && node.status === "conflict") {
    return `${cap}. Two records about ${name} disagree, so we keep both and mark the clash instead of picking one.`;
  }
  if (node.kind === "observation" && /outcome/.test(node.label ?? "")) {
    const v = node.payload?.value ?? {};
    if (node.role === "reserved_comparable" && v.persistent_participation === false)
      return `${cap}. This was the test case we promised not to peek at. It did what our theory said mattered, and people still left — a counterexample the theory couldn't survive.`;
    return `${cap}. This is what happened to ${name} after ${v.survival_days ?? 90} days. It fit our thinking at the time.`;
  }
  if (node.kind === "observation" && /feature/.test(node.label ?? "")) {
    return `${cap}. What ${name} looked like when it launched — one of the things we compared before making the call.`;
  }
  if (node.kind === "recipe") {
    return node.stale
      ? `${cap}. This was our thinking at the time; it was replaced later, but we keep it so you can see what we believed.`
      : `${cap}.`;
  }
  if (node.kind === "experiment") return `${cap}. Once locked, the words can't change. Only the result can be added later.`;
  if (node.kind === "outcome") return `${cap}. Reality came back, and we stamped it onto the record rather than rewriting the call.`;
  if (node.kind === "assessment") return `${cap}. We decided this before we had results, so the test couldn't be gamed.`;
  if (node.kind === "entity") return /experiment/.test(node.label ?? "") ? "The label for this call." : `${cap} — one of the projects we compared before making the call.`;
  return `${cap}.`;
}

export function unknownsHuman(frame) {
  return (frame?.unknowns ?? []).map((u) => UNKNOWNS.map[u] ?? u);
}

export function resultState(frame) {
  if (!frame?.call) return null;
  if (frame.outcome) return frame.outcome.outcome_status === "FALSIFIED_IN_WINDOW" ? "resolved_miss" : "resolved_hit";
  return "unresolved";
}

export function earliestAnswerDate(frame) {
  const days = frame?.call?.falsification_criteria?.minimum_observation_days;
  const t = Date.parse(frame?.call?.created_at ?? "");
  if (!days || Number.isNaN(t)) return null;
  return new Date(t + days * 86400000).toISOString();
}

/* ---------- additions needed by the Living Receipt shell (lead file verbatim above) ----------
   Strings not present in the lead-authored copy but required by ART_DIRECTION sections
   referenced in comments. Listed here so they stay reviewable in one place. */

// Focus-mode rail captions quoted in ART_DIRECTION section 5.
export const FOCUS = {
  whyCaption: "Everything the call was built on.",
  againstCaption: "Everything that argued against it at this point in time.",
};

export const MISC = {
  // Share disabled title on frames without a call (section 7).
  noCallYet: "No call yet at this date",
  // Inspector: a referenced record not present in the current frame (section 6).
  notInView: "not in this view",
  // Zoom reset text button (section 4).
  resetView: "Reset",
  // Mobile chapter stack placeholder for later stops (section 8).
  chapterFuture: "We don't know yet — move time forward",
  // Accessible label for the evidence field.
  fieldLabel: "The field of evidence through time",
  // Source list rows: "Saved Apr 3, 2026" (section 6: 'saved {date}').
  savedLine: (date) => `Saved ${date}`,
};

// Short criteria line printed on the call card: "10 join · 3 come back · 30 days" (section 4).
// Numbers come from call.falsification_criteria; never hardcoded.
export function criteriaShort(c, { window = true } = {}) {
  if (!c) return "";
  const parts = [];
  if (c.minimum_unique_participants != null) parts.push(`${c.minimum_unique_participants} join`);
  if (c.minimum_repeat_participants != null) parts.push(`${c.minimum_repeat_participants} come back`);
  // drop the day window when the preceding copy already says "within N days"
  if (window && c.minimum_observation_days != null) parts.push(`${c.minimum_observation_days} days`);
  return parts.join(" · ");
}

/* ---------- THE REPLAY BOOTH (spec section 9, verbatim) ---------- */

export const REPLAY = {
  play: "Instant Replay",
  pause: "Pause",
  rewind: "Rewind",
  step: "Step",
  why: "Why did it move?",
  share: "Share replay",
  kinds: {
    "watcher-report": "A watcher reported",
    "signal-fit": "Fit our thinking",
    "signal-against": "Argued against it",
    "unknown-noted": "We couldn't know this",
    contradiction: "Evidence against it",
    "theory-formed": "Our theory",
    "theory-replaced": "Theory replaced",
    "no-peek-set": "Set aside a no-peek test",
    "call-locked": "Call locked",
    reality: "Reality arrived",
    "chapter-closed": "Chapter closed",
  },
  lockLine: "Nothing after this line can change the call.",
  whyTitle: "What changed",
  plain: "In plain words",
  confidence: "Confidence: we didn't put a number on it",
};

export const HOME = {
  predict: "What are we trying to predict?",
  call: "Our call",
  why: "Why?",
  fit: (n) => `${n} ${n === 1 ? "thing" : "things"} that fit`,
  against: (n) => `${n} ${n === 1 ? "thing" : "things"} that argued against`,
  unknown: (n) => `${n} ${n === 1 ? "thing" : "things"} we couldn't know`,
  changeMind: "Biggest thing that could change our mind",
};

export const MODES = {
  demo: "DEMO · made-up example",
  live: "LIVE",
  replay: "REPLAY",
  liveSealed:
    "Live experiment running. Its calls, arms and outcomes are sealed until the protocol says otherwise. Nothing here is live.",
  replayEmpty:
    "No resolved real calls yet. When one resolves it will replay here from its own event log.",
};

export const WATCHERS = {
  title: "Watchers",
  sub: "Each watcher is one piece of real evidence work. No mascots.",
  cols: ["Mission", "What it checked", "What it found", "What changed", "Receipt"],
};

export const EPOCH = {
  title: "This chapter",
  sub: "Every 14 days we close the book and count.",
  notTracked: "not tracked in this example",
};

export const GLASS = {
  title: "Economic constitution v1",
  badge: "DRAFT · PRE-LAUNCH",
  q: "How does Nate make money?",
  a: "Creator fees. Not hidden token sales.",
  none: "— (nothing yet)",
  footer: "No money has moved. This is a draft policy for review, not a contract.",
  founder:
    "If a founder holds a personal position it is disclosed, capped, locked, vested on a fixed schedule, and never counted as project revenue.",
};

export const SHARE = {
  closerResolved: "Reality arrived. MemeGraph kept the original call.",
  closerWaiting: "Still waiting. The call can't move.",
};
