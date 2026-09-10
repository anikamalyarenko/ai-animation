# Process Flow — scroll-driven node graph

A product design process drawn as a node graph and animated by scroll position.
Native SVG throughout: rounded-rect nodes with real `<text>` labels and bezier
connectors, so nothing is a raster and nothing distorts when the layout scales.

The component renders the diagram and nothing else — no heading, no counter, no
caption — and paints no background of its own, so it drops into a page that
already has its own copy around it.

## How the animation works

The section is `100vh + (7 × scrollPerStep)` tall and its inner panel is
`position: sticky`, so the diagram pins to the viewport while the user scrolls
past it. There is **no timer and no autoplay** — scroll position is the only
input.

- An `IntersectionObserver` gates the scroll listener, so nothing is measured
  while the section is off screen.
- Scroll progress is `-rect.top / (rect.height - innerHeight)`, clamped to
  `0…1`, sampled in a `requestAnimationFrame` and quantised so React re-renders
  only on a real change.
- That progress maps onto seven steps, in order:
  **Research → Lo-Fi → Hi-Fi → Design System → Accessibility (WCAG) → Handoff → Ship.**
  Each step gets an equal slice of the runway; a node flips to its solid fill
  once its slice completes.
- `Mobile / Web` is the entry point, not a step, so it is drawn as present
  context from the start.
- Tool nodes (Figma, Figma Agent, Figma Make, Claude, UX Pilot, FigJam, Figma
  Variables) light up with the spine node they feed.

### Two kinds of dots

| Dot | Driven by | Purpose |
| --- | --- | --- |
| Leading head | Scroll position only | Sits at the drawing tip of the current connector. A round-capped zero-length dash on a `pathLength="1"` path — no measurement, no JS per frame. |
| Flow particles | `<animateMotion>` on an `<mpath>` | Three evenly spaced dots looping along the connector the diagram is currently drawing. Ambient reinforcement, disabled under reduced motion. |

## States

| State | Node | Connector |
| --- | --- | --- |
| Pending | `--pf-line` outline, `--pf-label` label | `--pf-line` base line |
| Next | Accent outline and label, no fill | Accent line drawing in, particles flowing |
| Filled | Accent fill, `--pf-on-accent` label | Fully drawn in accent |

Two details:

- A filled node's stroke is set to the accent rather than removed, so the pill
  renders at the same size as an unfilled one instead of shrinking by the
  stroke width as it fills.
- `Mobile / Web` is the entry point and never activates, so its outline takes
  the label colour — present, rather than a step still waiting to be reached.

## Accessibility

- `prefers-reduced-motion: reduce` drops the pinning and the runway entirely.
  The section becomes an ordinary block at its natural height, showing the
  fully activated diagram. No particles are mounted, and colour transitions are
  turned off. Nothing is scroll-gated, so no content depends on the animation.
- The SVG is `aria-hidden`; the same seven steps are exposed as a visually
  hidden ordered list, with completion state.
- Colour is never the only signal: a node gains a fill where before it had only
  an outline, so the sequence still reads without distinguishing the accent.
- Against white, the default palette measures roughly 7.3:1 for `--pf-accent`
  and for its white label, and 4.6:1 for `--pf-label` — all above AA for text.
  `--pf-line` is about 1.3:1, deliberately faint: it draws structure that has
  not been reached yet, and the hidden ordered list carries the sequence
  regardless.

## Responsive

Layout is driven by the size of the component's own box, measured with a
`ResizeObserver` — not by the viewport. A 520px-wide iframe on a desktop lays
out like a 520px phone, which a media query would get wrong.

When the box is too narrow for the whole graph, the viewBox crops to the
process spine and the tool connectors run off the edges, implying the fan
instead of shrinking everything to nothing. Two details make that work:

- The crop stops at `262…938`, the widest window that clears both columns of
  tool nodes. Anything between that and the full 1200 would slice a pill in
  half, so there is no intermediate — it is one or the other.
- Everything is drawn inside a `clipPath` matching the viewBox. A letterboxed
  SVG still paints what falls outside its viewBox, so without the clip the
  crop would leak half-pills into the margins.

The switch happens when cropping would draw the diagram at least 25% larger,
which only a width-constrained box achieves; a box that is short rather than
narrow keeps the full graph, because cropping it would gain nothing.

## Props

| Prop | Default | What it does |
| --- | --- | --- |
| `scrollPerStep` | `140` | Pixels of scroll per step. 7 steps × 140 ≈ 980px of runway. Lower it (100) for a faster section, raise it (200) for a slower one. |
| `theme` | `'light'` | `'light'` draws `#1a1a1a` ink on a light page; `'dark'` draws white ink on a dark one. |
| `className` | `''` | Passed through to the section. |
| `label` | `'Design process'` | Accessible name for the section. |
| `style` | — | Merged onto the section. Use it to set the two colour properties per instance. |

## Embedding

```jsx
import ProcessFlow from './ProcessFlow';

<article>
  <h2>How I work</h2>
  <p>…your own copy…</p>

  <ProcessFlow />

  <p>…more of your own copy…</p>
</article>
```

The section is transparent and inherits the page's font. Colour comes from four
custom properties:

| Property | Default | What it is |
| --- | --- | --- |
| `--pf-accent` | `#4338e0` | Everything the scroll has reached: filled nodes, the connector being drawn, its leading dot and the particles |
| `--pf-on-accent` | `#ffffff` | Label inside a filled node |
| `--pf-line` | `#e0dfeb` | Connectors and node outlines not yet reached |
| `--pf-label` | `#75757f` | Label of a node not yet filled |

States are explicit colours rather than one colour at varying opacity, so each
of the four can be set independently to match a palette.

`<ProcessFlow theme="dark" />` swaps `--pf-line` and `--pf-label` for a dark
page. It does not touch the accent: `#4338e0` reaches only about 2.7:1 on
near-black, so a dark ground wants a lighter accent set alongside it.

Override any of them from your own stylesheet:

```css
.pf-section {
  --pf-accent: #4338e0;
  --pf-line: #e0dfeb;
  --pf-label: #75757f;
}
```

or per instance:

```jsx
<ProcessFlow style={{ '--pf-accent': '#4338e0', '--pf-line': '#e0dfeb' }} />
```

## Editing the graph

All geometry lives in `src/ProcessFlow/graph.js` — node positions, sizes and
labels, plus the two path generators (`spinePath` for the vertical S-curves,
`linkPath` for the horizontal fans). Adding a step to `SPINE_NODES` extends the
sequence automatically: edges and activation order are both derived from that
array.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # -> dist/
npm run preview
```

## Deploy to Vercel

Vercel detects Vite with no configuration. Import the repository, or:

```bash
npx vercel --prod
```

Build command `npm run build`, output directory `dist`.

The deployed page is the component and nothing else — no spacers, no copy — so
it can be embedded directly:

```html
<iframe
  src="https://your-deployment.vercel.app/?accent=4338e0&line=e0dfeb&bg=ffffff"
  style="width:100%;height:70vh;border:0"
  title="Design process"
></iframe>
```

Two query parameters recolour the embed from the `src`, with no rebuild:

| Parameter | Effect |
| --- | --- |
| `?accent=4338e0` | Filled nodes and the connector being drawn |
| `?line=e0dfeb` | Connectors and outlines not yet reached |
| `?label=75757f` | Labels of nodes not yet filled |
| `?bg=ffffff` | Paints a ground. The page is transparent by default, so an iframe of it composites over the host page |

The iframe scrolls internally, so the diagram pins against the iframe's own
height rather than the parent page's. Give the iframe the height you want the
pinned panel to be.

### Transparency

The page paints no background, so an iframe of it composites over whatever the
host page has behind it — no `border`, no matching background needed. Both
`html` and `body` are explicitly transparent, since a background on either one
paints the canvas, and `color-scheme` is left unset: declaring it makes the
browser paint an opaque canvas of its own beneath the document.

The default palette is drawn for a light ground. On a dark or strongly
saturated background, `--pf-line` and `--pf-label` need raising to stay
legible.

## Files

```
src/ProcessFlow/
  ProcessFlow.jsx        the component
  ProcessFlow.css        tokens, node/edge states, reduced-motion overrides
  graph.js               node + edge geometry, activation order
  useScrollProgress.js   scroll progress, reduced motion, element size hooks
  index.js               re-export
```

`ProcessFlow` has no dependencies beyond React, so the four files above drop
into any React project as-is.
