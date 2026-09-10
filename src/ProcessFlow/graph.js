/**
 * Geometry for the node graph.
 *
 * Everything lives in one SVG user-space coordinate system (CANVAS) and is
 * scaled by the viewBox, so the diagram stays sharp at any size and the text
 * is real <text> — never a stretched raster.
 */

export const CANVAS = { width: 1200, height: 1060 };

const SPINE = { w: 280, h: 64, x: 600 };
const LEFT = { w: 200, h: 52, x: 155 };
const RIGHT = { w: 212, h: 52, x: 1046 };

const node = (id, label, x, y, w, h, kind) => ({
  id,
  label,
  x,
  y,
  w,
  h,
  kind,
  left: x - w / 2,
  right: x + w / 2,
  top: y - h / 2,
  bottom: y + h / 2,
  rx: h / 2,
});

const spine = (id, label, y) => node(id, label, SPINE.x, y, SPINE.w, SPINE.h, 'spine');
const left = (id, label, y) => node(id, label, LEFT.x, y, LEFT.w, LEFT.h, 'tool');
const right = (id, label, y) => node(id, label, RIGHT.x, y, RIGHT.w, RIGHT.h, 'tool');

/** The vertical process spine, top to bottom. */
export const SPINE_NODES = [
  spine('mobile', 'MOBILE / WEB', 56),
  spine('research', 'RESEARCH', 190),
  spine('lofi', 'LO-FI', 324),
  spine('hifi', 'HI-FI', 458),
  spine('system', 'DESIGN SYSTEM', 592),
  spine('a11y', 'ACCESSIBILITY (WCAG)', 726),
  spine('handoff', 'HANDOFF', 860),
  spine('ship', 'SHIP', 994),
];

/** Tool nodes hanging off the spine. */
export const TOOL_NODES = [
  left('figma-lofi', 'FIGMA', 188),
  left('agent-lofi', 'FIGMA AGENT', 256),
  left('make-lofi', 'FIGMA MAKE', 324),
  left('claude-lofi', 'CLAUDE', 392),
  left('pilot-lofi', 'UX PILOT', 460),
  left('claude-handoff', 'CLAUDE', 860),
  right('figjam', 'FIGJAM', 190),
  right('figma-hifi', 'FIGMA', 384),
  right('agent-hifi', 'FIGMA AGENT', 458),
  right('make-hifi', 'FIGMA MAKE', 532),
  right('variables', 'FIGMA VARIABLES', 660),
];

export const NODES = [...SPINE_NODES, ...TOOL_NODES];

const byId = Object.fromEntries(NODES.map((n) => [n.id, n]));

/**
 * Spine connector: a soft vertical S that leaves the underside of one pill and
 * enters the top of the next, offset to the left of centre — the curve style
 * used in the reference layout.
 */
const spinePath = (a, b) => {
  const x = a.left + 46;
  const y0 = a.bottom;
  const y1 = b.top;
  const bend = 28;
  const ease = (y1 - y0) * 0.5;
  return `M ${x} ${y0} C ${x - bend} ${y0 + ease}, ${x + bend} ${y1 - ease}, ${x} ${y1}`;
};

/**
 * Tool connector: a long horizontal bezier that flattens out as it converges on
 * the spine, so a group of them reads as a fan meeting at a single point.
 */
const linkPath = (from, to) => {
  const fromRight = from.x < to.x;
  const x0 = fromRight ? from.right : from.left;
  const x1 = fromRight ? to.left : to.right;
  const dx = x1 - x0;
  return `M ${x0} ${from.y} C ${x0 + dx * 0.55} ${from.y}, ${x1 - dx * 0.2} ${to.y}, ${x1} ${to.y}`;
};

/**
 * Spine edges, in activation order. Edge i is the connector that leads into
 * step i, so edge and step share an index.
 */
export const SPINE_EDGES = SPINE_NODES.slice(0, -1).map((from, i) => {
  const to = SPINE_NODES[i + 1];
  return { id: `spine-${i}`, step: i, target: to.id, d: spinePath(from, to) };
});

/** Everything that is not part of the spine. Lights up with its target node. */
export const LINK_EDGES = [
  ['figjam', 'research'],
  ['figma-lofi', 'lofi'],
  ['agent-lofi', 'lofi'],
  ['make-lofi', 'lofi'],
  ['claude-lofi', 'lofi'],
  ['pilot-lofi', 'lofi'],
  ['figma-hifi', 'hifi'],
  ['agent-hifi', 'hifi'],
  ['make-hifi', 'hifi'],
  ['variables', 'system'],
  ['claude-handoff', 'handoff'],
].map(([from, to]) => ({
  id: `link-${from}-${to}`,
  source: from,
  target: to,
  d: linkPath(byId[from], byId[to]),
}));

/**
 * The seven nodes that activate on scroll. `mobile` is the entry point and is
 * drawn as always-present context, so the steps start at RESEARCH.
 */
export const STEPS = SPINE_NODES.slice(1).map((n) => n.id);
export const STEP_LABELS = Object.fromEntries(SPINE_NODES.map((n) => [n.id, n.label]));

/** node id -> index of the step that activates it (tool nodes included). */
export const ACTIVATED_BY = {
  ...Object.fromEntries(STEPS.map((id, i) => [id, i])),
  ...Object.fromEntries(LINK_EDGES.map((e) => [e.source, STEPS.indexOf(e.target)])),
};
