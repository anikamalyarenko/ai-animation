# AuroraBackground

A full-viewport background layer: one heavily blurred accent blob on black that
chases the cursor with easing, under a static film-grain overlay.

No dependencies beyond React. One `<canvas>`, one CSS-filter noise tile, one
`requestAnimationFrame` loop.

```jsx
import AuroraBackground from './AuroraBackground';

export default function Page() {
  return (
    <>
      <AuroraBackground />
      <main>…</main>
    </>
  );
}
```

The layer is `position: fixed; inset: 0; z-index: -1; pointer-events: none`, so
content renders on top and every click and hover passes through it.

## Props

| Prop | Default | What it does |
| --- | --- | --- |
| `accent` | `'#3B2E7A'` | The single blob colour. Any hex, 3 or 6 digits. |
| `base` | `'#050505'` | The ground the blob sits on. |
| `size` | `0.62` | Blob radius as a fraction of the viewport's short side. |
| `blur` | `90` | Blur radius in CSS pixels. |
| `ease` | `0.045` | Fraction of the remaining distance closed per frame. |
| `intensity` | `1` | Multiplier on blob opacity. |
| `grain` | `0.1` | Opacity of the noise overlay. `0` removes it. |
| `grainSize` | `180` | Noise tile size in px — the grain's coarseness. |
| `width`, `height` | `null` | Pin the layer to an exact pixel box instead of the viewport. Both or neither. |
| `className`, `style` | — | Merged onto the layer element. |

## Two modes

**Full-viewport layer** (default). `position: fixed; inset: 0; z-index: -1`,
sized from the window and re-sized with it. The drop-in-behind-your-page mode.

**Fixed-size stage.** Pass `width` and `height` and the layer becomes an exact
pixel box in normal flow at `z-index: 0` — for an export, a preview frame, or an
iframe of a known size. Nothing derives from `vw`/`vh` in this mode: `size`
measures against `min(width, height)` of the box, so the composition is
identical wherever the box sits and whatever the window around it does.

```jsx
<AuroraBackground width={1440} height={854} />
```

The stage does not scale to fit — that is the point of a fixed size. On a
narrower window the page scrolls to it. To fit it into a smaller frame without
changing the composition, scale the box and leave the props alone:

```css
.aurora--staged { transform: scale(0.6); transform-origin: top left; }
```

The cursor is normalised against the **layer's own box**, not the window, so the
blob tracks correctly inside a stage that does not fill the screen. A cursor
outside the box clamps to the nearest edge instead of flinging the blob
off-canvas.

## Tuning

**Colour.** `accent` is the only hue in the animation, by design — two accents
blended through `lighter` compositing produce a third colour in the overlap that
belongs to neither. The default is a deep violet; `#1E2A5E` is the navy
alternative. Because the blob is drawn with additive compositing, a *dark* hex
is correct: overlapping lobes brighten it to roughly `#4737a0` at the core. Pass
a colour that is already bright and the core clips toward white.

**Blur radius.** `blur` is in CSS pixels and is divided by `SCALE` internally, so
the number means what it says regardless of viewport size. Below ~40 the lobes
start reading as distinct shapes; above ~160 the blob loses its core and becomes
an even wash. `90` keeps a visible core with no visible edge.

**Blob size.** `size` is a fraction of `min(vw, vh)`, so the blob scales with the
viewport instead of getting lost on a large monitor. `0.4` is a contained accent
in one corner; `0.9` fills most of the screen and reads as a lit background
rather than a shape. The three lobes are sized relative to this, so they scale
together.

**Easing speed.** `ease` is the fraction of the remaining distance closed per
60fps frame, so higher is faster and lower drags. `0.02` is a heavy, laggy
trail; `0.12` sticks close to the cursor and loses the organic feel. The value
is re-derived from real frame time each frame, so the motion is identical on a
60Hz and a 120Hz display. Per-lobe `lag` in the `LOBES` table multiplies it —
that spread is what makes the blob deform instead of sliding rigidly.

**Shape.** The `LOBES` table is the shape itself: `radius`/`alpha` set each
lobe's size and weight, `offset` its resting position relative to the cursor,
`squash`/`tilt` its resting ellipse, and `speed`/`amp` the slow idle drift that
keeps the blob breathing when the cursor is still. Add a fourth entry for a
busier shape.

**Grain.** `grain` at `0.1` lifts pure black to about `#0d0d0d`. Past ~`0.2` the
blacks go visibly grey. `grainSize` is the tile size, so a smaller value makes
finer, denser grain.

## If the blob is invisible

Two things hide a negative-z-index layer:

1. **An opaque background on `body`.** A negative-z element paints above the
   root canvas but *below* the body box's own background. Put the page
   background on `html` instead, or drop it — this component paints its own.
2. **An ancestor that creates a stacking context** — `transform`, `filter`,
   `opacity < 1`, `isolation: isolate`, `will-change`. Then `-1` only goes
   behind that ancestor's content.

Either way the fix is one line: `--aurora-z: 0` on the component, plus
`position: relative; z-index: 1` on the content wrapper.

```jsx
<AuroraBackground style={{ '--aurora-z': 0 }} />
```

## Performance

Measured at 1920×1080 in headless Chromium with no GPU — software rasterisation,
the worst case:

| | median frame |
| --- | --- |
| empty `requestAnimationFrame` baseline | 16.7 ms |
| component running, cursor still | 16.7 ms |
| component running, cursor moving | 16.7 ms |
| fixed 1440x854 stage, cursor moving | 16.7 ms |

Three things buy that:

- **The canvas is rendered at 1/4 scale and stretched by CSS.** The compositor
  does the upscale on the GPU for free and its bilinear filtering doubles as
  extra blur. Cost is therefore constant from 720p to 4K, and `devicePixelRatio`
  is deliberately ignored. Painting at full resolution and upscaling with
  `drawImage` instead measured ~3× the frame budget for a result the eye cannot
  tell apart — the subject is a blur.
- **`pointermove` is not throttled.** It writes two numbers to a ref; the rAF
  loop is the only reader. No React state is involved, so cursor movement never
  triggers a render.
- **The grain is static.** One noise tile, generated by an SVG filter at paint
  time, on its own compositor layer. Animating it would force a full-viewport
  repaint every frame for an effect the eye reads as texture either way.

The loop stops on `visibilitychange` when the tab is hidden.

## Accessibility

- `aria-hidden="true"` — it is decoration, not content.
- `pointer-events: none` — no interference with focus, hover or hit testing.
- Under `prefers-reduced-motion: reduce` the component paints one static,
  centred frame and never starts the loop or attaches pointer listeners.
### Contrast is on you, not on the component

The blob is decoration — nothing is encoded in it. But it is a *coloured* ground
under your text, and that is where this kind of background usually fails.

At the defaults the brightest pixel of the blob is about `rgb(71,58,143)`, or
`rgb(89,78,154)` once the grain is folded in. Solid `#f4f4f6` over that is
**6.4:1** — clear of AA. Dimmed body copy is not: the usual
`rgba(244,244,246,0.66)` lands at **3.8:1** over the same pixel and **fails AA
for normal-size text**. The demo uses `0.78` for exactly that reason, which
measures 5.7:1 with the blob parked behind the text column.

So: measure against the **brightest point of the blob**, not against `base`, and
do it with the blob moved under the text — it follows the cursor, so every part
of the page is eventually the worst case. Raising `intensity` or lightening
`accent` moves that number, and so does lowering a text colour's alpha.

## Demo

`aurora.html` at the repo root renders the fixed-size stage at 1440x854 and
nothing else — no copy, no chrome. `npm run dev`, then open `/aurora.html`.

Measured on that page: the layer box and the canvas box are both exactly
1440x854 with zero gap on all four edges, the canvas buffer is 360x214 (the
1/4-scale render), and the frame budget holds at a 16.7 ms median with the
cursor moving.
