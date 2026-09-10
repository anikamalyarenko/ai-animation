import { useEffect, useLayoutEffect, useRef, useState } from 'react';

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

/** True when the user has asked the OS to reduce motion. Reacts to changes. */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduced(query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  return reduced;
}

/**
 * Scroll progress through a tall section whose inner panel is `position: sticky`.
 *
 * 0 = the panel has just pinned to the top of the viewport
 * 1 = the section is about to release the panel
 *
 * An IntersectionObserver gates the scroll listener, so no measuring happens
 * while the section is off screen. `quantize` rounds the value so React only
 * re-renders on a real change instead of on every scroll event.
 */
export function useScrollProgress(ref, { enabled = true, quantize = 400 } = {}) {
  const [progress, setProgress] = useState(0);
  const frame = useRef(0);

  useEffect(() => {
    const el = ref.current;
    if (!enabled || !el || typeof window === 'undefined') return undefined;

    let inView = true;

    const measure = () => {
      frame.current = 0;
      const rect = el.getBoundingClientRect();
      const runway = rect.height - window.innerHeight;
      const raw = runway > 0 ? -rect.top / runway : rect.top <= 0 ? 1 : 0;
      const next = Math.round(clamp(raw, 0, 1) * quantize) / quantize;
      setProgress((prev) => (prev === next ? prev : next));
    };

    const schedule = () => {
      if (!inView || frame.current) return;
      frame.current = requestAnimationFrame(measure);
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        inView = entry.isIntersecting;
        // Snap to the end state when the section leaves upwards, so the
        // diagram never freezes half-finished behind the fold.
        if (inView) schedule();
        else measure();
      },
      { threshold: 0 },
    );
    observer.observe(el);

    measure();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);

    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      if (frame.current) cancelAnimationFrame(frame.current);
      frame.current = 0;
    };
  }, [ref, enabled, quantize]);

  return progress;
}

/**
 * Content-box size of an element, tracked with a ResizeObserver.
 *
 * The diagram picks its viewBox from the space it actually has, not from the
 * viewport, so it lays out correctly inside an iframe or a narrow column where
 * a media query would report the wrong thing.
 */
export function useElementSize(ref) {
  const [size, setSize] = useState(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    const apply = (width, height) => {
      setSize((prev) =>
        prev && Math.abs(prev.width - width) < 1 && Math.abs(prev.height - height) < 1
          ? prev
          : { width, height },
      );
    };

    // Synchronous first read, so the first paint already has the right viewBox.
    const style = getComputedStyle(el);
    const box = el.getBoundingClientRect();
    apply(
      box.width - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight),
      box.height - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom),
    );

    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      apply(width, height);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);

  return size;
}
