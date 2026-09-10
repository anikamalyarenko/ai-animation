import { useEffect } from 'react';
import ProcessFlow from './ProcessFlow';
import './App.css';

/**
 * The deployed page is the component and nothing else — no spacers, no copy —
 * so it can be dropped straight into an iframe.
 *
 * Optional query parameters recolour the embed from the iframe `src`, with
 * no rebuild:
 *
 *   ?accent=4338e0     filled nodes and the connector being drawn
 *   ?line=e0dfeb       connectors and outlines not yet reached
 *   ?label=75757f      labels of nodes not yet filled
 *   ?bg=ffffff         paints a ground. The page is transparent by default,
 *                      so an iframe of it composites over the host page.
 *
 * e.g. <iframe src="https://…/?accent=4338e0&line=e0dfeb" />
 */
const readHex = (value) =>
  value && /^#?[0-9a-f]{3,8}$/i.test(value) ? (value.startsWith('#') ? value : `#${value}`) : null;

export default function App() {
  const params = new URLSearchParams(window.location.search);
  const accent = readHex(params.get('accent'));
  const line = readHex(params.get('line'));
  const labelColor = readHex(params.get('label'));
  const bgParam = params.get('bg');
  const bg = bgParam === 'transparent' ? 'transparent' : readHex(bgParam);

  useEffect(() => {
    // html as well as body: a background on either one paints the canvas, so
    // both have to move together for the page to stay see-through.
    // Empty string restores the stylesheet default, which is transparent.
    document.documentElement.style.background = bg ?? '';
    document.body.style.background = bg ?? '';
  }, [bg]);

  const style = {};
  if (accent) style['--pf-accent'] = accent;
  if (line) style['--pf-line'] = line;
  if (labelColor) style['--pf-label'] = labelColor;

  return <ProcessFlow style={style} />;
}
