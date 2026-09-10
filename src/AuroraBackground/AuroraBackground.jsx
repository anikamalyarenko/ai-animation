import { useEffect, useRef } from 'react';
import './AuroraBackground.css';

/**
 * Full-viewport animated background: a heavily blurred accent blob on black
 * that chases the cursor with easing, under a static film-grain overlay.
 *
 * Drops in as a background layer — `position: fixed; z-index: -1` and
 * `pointer-events: none`, so page content renders on top untouched:
 *
 *   <AuroraBackground />
 *   <main>…</main>
 *
 * Nothing here is React state. The pointer is written to a ref and read once
 * per animation frame, so moving the mouse never re-renders the tree.
 */

/** '#3B2E7A' | '#3b2' → [59, 46, 122] */
function hexToRgb(hex) {
  const clean = String(hex).replace('#', '').trim();
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean.padEnd(6, '0').slice(0, 6);
  const int = Number.parseInt(full, 16);
  return Number.isNaN(int) ? [59, 46, 122] : [(int >> 16) & 255, (int >> 8) & 255, int & 255];
}

/**
 * Gaussian-ish falloff for the radial gradient.
 *
 * A canvas radial gradient interpolates alpha linearly between stops, which
 * leaves a visible hard-edged disc. Sampling exp(-k·t²) across nine stops gives
 * the soft shoulder of a real Gaussian, and subtracting the tail puts the last
 * stop at exactly zero so the blob has no rim.
 */
const FALLOFF = (() => {
  const K = 4.6;
  const tail = Math.exp(-K);
  return Array.from({ length: 9 }, (_, i) => {
    const t = i / 8;
    return [t, Math.max(0, (Math.exp(-K * t * t) - tail) / (1 - tail))];
  });
})();

/**
 * Three overlapping lobes, not one circle — that is what makes the shape read
 * as an aurora rather than a spotlight.
 *
 * `lag` scales the easing factor per lobe: the small lobes catch up faster than
 * the big one, so a quick cursor move pulls the blob apart and it gathers back
 * together when the cursor stops. `speed`/`amp` are a slow sine drift, so the
 * shape keeps breathing while the cursor is still. `squash`/`tilt` give each
 * lobe a resting ellipse instead of a circle.
 */
const LOBES = [
  {
    radius: 1.0,
    alpha: 0.9,
    lag: 1.0,
    offset: [0, 0],
    speed: [0.11, 0.07],
    amp: [0.1, 0.08],
    squash: 0.66,
    tilt: -0.5,
  },
  {
    radius: 0.72,
    alpha: 0.6,
    lag: 0.62,
    offset: [0.2, -0.14],
    speed: [0.07, 0.13],
    amp: [0.13, 0.1],
    squash: 0.84,
    tilt: 0.7,
  },
  {
    radius: 0.48,
    alpha: 0.45,
    lag: 0.38,
    offset: [-0.16, 0.18],
    speed: [0.15, 0.09],
    amp: [0.09, 0.13],
    squash: 0.58,
    tilt: 0.2,
  },
];

/** Hard cap on how far a fast cursor sweep may stretch a lobe. */
const MAX_STRETCH = 0.9;

/**
 * The canvas is rendered at 1/SCALE of the viewport and stretched to fill it by
 * CSS. That is the whole performance story: the compositor does the upscale on
 * the GPU for free, and its bilinear filtering doubles as extra blur, so the
 * animation costs the same at 4K as at 720p. Painting at full resolution and
 * upscaling with drawImage instead measured ~3× the frame budget for a result
 * the eye cannot tell apart — the subject is a blur.
 */
const SCALE = 4;

export default function AuroraBackground({
  accent = '#3B2E7A',
  base = '#050505',
  size = 0.62,
  blur = 90,
  ease = 0.045,
  intensity = 1,
  grain = 0.1,
  grainSize = 180,
  className = '',
  style,
}) {
  const canvasRef = useRef(null);
  const pointer = useRef({ x: 0.5, y: 0.42 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    const rgb = hexToRgb(accent);
    const reduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Lobe state in canvas pixels, lerped toward the pointer every frame.
    const lobes = LOBES.map(() => ({ x: 0, y: 0, vx: 0, vy: 0, seeded: false }));

    let width = 0;
    let height = 0;
    let raf = 0;
    let resizeRaf = 0;
    let last = 0;

    const resize = () => {
      // Deliberately ignores devicePixelRatio: the canvas is a blur source, and
      // CSS stretches it to the viewport either way.
      width = Math.max(1, Math.round(window.innerWidth / SCALE));
      height = Math.max(1, Math.round(window.innerHeight / SCALE));
      canvas.width = width;
      canvas.height = height;
    };

    const draw = (time) => {
      const radius = Math.min(width, height) * size;

      ctx.globalCompositeOperation = 'source-over';
      ctx.filter = 'none';
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, width, height);

      // `lighter` so overlapping lobes accumulate into a brighter core, the way
      // real light does, instead of the topmost one hiding the others.
      ctx.globalCompositeOperation = 'lighter';
      ctx.filter = `blur(${(blur / SCALE).toFixed(2)}px)`;

      LOBES.forEach((lobe, i) => {
        const p = lobes[i];
        const r = radius * lobe.radius;
        const x = p.x + lobe.offset[0] * r + Math.sin(time * lobe.speed[0]) * r * lobe.amp[0];
        const y = p.y + lobe.offset[1] * r + Math.cos(time * lobe.speed[1]) * r * lobe.amp[1];

        // Smear along the direction of travel: a fast sweep pulls the lobe into
        // a streak, and it relaxes back to its resting ellipse when the cursor
        // stops. At rest stretch is 1, so the travel angle stops mattering and
        // there is no snap as the velocity crosses zero.
        const speed = Math.hypot(p.vx, p.vy);
        const stretch = 1 + Math.min(speed / (radius * 0.1), MAX_STRETCH);
        const travel = Math.atan2(p.vy, p.vx);
        const idle = lobe.tilt + Math.sin(time * lobe.speed[0] * 0.8) * 0.35;

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(travel);
        ctx.scale(stretch, 1 / Math.sqrt(stretch));
        ctx.rotate(idle);
        ctx.scale(1, lobe.squash);

        // Built in the transformed space, so the CTM turns this circular
        // gradient into the tilted, stretched ellipse.
        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
        for (const [stop, weight] of FALLOFF) {
          const a = lobe.alpha * intensity * weight;
          gradient.addColorStop(stop, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a.toFixed(4)})`);
        }
        ctx.fillStyle = gradient;
        ctx.fillRect(-r, -r, r * 2, r * 2);
        ctx.restore();
      });

      ctx.filter = 'none';
      ctx.globalCompositeOperation = 'source-over';
    };

    const step = (now) => {
      // Clamped so a backgrounded tab or a long GC pause does not teleport the
      // blob on the frame after it.
      const dt = last ? Math.min(now - last, 64) : 16.6667;
      last = now;

      // The pointer is stored normalised, so the blob keeps its relative
      // position across a resize instead of jumping.
      const targetX = pointer.current.x * width;
      const targetY = pointer.current.y * height;

      lobes.forEach((p, i) => {
        if (!p.seeded) {
          p.x = targetX;
          p.y = targetY;
          p.seeded = true;
          return;
        }
        // Frame-rate independent lerp: `ease` is the fraction of the remaining
        // distance closed per 60fps frame, re-derived for the frame we actually
        // got. Without this the blob moves at half speed on a 120Hz display.
        const k = 1 - (1 - ease * LOBES[i].lag) ** (dt / 16.6667);
        const nextX = p.x + (targetX - p.x) * k;
        const nextY = p.y + (targetY - p.y) * k;

        // Velocity in px per 60fps frame, smoothed so the stretch direction does
        // not jitter between individual pointer events.
        const per = 16.6667 / dt;
        p.vx += ((nextX - p.x) * per - p.vx) * 0.12;
        p.vy += ((nextY - p.y) * per - p.vy) * 0.12;
        p.x = nextX;
        p.y = nextY;
      });

      draw(now / 1000);
      raf = requestAnimationFrame(step);
    };

    const onPointerMove = (event) => {
      // No throttle: a ref write per event is cheaper than any throttle would
      // be, and the rAF loop is the only reader, so extra events cost one
      // assignment each and never a repaint.
      pointer.current.x = event.clientX / window.innerWidth;
      pointer.current.y = event.clientY / window.innerHeight;
    };

    const onPointerLeave = () => {
      pointer.current.x = 0.5;
      pointer.current.y = 0.42;
    };

    const onResize = () => {
      if (resizeRaf) return;
      resizeRaf = requestAnimationFrame(() => {
        resizeRaf = 0;
        resize();
        if (reduced) drawStatic();
      });
    };

    const drawStatic = () => {
      lobes.forEach((p) => {
        p.x = width * 0.5;
        p.y = height * 0.42;
        p.vx = 0;
        p.vy = 0;
        p.seeded = true;
      });
      draw(0);
    };

    const onVisibility = () => {
      if (document.hidden) {
        // Nothing is visible, so stop burning frames entirely.
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
      } else if (!raf) {
        last = 0;
        raf = requestAnimationFrame(step);
      }
    };

    resize();

    if (reduced) {
      // One static frame, centred. No loop, no pointer listeners.
      drawStatic();
      window.addEventListener('resize', onResize);
      return () => {
        window.removeEventListener('resize', onResize);
        if (resizeRaf) cancelAnimationFrame(resizeRaf);
      };
    }

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerdown', onPointerMove, { passive: true });
    document.addEventListener('pointerleave', onPointerLeave);
    window.addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', onVisibility);
    raf = requestAnimationFrame(step);

    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerdown', onPointerMove);
      document.removeEventListener('pointerleave', onPointerLeave);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibility);
      if (raf) cancelAnimationFrame(raf);
      if (resizeRaf) cancelAnimationFrame(resizeRaf);
    };
  }, [accent, base, size, blur, ease, intensity]);

  return (
    <div
      className={`aurora${className ? ` ${className}` : ''}`}
      style={{ '--aurora-grain': grain, '--aurora-grain-size': `${grainSize}px`, ...style }}
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className="aurora__canvas" />
      <div className="aurora__grain" />
    </div>
  );
}
