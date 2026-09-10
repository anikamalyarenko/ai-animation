import { useId, useMemo, useRef } from 'react';
import {
  ACTIVATED_BY,
  CANVAS,
  LINK_EDGES,
  NODES,
  SPINE_EDGES,
  SPINE_NODES,
  STEPS,
  STEP_LABELS,
} from './graph';
import { useElementSize, useReducedMotion, useScrollProgress } from './useScrollProgress';
import './ProcessFlow.css';

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

/** Dead zone at each end of the section so the first and last step can breathe. */
const LEAD_IN = 0.08;
const LEAD_OUT = 0.08;

const FULL_VIEWBOX = { x: 0, y: 0, width: CANVAS.width, height: CANVAS.height };

/**
 * When the box is too narrow for the whole graph, crop to the process spine
 * rather than shrinking everything to nothing. The tool connectors still run
 * off the edges, so the fan is implied rather than lost.
 *
 * `maxWidth` is the widest window that clears both columns of tool nodes: the
 * left column ends at x=255 and the right begins at x=940, so 262…938 is the
 * last crop that does not slice a pill in half. Between that and the full
 * 1200 there is no safe intermediate, so the choice is one or the other.
 */
const CROP = {
  y: 16,
  height: 1028,
  centerX: 600,
  minWidth: 500,
  maxWidth: 676,
};

/** Below this panel width the static (reduced-motion) layout uses the crop. */
const STATIC_CROP_BELOW = 820;

/**
 * How much bigger the crop has to draw the diagram before it is worth losing
 * the tool nodes. Only width-constrained boxes clear this: cropping a box that
 * is short rather than narrow gains nothing, so it keeps the full graph.
 */
const CROP_GAIN = 1.25;

const cropTo = (width) => {
  const w = clamp(width, CROP.minWidth, CROP.maxWidth);
  return { x: CROP.centerX - w / 2, y: CROP.y, width: w, height: CROP.height };
};

const scaleToFit = (box, viewBox) =>
  Math.min(box.width / viewBox.width, box.height / viewBox.height);

const toViewBox = (v) => `${v.x} ${v.y} ${v.width} ${v.height}`;

/**
 * Scroll-driven node-graph diagram.
 *
 * The section is `100vh + STEPS * scrollPerStep` tall and its inner panel is
 * sticky, so the diagram stays pinned while the user scrolls past it. Scroll
 * position — nothing else — decides which nodes are filled: there is no timer
 * and no autoplay.
 *
 * The component renders nothing but the SVG and paints no background of its
 * own — see ProcessFlow.css for the custom properties that colour it.
 *
 * @param {number}  scrollPerStep  Pixels of scroll each step takes. 7 steps at
 *                                 the default 140px = ~980px of runway.
 * @param {'light'|'dark'} theme  Structure colours for a light or a dark page.
 *                                 The accent is the same either way — see
 *                                 ProcessFlow.css.
 * @param {string}  label          Accessible name for the section.
 * @param {object}  style          Merged onto the section. Handy for setting
 *                                 the colour properties from the host.
 */
export default function ProcessFlow({
  scrollPerStep = 140,
  theme = 'light',
  className = '',
  label = 'Design process',
  style,
}) {
  // Namespaces the SVG ids, so two instances on one page cannot collide.
  const uid = useId().replace(/:/g, '');
  const sectionRef = useRef(null);
  const panelRef = useRef(null);
  const reducedMotion = useReducedMotion();
  const panel = useElementSize(panelRef);
  const progress = useScrollProgress(sectionRef, { enabled: !reducedMotion });

  const { activeCount, leadEdge, edgeFill } = useMemo(() => {
    // Reduced motion: skip the whole choreography and show the finished state.
    if (reducedMotion) {
      return {
        activeCount: STEPS.length,
        leadEdge: STEPS.length - 1,
        edgeFill: 1,
      };
    }
    const span = 1 - LEAD_IN - LEAD_OUT;
    const t = clamp((progress - LEAD_IN) / span, 0, 1);
    const raw = t * STEPS.length; // 0 -> 7
    const count = Math.min(STEPS.length, Math.floor(raw + 1e-6));
    const edge = Math.min(count, STEPS.length - 1);
    return {
      activeCount: count,
      leadEdge: edge,
      edgeFill: clamp(raw - edge, 0, 1),
    };
  }, [progress, reducedMotion]);

  // Sized from the panel, not the viewport, so an iframe of any width lays out
  // the same as a column of that width would.
  const viewBox = useMemo(() => {
    if (!panel || panel.width <= 0 || panel.height <= 0) return FULL_VIEWBOX;

    // In the static layout the panel's height comes from the viewBox, so
    // measuring it here would feed back into itself. Decide on width alone.
    if (reducedMotion) {
      return panel.width < STATIC_CROP_BELOW ? cropTo(CROP.maxWidth) : FULL_VIEWBOX;
    }

    // Match the crop to the panel's aspect ratio so it fills the box instead of
    // letterboxing, up to the widest window that keeps the pills whole.
    const cropped = cropTo((panel.width / panel.height) * CROP.height);
    return scaleToFit(panel, cropped) > scaleToFit(panel, FULL_VIEWBOX) * CROP_GAIN
      ? cropped
      : FULL_VIEWBOX;
  }, [panel, reducedMotion]);

  const fillOf = (step) => (step < activeCount ? 1 : step === leadEdge ? edgeFill : 0);
  const isActive = (nodeId) => {
    const step = ACTIVATED_BY[nodeId];
    return step === undefined ? false : step < activeCount;
  };

  // Dots only travel the connector the diagram is currently drawing.
  const showFlow = !reducedMotion && edgeFill > 0.02 && edgeFill < 0.98;

  return (
    <section
      ref={sectionRef}
      className={`pf-section pf-theme-${theme}${reducedMotion ? ' pf-static' : ''} ${className}`}
      style={
        reducedMotion
          ? style
          : {
              height: `calc(100vh + ${STEPS.length * scrollPerStep}px)`,
              ...style,
            }
      }
      aria-label={label}
    >
      <div className="pf-sticky">
        <div className="pf-panel" ref={panelRef}>
          <svg
            className="pf-canvas"
            viewBox={toViewBox(viewBox)}
            preserveAspectRatio="xMidYMid meet"
            aria-hidden="true"
            focusable="false"
          >
            {/* A letterboxed SVG still paints what falls outside the viewBox,
                which would show half-cropped pills either side of the spine.
                Clipping to the viewBox itself is what makes the crop a crop. */}
            <defs>
              <clipPath id={`pf-clip-${uid}`}>
                <rect x={viewBox.x} y={viewBox.y} width={viewBox.width} height={viewBox.height} />
              </clipPath>
            </defs>

            <g clipPath={`url(#pf-clip-${uid})`}>
              {/* Tool connectors: always drawn, brighten with their target node. */}
              <g className="pf-links">
                {LINK_EDGES.map((edge) => (
                  <path
                    key={edge.id}
                    d={edge.d}
                    className={`pf-link${isActive(edge.source) ? ' is-active' : ''}`}
                  />
                ))}
              </g>

              {/* Spine connectors: a dim base path with a bright one drawn over it. */}
              <g className="pf-spine">
                {SPINE_EDGES.map((edge) => {
                  const fill = fillOf(edge.step);
                  return (
                    <g key={edge.id}>
                      <path d={edge.d} className="pf-edge-base" />
                      <path
                        id={`pf-edge-${uid}-${edge.step}`}
                        d={edge.d}
                        className="pf-edge-fill"
                        pathLength="1"
                        strokeDasharray="1 1"
                        strokeDashoffset={1 - fill}
                      />
                      {/* Scroll-driven head: a round-capped zero-length dash, so
                        the leading dot is positioned by scroll alone. */}
                      {fill > 0 && fill < 1 && (
                        <path
                          d={edge.d}
                          className="pf-edge-head"
                          pathLength="1"
                          strokeDasharray="0.0001 1"
                          strokeDashoffset={-fill}
                        />
                      )}
                    </g>
                  );
                })}
              </g>

              {/* Ambient particles on the connector currently being drawn. */}
              {showFlow && (
                <g className="pf-flow" key={`flow-${leadEdge}`}>
                  {[0, 1, 2].map((i) => (
                    <circle key={i} r="3.5" className="pf-particle">
                      <animateMotion
                        dur="1.5s"
                        begin={`${-i * 0.5}s`}
                        repeatCount="indefinite"
                        calcMode="linear"
                        keyPoints="0;1"
                        keyTimes="0;1"
                      >
                        <mpath
                          href={`#pf-edge-${uid}-${leadEdge}`}
                          xlinkHref={`#pf-edge-${uid}-${leadEdge}`}
                        />
                      </animateMotion>
                    </circle>
                  ))}
                </g>
              )}

              {/* Nodes last, so they sit above the connectors. */}
              <g className="pf-nodes">
                {NODES.map((n) => {
                  const active = isActive(n.id);
                  const next = ACTIVATED_BY[n.id] === activeCount;
                  const entry = n.id === SPINE_NODES[0].id;
                  return (
                    <g
                      key={n.id}
                      className={[
                        'pf-node',
                        `pf-node--${n.kind}`,
                        active ? 'is-active' : '',
                        next ? 'is-next' : '',
                        entry ? 'is-entry' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      <rect
                        x={n.left}
                        y={n.top}
                        width={n.w}
                        height={n.h}
                        rx={n.rx}
                        className="pf-node-shape"
                      />
                      <text
                        x={n.x}
                        y={n.y}
                        dy="0.35em"
                        textAnchor="middle"
                        className="pf-node-label"
                      >
                        {n.label}
                      </text>
                    </g>
                  );
                })}
              </g>
            </g>
          </svg>

          {/* The diagram as text, for screen readers and for anyone who never
              scrolls the section. */}
          <ol className="pf-sr-only">
            {STEPS.map((id, i) => (
              <li key={id}>
                {STEP_LABELS[id]}
                {i < activeCount ? ' — complete' : ''}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
